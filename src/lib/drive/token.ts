import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Thrown when the user has no usable Drive connection (never connected, disconnected, or revoked). */
export class DriveNotConnectedError extends Error {
  constructor() {
    super("Google Drive is not connected");
    this.name = "DriveNotConnectedError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Reads and decrypts the user's refresh token. RLS limits the query to the signed-in user's row. */
export async function getRefreshToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("google_drive_connections")
    .select("refresh_token_enc, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not read Drive connection");
  if (!data || data.revoked_at) return null;
  return decryptToken(data.refresh_token_enc, userId);
}

/**
 * Exchanges the stored refresh token for a short-lived access token.
 * Access tokens are never stored; each call refreshes.
 */
export async function getDriveAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const refreshToken = await getRefreshToken(supabase, userId);
  if (!refreshToken) throw new DriveNotConnectedError();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let reason: unknown;
    try {
      reason = (await response.json())?.error;
    } catch {
      // ignore unparseable body
    }
    if (reason === "invalid_grant") {
      // Revoked in the Google account, or unused for 6 months.
      await supabase
        .from("google_drive_connections")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", userId);
      throw new DriveNotConnectedError();
    }
    // Do not include the response body: Google errors can echo request details.
    throw new Error(`Drive token refresh failed (${response.status})`);
  }

  const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
    throw new Error("Drive token refresh returned an unexpected response");
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}

/** Revokes the refresh token at Google. Returns false on failure; never throws or logs the token. */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    const response = await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
