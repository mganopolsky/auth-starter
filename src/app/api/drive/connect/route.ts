import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE_SECONDS,
  buildAuthUrl,
  encodeCookie,
  getOrigin,
  randomUrlToken,
} from "@/lib/drive/oauth";

export async function GET(request: Request) {
  const origin = getOrigin(request);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.redirect(`${origin}/login`);

  const state = randomUrlToken();
  const verifier = randomUrlToken();

  const response = NextResponse.redirect(buildAuthUrl(origin, state, verifier));
  response.cookies.set(OAUTH_COOKIE, encodeCookie({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/drive",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
