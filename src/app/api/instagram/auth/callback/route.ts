import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/infrastructure/database/server";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appSecret || !appUrl) {
    logger.error("Missing Meta or App URL configuration");
    return NextResponse.redirect(
      new URL(
        "/settings/profile?instagram=error",
        appUrl ?? "http://localhost:3000"
      ),
      302
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    logger.warn("Missing code or state in callback", { hasCode: !!code, hasState: !!state });
    return NextResponse.redirect(
      new URL("/settings/profile?instagram=error&step=missing_code_state", appUrl),
      302
    );
  }

  // Verify CSRF state cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get("instagram_oauth_state")?.value;
  cookieStore.delete("instagram_oauth_state");

  if (state !== savedState) {
    logger.warn("Instagram OAuth state mismatch", {
      expected: savedState,
      received: state,
    });
    return NextResponse.redirect(
      new URL("/settings/profile?instagram=error&step=state_mismatch", appUrl),
      302
    );
  }

  try {
    // 1. Exchange authorization code for short-lived access token
    const tokenUrl = new URL(
      "https://graph.facebook.com/v21.0/oauth/access_token"
    );
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set(
      "redirect_uri",
      `${appUrl}/api/instagram/auth/callback`
    );
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "POST" });
    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      logger.error("Failed to exchange code for token", {
        status: tokenRes.status,
        body: errorBody,
      });
      return NextResponse.redirect(
        new URL("/settings/profile?instagram=error&step=token_exchange", appUrl),
        302
      );
    }

    const tokenBody: { access_token: string } = await tokenRes.json();
    const shortLivedToken = tokenBody.access_token;

    // 2. Exchange short-lived token for long-lived (60-day) token
    const longLivedUrl = new URL(
      "https://graph.facebook.com/v21.0/oauth/access_token"
    );
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    if (!longLivedRes.ok) {
      const errorBody = await longLivedRes.text();
      logger.error("Failed to exchange for long-lived token", {
        status: longLivedRes.status,
        body: errorBody,
      });
      return NextResponse.redirect(
        new URL("/settings/profile?instagram=error&step=long_lived", appUrl),
        302
      );
    }

    const longLivedBody: {
      access_token: string;
      expires_in?: number;
    } = await longLivedRes.json();
    const longLivedToken = longLivedBody.access_token;
    const expiresIn = longLivedBody.expires_in ?? 5184000; // default 60 days in seconds

    // 3. Get user's Facebook Pages
    const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
    pagesUrl.searchParams.set("access_token", longLivedToken);
    pagesUrl.searchParams.set("limit", "100");

    const pagesRes = await fetch(pagesUrl.toString());
    if (!pagesRes.ok) {
      const errorBody = await pagesRes.text();
      logger.error("Failed to fetch pages", { status: pagesRes.status, body: errorBody });
      return NextResponse.redirect(
        new URL("/settings/profile?instagram=error&step=fetch_pages", appUrl),
        302
      );
    }

    const pagesBody: {
      data: Array<{ id: string; name: string; access_token: string }>;
    } = await pagesRes.json();
    const pages = pagesBody.data;

    // Debug: log what pages were returned
    logger.info("Pages returned from /me/accounts", {
      count: pages.length,
      pageIds: pages.map((p) => ({ id: p.id, name: p.name, hasToken: !!p.access_token })),
    });

    // 4. Find the first page that has an Instagram Business Account.
    //    Uses the Page Access Token (from /me/accounts) — required by Meta
    //    for the instagram_business_account field on a Page node.
    let igId: string | null = null;
    let pageId: string | null = null;
    let pageToken: string | null = null;

    for (const page of pages) {
      if (!page.access_token) {
        logger.warn("Page has no access_token", { pageId: page.id, pageName: page.name });
        continue;
      }

      const pageUrl = new URL(
        `https://graph.facebook.com/v21.0/${page.id}`
      );
      pageUrl.searchParams.set("fields", "instagram_business_account");
      pageUrl.searchParams.set("access_token", page.access_token);

      const pageRes = await fetch(pageUrl.toString());
      if (pageRes.ok) {
        const pageBody: Record<string, unknown> = await pageRes.json();
        logger.info("Page detail response", {
          pageId: page.id,
          keys: Object.keys(pageBody),
          hasIgAccount: !!pageBody.instagram_business_account,
        });
        const igAccount = pageBody.instagram_business_account as { id?: string } | undefined;
        if (igAccount?.id) {
          igId = igAccount.id;
          pageId = page.id;
          pageToken = page.access_token;
          break;
        }
      } else {
        const errBody = await pageRes.text();
        logger.warn("Failed to fetch page detail", { pageId: page.id, status: pageRes.status, body: errBody });
      }
    }

    if (!igId || !pageId || !pageToken) {
      logger.warn("No Instagram Business Account found for user's pages", {
        pagesCount: pages.length,
        pageIds: pages.map((p) => p.id),
      });

      // Even without a Page Token, store the User Token (it's refreshable)
      // so the user can use manual config to complete the setup.
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        const authService = new InstagramAuthService(supabase);
        const expiresAt = new Date(
          Date.now() + (longLivedBody.expires_in ?? 5184000) * 1000
        ).toISOString();

        // Store just the User Token (no Page Token yet)
        await authService.storeToken(user.id, {
          token: "", // no Page Token yet
          userToken: longLivedToken,
          igId: "",
          pageId: "",
          expiresAt,
        });
      }

      return NextResponse.redirect(
        new URL(
          "/settings/profile?instagram=pending&step=no_ig_account",
          appUrl
        ),
        302
      );
    }

    // 5. Authenticate the user from session cookie
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error("Failed to authenticate user in OAuth callback", { error: authError });
      return NextResponse.redirect(
        new URL("/settings/profile?instagram=error&step=auth_user", appUrl),
        302
      );
    }

    // 6. Store both tokens: Page Access Token (API calls) and User Access Token (refresh)
    const authService = new InstagramAuthService(supabase);
    const expiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    await authService.storeToken(user.id, {
      token: pageToken,              // Page Access Token — para enviar DMs, webhooks
      userToken: longLivedToken,     // User Access Token — para refrescar después de 60 días
      igId,
      pageId,
      expiresAt,
    });
  } catch (error) {
    logger.error("Instagram OAuth callback error", { error });
    return NextResponse.redirect(
      new URL("/settings/profile?instagram=error&step=exception", appUrl),
      302
    );
  }

  return NextResponse.redirect(
    new URL("/settings/profile?instagram=connected", appUrl),
    302
  );
}
