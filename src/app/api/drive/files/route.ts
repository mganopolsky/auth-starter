import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listFolderFiles } from "@/lib/drive/files";
import { DriveNotConnectedError, getDriveAccessToken } from "@/lib/drive/token";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// Lists the files in the user's saved folder. The folder id always comes from the
// user's own row (RLS), never from the request.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);

  const pageToken = new URL(request.url).searchParams.get("pageToken") ?? undefined;
  if (pageToken && pageToken.length > 2000) return json({ error: "bad_request" }, 400);

  const { data: row, error } = await supabase
    .from("google_drive_connections")
    .select("folder_id, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return json({ error: "read_failed" }, 500);
  if (!row || row.revoked_at) return json({ error: "not_connected", reconnect: true }, 401);
  if (!row.folder_id) return json({ error: "no_folder" }, 409);

  try {
    const { accessToken } = await getDriveAccessToken(supabase, userId);
    const result = await listFolderFiles(accessToken, row.folder_id, pageToken);
    if (!result.ok) {
      if (result.reason === "folder_access_denied") {
        return json({ error: "folder_access_denied", googleStatus: result.status }, 403);
      }
      return json({ error: "upstream", googleStatus: result.status }, 502);
    }
    return json({ files: result.files, nextPageToken: result.nextPageToken ?? null }, 200);
  } catch (e) {
    if (e instanceof DriveNotConnectedError) {
      return json({ error: "not_connected", reconnect: true }, 401);
    }
    return json({ error: "upstream" }, 502);
  }
}
