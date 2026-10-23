import "server-only";
import { FOLDER_ID_PATTERN } from "./folder";

export const PAGE_SIZE = 50;

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
};

export type ListResult =
  | { ok: true; files: DriveFile[]; nextPageToken?: string }
  | {
      ok: false;
      reason: "invalid_folder" | "folder_access_denied" | "unauthorized" | "upstream";
      status?: number;
    };

/** Drive query for the direct, non-trashed children of one folder. The id is validated first. */
export function buildListQuery(folderId: string): string {
  if (!FOLDER_ID_PATTERN.test(folderId)) throw new Error("Invalid folder id");
  return `'${folderId}' in parents and trashed = false`;
}

export async function listFolderFiles(
  accessToken: string,
  folderId: string,
  pageToken?: string,
): Promise<ListResult> {
  if (!FOLDER_ID_PATTERN.test(folderId)) return { ok: false, reason: "invalid_folder" };

  const params = new URLSearchParams({
    q: buildListQuery(folderId),
    fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)",
    pageSize: String(PAGE_SIZE),
    orderBy: "folder,name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (pageToken) params.set("pageToken", pageToken);

  let response: Response;
  try {
    response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "upstream" };
  }

  if (response.status === 401) return { ok: false, reason: "unauthorized", status: 401 };
  if (response.status === 403 || response.status === 404) {
    return { ok: false, reason: "folder_access_denied", status: response.status };
  }
  if (!response.ok) return { ok: false, reason: "upstream", status: response.status };

  const body = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
  return { ok: true, files: body.files ?? [], nextPageToken: body.nextPageToken };
}
