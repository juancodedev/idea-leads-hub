import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: NextRequest) => {
  const instagramAppId = process.env.INSTAGRAM_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!instagramAppId) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID no configurado" },
      { status: 400 }
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL no configurado" },
      { status: 400 }
    );
  }

  // Verify user is authenticated
  await withAuth(request);

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("instagram_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: instagramAppId,
    redirect_uri: `${appUrl}/settings/profile`,
    response_type: "code",
    scope:
      "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights",
    state,
  });

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`,
    302
  );
});
