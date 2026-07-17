import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: NextRequest) => {
  const appId = process.env.META_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId) {
    return NextResponse.json(
      { error: "META_APP_ID no configurado" },
      { status: 400 }
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL no configurado" },
      { status: 400 }
    );
  }

  // Verify user is authenticated before initiating OAuth
  await withAuth(request);

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("instagram_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/api/instagram/auth/callback",
  });

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${appUrl}/api/instagram/auth/callback`,
    scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,instagram_basic,instagram_manage_messages,instagram_manage_insights",
    state,
    response_type: "code",
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
    302
  );
});

export const DELETE = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);

  const { error } = await (supabase
    .from("user_secrets") as any)
    .update({
      instagram_token: null,
      instagram_ig_id: null,
      instagram_page_id: null,
    })
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to disconnect Instagram", { error });
    return NextResponse.json(
      { error: "Error al desconectar Instagram" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
});
