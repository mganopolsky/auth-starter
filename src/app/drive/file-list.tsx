"use client";

import { useCallback, useEffect, useState } from "react";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export function FileList() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageToken?: string) => {
    setLoading(true);
    setError(null);
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
      if (!response.ok) {
        if (body.error === "folder_access_denied") {
          setError(`Google says this app cannot read that folder (status ${body.googleStatus}).`);
        } else if (body.error === "not_connected") {
          setError("Google Drive is no longer connected. Please reconnect.");
        } else {
          setError("Could not load files. Please try again.");
        }
        return;
      }
      setFiles((previous) => (pageToken ? [...previous, ...(body.files ?? [])] : (body.files ?? [])));
      setNextPageToken(body.nextPageToken ?? null);
      setLoaded(true);
    } catch {
      setError("Could not load files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        <button type="button" onClick={() => load(nextPageToken)} disabled={loading}>
          Load more
        </button>
      )}
      {loading && <p>Loading…</p>}
    </>
  );
}
