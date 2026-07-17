import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../database/database.types";

type UserSecretRow = Database["public"]["Tables"]["user_secrets"]["Row"];

export interface TokenResult {
  /** Page Access Token — used for API calls (send DM, webhooks) */
  token: string;
  /** User Access Token — used for OAuth token refresh */
  userToken: string;
  igId: string;
  pageId: string;
}

export interface StoreTokenData {
  /** Page Access Token */
  token: string;
  /** User Access Token */
  userToken: string;
  igId: string;
  pageId: string;
  expiresAt: string;
}

export class InstagramAuthService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Retrieve stored Instagram tokens for a user.
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
      userToken: row.instagram_user_token ?? "",
      igId: row.instagram_ig_id ?? "",
      pageId: row.instagram_page_id ?? "",
    };
  }

  /**
   * Store or update Instagram tokens for a user.
   * Saves both the Page Access Token and the User Access Token.
   */
  async storeToken(userId: string, tokenData: StoreTokenData): Promise<void> {
    const { error } = await (this.supabase
      .from("user_secrets") as any)
      .upsert(
        {
          user_id: userId,
          instagram_token: tokenData.token,
          instagram_user_token: tokenData.userToken,
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
   * Refresh both the User Access Token and Page Access Token.
   *
   * 1. Uses the stored User Access Token with fb_exchange_token to get a
   *    fresh long-lived user token.
   * 2. Calls /me/accounts with the refreshed user token to get a new
   *    Page Access Token.
   */
  async refreshToken(userId: string): Promise<TokenResult> {
    const current = await this.getToken(userId).catch(() => null);

    if (!current?.userToken) {
      throw new Error("No existing user token to refresh");
    }

    const appSecret = process.env.META_APP_SECRET ?? "";
    const appId = process.env.META_APP_ID ?? "";

    // Step 1: Refresh the User Access Token
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${current.userToken}`;

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

    const refreshedUserToken = body.access_token;
    const expiresAt = new Date(
      Date.now() + (body.expires_in || 5184000) * 1000
    ).toISOString();

    // Step 2: Get a fresh Page Access Token via /me/accounts
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${refreshedUserToken}&limit=100`;
    const pagesRes = await fetch(pagesUrl);
    let freshPageToken = current.token; // fallback to current page token

    if (pagesRes.ok) {
      const pagesBody: {
        data: Array<{ id: string; access_token: string }>;
      } = await pagesRes.json();
      const targetPage = pagesBody.data.find(
        (p) => p.id === current.pageId
      );
      if (targetPage?.access_token) {
        freshPageToken = targetPage.access_token;
      }
    }

    // Step 3: Store both refreshed tokens
    const result: TokenResult = {
      token: freshPageToken,
      userToken: refreshedUserToken,
      igId: current.igId,
      pageId: current.pageId,
    };

    await this.storeToken(userId, {
      token: freshPageToken,
      userToken: refreshedUserToken,
      igId: current.igId,
      pageId: current.pageId,
      expiresAt,
    });

    return result;
  }
}
