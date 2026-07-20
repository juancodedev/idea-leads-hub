import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const instagramAppId = process.env.INSTAGRAM_APP_ID;
  const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET;

  const { code, state } = await request.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Código de autorización requerido" },
      { status: 400 }
    );
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("instagram_oauth_state")?.value;
  if (!state || state !== savedState) {
    logger.error("Instagram OAuth state mismatch");
    return NextResponse.json(
      { error: "State mismatch. Posible ataque CSRF." },
      { status: 403 }
    );
  }
  cookieStore.delete("instagram_oauth_state");

  if (!instagramAppId || !instagramAppSecret) {
    return NextResponse.json(
      { error: "Instagram App no configurado en el servidor" },
      { status: 500 }
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL no configurado" },
      { status: 500 }
    );
  }

  try {
    // Step 1: Exchange code for Instagram User Token (valid ~60 days for Business Login)
    // NOTE: Do NOT exchange via graph.instagram.com — that converts it to a Basic Display
    // API token which does NOT work with graph.facebook.com endpoints.
    const tokenBody = new URLSearchParams({
      client_id: instagramAppId,
      client_secret: instagramAppSecret,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/settings/profile`,
      code,
    });

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error("Instagram token exchange failed", { status: tokenRes.status, body: errText });
      return NextResponse.json(
        { error: "Error al intercambiar código por token", detail: errText },
        { status: 502 }
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      user_id: number;
      permissions?: string[];
      token_type?: string;
    };

    const shortLivedToken = tokenData.access_token;
    const igUserId = String(tokenData.user_id);

    // Step 2: Exchange short-lived token for long-lived (60d) token
    // GET graph.instagram.com/access_token?grant_type=ig_exchange_token
    const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${instagramAppSecret}&access_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);

    if (!longLivedRes.ok) {
      const errText = await longLivedRes.text();
      logger.error("Instagram long-lived token exchange failed", {
        status: longLivedRes.status,
        body: errText,
      });
      return NextResponse.json(
        { error: "Error al obtener token de larga duración", detail: errText },
        { status: 502 }
      );
    }

    const longLivedData = (await longLivedRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    const accessToken = longLivedData.access_token;
    const expiresAt = new Date(
      Date.now() + (longLivedData.expires_in || 5184000) * 1000
    ).toISOString();

    // Step 3: Store the long-lived token with auth_type
    const authService = new InstagramAuthService(supabase);
    await authService.storeToken(user.id, {
      token: accessToken,
      userToken: accessToken,
      igId: igUserId,
      pageId: igUserId, // Instagram Business Account ID (no Facebook Page)
      expiresAt,
      authType: "instagram_business_login",
    });

    logger.info("Instagram connected via Instagram Business Login", { igUserId, permissions: tokenData.permissions });

    return NextResponse.json({ success: true, igId: igUserId, expiresAt });
  } catch (err) {
    logger.error("Instagram callback error", { error: String(err) });
    return NextResponse.json(
      { error: "Error interno al conectar Instagram" },
      { status: 500 }
    );
  }
});
