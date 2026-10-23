import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrigin, isSameOrigin } from "@/lib/drive/oauth";
import { getRefreshToken, revokeRefreshToken } from "@/lib/drive/token";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });

  const origin = getOrigin(request);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(`${origin}/login`, 303);

  // Revoke at Google first. If that fails we still delete our copy.
  try {
    const refreshToken = await getRefreshToken(supabase, userId);
    if (refreshToken) await revokeRefreshToken(refreshToken);
  } catch {
    // Undecryptable or unreadable row: nothing to revoke; fall through to delete.
  }

  const { error } = await supabase.from("google_drive_connections").delete().eq("user_id", userId);
  const url = new URL("/drive", origin);
  if (error) url.searchParams.set("error", "disconnect");
  return NextResponse.redirect(url, 303);
}
