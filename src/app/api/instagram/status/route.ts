import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";
import { Database } from "@/infrastructure/database/database.types";

export const runtime = "nodejs";

type UserSecretRow = Database["public"]["Tables"]["user_secrets"]["Row"];

export const GET = apiHandler(async (request: NextRequest) => {
  const { supabase, user } = await withAuth(request);

  const { data, error } = await (supabase
    .from("user_secrets") as any)
    .select("instagram_token, instagram_ig_id, token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = data as UserSecretRow | null;

  if (error) {
    return NextResponse.json(
      { error: "Error al verificar el estado de Instagram" },
      { status: 500 }
    );
  }

  if (!row?.instagram_token) {
    // If there's a user_token but no page_token, it's pending manual config
    if (row?.instagram_user_token) {
      return NextResponse.json({
        connected: false,
        pending: true,
        expiresAt: row.token_expires_at ?? undefined,
      });
    }
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    igId: row.instagram_ig_id ?? undefined,
    expiresAt: row.token_expires_at ?? undefined,
  });
});
