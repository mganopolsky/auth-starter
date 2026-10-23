import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/drive/oauth";
import { DriveNotConnectedError, getDriveAccessToken } from "@/lib/drive/token";

const NO_STORE = { "Cache-Control": "no-store" };

// Returns a short-lived drive.file access token for the Google Picker, which runs in the browser.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const { accessToken, expiresIn } = await getDriveAccessToken(supabase, userId);
    return NextResponse.json({ accessToken, expiresIn }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof DriveNotConnectedError) {
      return NextResponse.json({ error: "not_connected" }, { status: 409, headers: NO_STORE });
    }
    return NextResponse.json({ error: "token_failed" }, { status: 502, headers: NO_STORE });
  }
}
