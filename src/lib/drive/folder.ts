import "server-only";

export const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/** Same shape the database enforces on google_drive_connections.folder_id. */
export const FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]{10,100}$/;

export type FolderLookup =
  | { ok: true; id: string; name: string }
  | { ok: false; reason: "invalid_id" | "not_accessible" | "not_a_folder" | "lookup_failed"; status?: number };

/**
 * Confirms with Google that the id is a folder this app can see with the user's token.
 * The name comes from Google, not from the browser.
 */
export async function lookupFolder(accessToken: string, id: string): Promise<FolderLookup> {
  if (!FOLDER_ID_PATTERN.test(id)) return { ok: false, reason: "invalid_id" };

  let response: Response;
  try {
    response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }

  if (response.status === 403 || response.status === 404) {
    return { ok: false, reason: "not_accessible", status: response.status };
  }
  if (!response.ok) return { ok: false, reason: "lookup_failed", status: response.status };

  const file = (await response.json()) as { id?: unknown; name?: unknown; mimeType?: unknown };
  if (typeof file.id !== "string" || typeof file.name !== "string") {
    return { ok: false, reason: "lookup_failed" };
  }
  if (file.mimeType !== FOLDER_MIME_TYPE) return { ok: false, reason: "not_a_folder" };
  return { ok: true, id: file.id, name: file.name };
}
