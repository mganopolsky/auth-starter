import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/drive/crypto";
import {
  OAUTH_COOKIE,
  decodeCookie,
  exchangeCode,
  getOrigin,
  safeEqual,
} from "@/lib/drive/oauth";

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const { searchParams } = new URL(request.url);

  function done(error?: string) {
    const url = new URL("/drive", origin);
    if (error) url.searchParams.set("error", error);
    const response = NextResponse.redirect(url);
    // The state/verifier cookie is single-use.
    response.cookies.set(OAUTH_COOKIE, "", { path: "/api/drive", maxAge: 0 });
    return response;
  }

  if (searchParams.get("error")) return done("denied");

  const cookie = decodeCookie(request.headers.get("cookie")?.match(
    new RegExp(`(?:^|; )${OAUTH_COOKIE}=([^;]*)`),
  )?.[1]);
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  if (!cookie || !state || !code || !safeEqual(state, cookie.state)) return done("state");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(`${origin}/login`);

  let grant;
  try {
    grant = await exchangeCode(code, cookie.verifier, origin);
  } catch {
    return done("exchange");
  }
  if (!grant) return done("grant");

  const { error } = await supabase.from("google_drive_connections").upsert(
    {
      user_id: userId,
      refresh_token_enc: encryptToken(grant.refreshToken, userId),
      scopes: grant.scopes,
      revoked_at: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return done("save");

  return done();
}
