import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Read-only access to the user's Drive, so the app can list and read the files in a picked folder.
// Restricted scope: public apps need Google verification (see README).
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const OAUTH_COOKIE = "drive_oauth";
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Public origin of this app. Behind a proxy (e.g. Vercel) the host is in x-forwarded-host. */
export function getOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV !== "development") {
    return `https://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/drive/callback`;
}

export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE S256: base64url(sha256(verifier)). RFC 7636. */
export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export type OAuthCookie = { state: string; verifier: string };

export function encodeCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed?.state === "string" && typeof parsed?.verifier === "string") {
      return { state: parsed.state, verifier: parsed.verifier };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function buildAuthUrl(
  origin: string,
  state: string,
  verifier: string,
  loginHint?: string,
): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_DRIVE_CLIENT_ID"),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
  });
  // Pre-selects the signed-in account in Google's account picker.
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenGrant = { refreshToken: string; scopes: string };

/**
 * A usable grant must include a refresh token and the drive.readonly scope.
 * Returns null otherwise (the caller shows a "reconnect" error).
 */
export function parseGrant(body: unknown): TokenGrant | null {
  if (typeof body !== "object" || body === null) return null;
  const { refresh_token, scope } = body as Record<string, unknown>;
  if (typeof refresh_token !== "string" || !refresh_token) return null;
  if (typeof scope !== "string" || !scope.split(" ").includes(DRIVE_SCOPE)) return null;
  return { refreshToken: refresh_token, scopes: scope };
}

export async function exchangeCode(
  code: string,
  verifier: string,
  origin: string,
): Promise<TokenGrant | null> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_DRIVE_CLIENT_SECRET"),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return parseGrant(await response.json());
}

/** CSRF guard for cookie-authenticated POSTs: the Origin header must be our own origin. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === getOrigin(request);
}
