import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../database/database.types";

type UserSecretRow = Database["public"]["Tables"]["user_secrets"]["Row"];

export interface TokenResult {
  token: string;
  igId: string;
  pageId: string;
}

export interface StoreTokenData {
  token: string;
  igId: string;
  pageId: string;
  expiresAt: string;
}

export class InstagramAuthService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Retrieve stored Instagram token for a user.
   * Assumes token is decrypted at rest by pgcrypto in the DB.
   */
  async getToken(userId: string): Promise<TokenResult> {
    const { data, error } = await this.supabase
      .from("user_secrets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error("Failed to retrieve Instagram token: " + error.message);
    }

    const row = data as UserSecretRow | null;

    if (!row) {
      throw new Error("No Instagram token found for user");
    }

    return {
      token: row.instagram_token ?? "",
      igId: row.instagram_ig_id ?? "",
      pageId: row.instagram_page_id ?? "",
    };
  }

  /**
   * Store or update Instagram token for a user.
   */
  async storeToken(userId: string, tokenData: StoreTokenData): Promise<void> {
    const { error } = await (this.supabase
      .from("user_secrets") as any)
      .upsert(
        {
          user_id: userId,
          instagram_token: tokenData.token,
          instagram_ig_id: tokenData.igId,
          instagram_page_id: tokenData.pageId,
          token_expires_at: tokenData.expiresAt,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw new Error("Failed to store Instagram token: " + error.message);
    }
  }

  /**
   * Refresh a long-lived Instagram token via Meta's OAuth endpoint.
   */
  async refreshToken(userId: string): Promise<string> {
    const current = await this.getToken(userId).catch(() => null);

    if (!current) {
      throw new Error("No existing Instagram token to refresh");
    }

    const appSecret = process.env.META_APP_SECRET ?? "";
    const appId = process.env.META_APP_ID ?? "";

    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${current.token}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Failed to refresh Instagram token: " + response.statusText
      );
    }

    const body = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(
      Date.now() + (body.expires_in || 5184000) * 1000
    ).toISOString();

    await this.storeToken(userId, {
      token: body.access_token,
      igId: current.igId,
      pageId: current.pageId,
      expiresAt,
    });

    return body.access_token;
  }
}
