"use client";

import { useCallback, useEffect, useState } from "react";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

type Page = { files: DriveFile[]; nextPageToken: string | null } | { error: string };

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

async function fetchPage(pageToken?: string): Promise<Page> {
  try {
    const url = pageToken
      ? `/api/drive/files?pageToken=${encodeURIComponent(pageToken)}`
      : "/api/drive/files";
    const response = await fetch(url);
    const body = (await response.json()) as {
      files?: DriveFile[];
      nextPageToken?: string | null;
      error?: string;
      googleStatus?: number;
    };
    if (response.ok) return { files: body.files ?? [], nextPageToken: body.nextPageToken ?? null };
    if (body.error === "folder_access_denied") {
      return { error: `Google says this app cannot read that folder (status ${body.googleStatus}).` };
    }
    if (body.error === "not_connected") {
      return { error: "Google Drive is no longer connected. Please reconnect." };
    }
    return { error: "Could not load files. Please try again." };
  } catch {
    return { error: "Could not load files. Please try again." };
  }
}

export function FileList() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((page: Page, append: boolean) => {
    if ("error" in page) {
      setError(page.error);
    } else {
      setError(null);
      setFiles((previous) => (append ? [...previous, ...page.files] : page.files));
      setNextPageToken(page.nextPageToken);
      setLoaded(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPage().then((page) => {
      if (!cancelled) apply(page, false);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  function loadMore(token: string) {
    setLoading(true);
    void fetchPage(token).then((page) => apply(page, true));
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      {loaded && files.length === 0 && <p>No files visible to this app in this folder.</p>}
      {files.length > 0 && (
        <table>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Type</th>
              <th align="left">Modified</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>
                  {file.webViewLink ? (
                    <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                      {file.name}
                    </a>
                  ) : (
                    file.name
                  )}
                </td>
                <td>{file.mimeType === FOLDER_MIME_TYPE ? "Folder" : file.mimeType}</td>
                <td>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nextPageToken && (
        <button type="button" onClick={() => loadMore(nextPageToken)} disabled={loading}>
          Load more
        </button>
      )}
      {loading && <p>Loading…</p>}
    </>
  );
}
