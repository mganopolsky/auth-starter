import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/drive/oauth";
import { lookupFolder } from "@/lib/drive/folder";
import { DriveNotConnectedError, getDriveAccessToken } from "@/lib/drive/token";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// Saves the folder the user picked, after Google confirms the app can see it.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";

  try {
    const { accessToken } = await getDriveAccessToken(supabase, userId);
    const folder = await lookupFolder(accessToken, id);
    if (!folder.ok) {
      const status = folder.reason === "invalid_id" || folder.reason === "not_a_folder" ? 400 : 422;
      return json({ error: folder.reason, googleStatus: folder.status }, status);
    }

    const { error } = await supabase
      .from("google_drive_connections")
      .update({ folder_id: folder.id, folder_name: folder.name })
      .eq("user_id", userId);
    if (error) return json({ error: "save_failed" }, 500);

    return json({ folderId: folder.id, folderName: folder.name }, 200);
  } catch (error) {
    if (error instanceof DriveNotConnectedError) return json({ error: "not_connected" }, 409);
    return json({ error: "token_failed" }, 502);
  }
}
