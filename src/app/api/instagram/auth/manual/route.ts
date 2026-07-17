import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const ManualTokenSchema = z.object({
  /** User Access Token OR Page Access Token */
  userAccessToken: z.string().min(1, "Token requerido"),
  /** Optional: if provided, bypasses page discovery and uses these directly */
  pageIdOverride: z.string().optional(),
});

/**
 * POST /api/instagram/auth/manual
 *
 * Bypass OAuth flow for pages under Business Manager.
 * Tries multiple strategies to discover the Instagram Business Account:
 *
 * Strategy A — User Token: calls /me/accounts to find pages (standard)
 * Strategy B — Page Token: queries the page directly using the token
 * Strategy C — Manual IDs: user provides pageId, we look up the IG ID
 */
export const POST = apiHandler(
  async (request: NextRequest) => {
    const { supabase, user } = await withAuth(request);

    const body = await request.json();
    const { userAccessToken, pageIdOverride } = ManualTokenSchema.parse(body);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL not configured" },
        { status: 500 }
      );
    }

    try {
      // Strategy C: pageIdOverride provided — query that page directly
      if (pageIdOverride) {
        const pageUrl = new URL(
          `https://graph.facebook.com/v21.0/${pageIdOverride}`
        );
        pageUrl.searchParams.set(
          "fields",
          "id,name,instagram_business_account"
        );
        pageUrl.searchParams.set("access_token", userAccessToken);

        const pageRes = await fetch(pageUrl.toString());
        if (!pageRes.ok) {
          const err = await pageRes.text();
          return NextResponse.json(
            {
              error: `La página ${pageIdOverride} no es accesible con este token.`,
              detail: err,
            },
            { status: 400 }
          );
        }

        const pageBody: Record<string, unknown> = await pageRes.json();
        const igAccount = pageBody.instagram_business_account as
          | { id?: string }
          | undefined;

        if (!igAccount?.id) {
          return NextResponse.json(
            {
              error:
                "La página no tiene una cuenta de Instagram Business/Profesional vinculada.",
              pageName: pageBody.name,
              tip: "En Facebook, andá a la página → Configuración → Instagram → Vinculá tu Instagram.",
            },
            { status: 400 }
          );
        }

        // Found IG ID! Store tokens
        const expiresAt = new Date(
          Date.now() + 5184000 * 1000
        ).toISOString();
        const authService = new InstagramAuthService(supabase);
        await authService.storeToken(user.id, {
          token: userAccessToken,
          userToken: userAccessToken,
          igId: igAccount.id,
          pageId: pageIdOverride,
          expiresAt,
        });

        return NextResponse.json({
          connected: true,
          pageName: pageBody.name,
          pageId: pageIdOverride,
          igId: igAccount.id,
          expiresAt,
        });
      }

      // Strategy A: try /me/accounts (standard User Token flow)
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${userAccessToken}`
      );

      if (!meRes.ok) {
        // Token might be a Page Token — try Strategy B
        return await tryPageTokenStrategy(
          userAccessToken,
          user.id,
          supabase
        );
      }

      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}&limit=100`
      );

      if (!pagesRes.ok) {
        return NextResponse.json(
          {
            error:
              "No se pudieron obtener las páginas. Revisá que el token tenga pages_show_list.",
          },
          { status: 400 }
        );
      }

      const pagesBody: {
        data: Array<{
          id: string;
          name: string;
          access_token: string;
        }>;
      } = await pagesRes.json();
      const pages = pagesBody.data;

      if (pages.length === 0) {
        // No pages found via /me/accounts — this can happen when the page
        // is under a Business Manager. Try treating the token as a Page Token.
        return await tryPageTokenStrategy(
          userAccessToken,
          user.id,
          supabase
        );
      }

      // Strategy A succeeded — find the page with Instagram
      const result = await findInstagramPage(pages, user.id, supabase);
      if (result) return result;

      // None of the pages have Instagram — try as Page Token just in case
      return await tryPageTokenStrategy(
        userAccessToken,
        user.id,
        supabase
      );
    } catch (error) {
      logger.error("Manual Instagram config error", { error });
      return NextResponse.json(
        {
          error:
            "Error al configurar Instagram manualmente. Intentalo de nuevo.",
        },
        { status: 500 }
      );
    }
  }
);

/**
 * Strategy B: treat the token as a Page Access Token and try to
 * discover the linked Instagram Business Account by querying
 * common page endpoints.
 */
async function tryPageTokenStrategy(
  token: string,
  userId: string,
  supabase: any
): Promise<NextResponse> {
  // Try to find what page this token belongs to by calling /me
  // (Page Tokens also respond to /me with the page info)
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,instagram_business_account&access_token=${token}`
  );

  if (!meRes.ok) {
    return NextResponse.json(
      {
        error:
          "Token inválido. Asegurate de copiar un Page Token desde el Graph API Explorer (seleccioná 'Page Token' y elegí tu página).",
        tip: "En el Graph API Explorer, cambiá 'User Token' a 'Page Token' arriba a la derecha.",
      },
      { status: 400 }
    );
  }

  const meData: Record<string, unknown> = await meRes.json();
  const igAccount = meData.instagram_business_account as
    | { id?: string }
    | undefined;

  if (!igAccount?.id) {
    // The token works but the page has no Instagram Business Account
    return NextResponse.json(
      {
        error:
          "El token es válido pero la página no tiene Instagram Business/Profesional vinculado.",
        pageName: meData.name,
        pageId: meData.id,
        tip: "En Facebook, andá a la página → Configuración → Instagram → Vinculá tu Instagram.",
      },
      { status: 400 }
    );
  }

  // Found it!
  const expiresAt = new Date(Date.now() + 5184000 * 1000).toISOString();
  const authService = new InstagramAuthService(supabase);
  await authService.storeToken(userId, {
    token,
    userToken: token,
    igId: igAccount.id,
    pageId: meData.id as string,
    expiresAt,
  });

  return NextResponse.json({
    connected: true,
    pageName: meData.name,
    pageId: meData.id,
    igId: igAccount.id,
    expiresAt,
  });
}

/**
 * Strategy A helper: iterate discovered pages looking for Instagram Business Account.
 */
async function findInstagramPage(
  pages: Array<{ id: string; name: string; access_token: string }>,
  userId: string,
  supabase: any
): Promise<NextResponse | null> {
  for (const page of pages) {
    if (!page.access_token) continue;

    const pageUrl = new URL(
      `https://graph.facebook.com/v21.0/${page.id}`
    );
    pageUrl.searchParams.set("fields", "instagram_business_account");
    pageUrl.searchParams.set("access_token", page.access_token);

    const pageRes = await fetch(pageUrl.toString());
    if (pageRes.ok) {
      const pageBody: Record<string, unknown> = await pageRes.json();
      const igAccount = pageBody.instagram_business_account as
        | { id?: string }
        | undefined;

      if (igAccount?.id) {
        const expiresAt = new Date(
          Date.now() + 5184000 * 1000
        ).toISOString();
        const authService = new InstagramAuthService(supabase);
        await authService.storeToken(userId, {
          token: page.access_token,
          userToken: page.access_token,
          igId: igAccount.id,
          pageId: page.id,
          expiresAt,
        });

        return NextResponse.json({
          connected: true,
          pageName: page.name,
          pageId: page.id,
          igId: igAccount.id,
          expiresAt,
        });
      }
    }
  }

  return null;
}
