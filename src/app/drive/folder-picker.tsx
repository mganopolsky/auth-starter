"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "";
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";

function loadPicker(): Promise<void> {
  return new Promise((resolve, reject) => {
    function loadApi() {
      window.gapi?.load("picker", { callback: () => resolve(), onerror: () => reject() });
    }
    if (window.gapi) return loadApi();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = loadApi;
    script.onerror = () => reject(new Error("Could not load Google Picker"));
    document.head.appendChild(script);
  });
}

const MESSAGES: Record<string, string> = {
  not_accessible: "Google says this app cannot access that folder.",
  not_a_folder: "That item is not a folder.",
  invalid_id: "That folder id is not valid.",
  not_connected: "Google Drive is no longer connected. Please reconnect.",
};

export function FolderPicker({ hasFolder }: { hasFolder: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setError(null);
    setBusy(true);
    try {
      await loadPicker();

      const tokenResponse = await fetch("/api/drive/token", { method: "POST" });
      if (!tokenResponse.ok) {
        setError(MESSAGES.not_connected);
        return;
      }
      const { accessToken } = (await tokenResponse.json()) as { accessToken: string };

      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder");

      new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(PICKER_API_KEY)
        .setAppId(APP_ID)
        .setCallback(async (data) => {
          if (data.action !== google.picker.Action.PICKED || !data.docs?.[0]) return;
          const response = await fetch("/api/drive/folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data.docs[0].id }),
          });
          if (response.ok) {
            router.refresh();
          } else {
            const body = (await response.json().catch(() => ({}))) as {
              error?: string;
              googleStatus?: number;
            };
            const base = MESSAGES[body.error ?? ""] ?? "Could not save the folder.";
            setError(body.googleStatus ? `${base} (Google status ${body.googleStatus})` : base);
          }
        })
        .build()
        .setVisible(true);
    } catch {
      setError("Could not open the folder picker. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={choose} disabled={busy}>
        {hasFolder ? "Change folder" : "Choose folder"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
