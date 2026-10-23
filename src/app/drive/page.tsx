import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FileList } from "./file-list";
import { FolderPicker } from "./folder-picker";

const ERRORS: Record<string, string> = {
  state: "The connection request could not be verified. Please try again.",
  exchange: "Could not reach Google. Please try again.",
  grant: "Google did not return the access we need. Please try again.",
  save: "Could not save the connection. Please try again.",
  disconnect: "Could not disconnect. Please try again.",
};

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("google_drive_connections")
    .select("connected_at, revoked_at, folder_id, folder_name")
    .maybeSingle();
  const revoked = Boolean(connection?.revoked_at);
  const connected = Boolean(connection && !revoked);

  const deniedMessage = connected
    ? "You cancelled the request. Your existing Google Drive connection is unchanged."
    : "You cancelled the request. Google Drive is not connected.";
  const message = error === "denied" ? deniedMessage : error && (ERRORS[error] ?? "Something went wrong.");

  return (
    <>
      <h1>Google Drive</h1>
      {message && <p role="alert">{message}</p>}
      {revoked && !message && (
        <p role="alert">Google Drive access was revoked. Please reconnect.</p>
      )}
      <p>Status: {connected ? "Connected" : "Not connected"}</p>
      {connected && (
        <>
          <p>Folder: {connection?.folder_name ?? "None chosen"}</p>
          <FolderPicker hasFolder={Boolean(connection?.folder_id)} />
          {connection?.folder_id && <FileList key={connection.folder_id} />}
        </>
      )}
      {connected ? (
        <form action="/api/drive/disconnect" method="post">
          <button type="submit">Disconnect Google Drive</button>
        </form>
      ) : (
        <a href="/api/drive/connect">Connect Google Drive</a>
      )}
      <p>
        <Link href="/">Back</Link>
      </p>
    </>
  );
}
