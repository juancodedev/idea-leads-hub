import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { InstagramAuthService } from "@/infrastructure/services/InstagramAuthService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const ManualTokenSchema = z.object({
  userAccessToken: z.string().min(1, "Token requerido"),
});

/**
 * POST /api/instagram/auth/manual
 *
 * Bypass OAuth flow: accepts a User Access Token generated from
 * Facebook Graph API Explorer, validates it, discovers the linked
 * Instagram Business Account, and stores both tokens.
 *
 * How to get a token:
 *   1. Go to https://developers.facebook.com/tools/explorer/
 *   2. Select your app (1384731360241363)
 *   3. Get a User Token with: pages_show_list, pages_read_engagement,
 *      pages_manage_metadata, instagram_basic, instagram_manage_messages
 *   4. Click "Generate Access Token" and authorize
 *   5. Paste the token here
 */
export const POST = apiHandler(
  async (request: NextRequest) => {
    const { supabase, user } = await withAuth(request);

    const body = await request.json();
    const { userAccessToken } = ManualTokenSchema.parse(body);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL not configured" },
        { status: 500 }
      );
    }

    try {
      // Step 1: Call /me to verify the token works
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${userAccessToken}`
      );

      if (!meRes.ok) {
        const err = await meRes.text();
        logger.error("Manual token: /me failed", { status: meRes.status, body: err });
        return NextResponse.json(
          { error: "Token inválido o expirado. Generá uno nuevo en Graph API Explorer." },
          { status: 400 }
        );
      }

      // Step 2: Get pages the user manages
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}&limit=100`
      );

      if (!pagesRes.ok) {
        return NextResponse.json(
          { error: "No se pudieron obtener las páginas. Revisá que el token tenga pages_show_list." },
          { status: 400 }
        );
      }

      const pagesBody: {
        data: Array<{ id: string; name: string; access_token: string }>;
      } = await pagesRes.json();

      const pages = pagesBody.data;

      if (pages.length === 0) {
        return NextResponse.json(
          {
            error:
              "El token no tiene páginas asociadas. Asegurate de que tu cuenta personal de Facebook sea Admin o Editor de la página que tiene Instagram vinculado.",
            tip: "Andá a Facebook → Tu Página → Configuración → Roles de página → Agregá tu perfil personal como Editor.",
          },
          { status: 400 }
        );
      }

      // Step 3: Find the page with Instagram Business Account
      let igId: string | null = null;
      let pageId: string | null = null;
      let pageToken: string | null = null;
      let pageName: string | null = null;

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
            igId = igAccount.id;
            pageId = page.id;
            pageToken = page.access_token;
            pageName = page.name;
            break;
          }
        }
      }

      if (!igId || !pageId || !pageToken) {
        const pageList = pages.map((p) => `${p.name} (${p.id})`).join(", ");
        return NextResponse.json(
          {
            error:
              "Ninguna de tus páginas tiene una cuenta de Instagram Business/Profesional vinculada.",
            pages: pageList,
            tip: "En Facebook, andá a la página → Configuración → Instagram → Vinculá tu Instagram. Tiene que ser cuenta de Creador o Empresa.",
          },
          { status: 400 }
        );
      }

      // Step 4: Store tokens
      const expiresAt = new Date(
        Date.now() + 5184000 * 1000 // 60 days default
      ).toISOString();

      const authService = new InstagramAuthService(supabase);
      await authService.storeToken(user.id, {
        token: pageToken,
        userToken: userAccessToken,
        igId,
        pageId,
        expiresAt,
      });

      logger.info("Manual Instagram config successful", {
        pageId,
        pageName,
        igId,
      });

      return NextResponse.json({
        connected: true,
        pageName,
        pageId,
        igId,
        expiresAt,
      });
    } catch (error) {
      logger.error("Manual Instagram config error", { error });
      return NextResponse.json(
        { error: "Error al configurar Instagram manualmente. Intentalo de nuevo." },
        { status: 500 }
      );
    }
  }
);
