import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  denied: "You declined access. Nothing was connected.",
  state: "The connection request could not be verified. Please try again.",
  exchange: "Could not reach Google. Please try again.",
  grant: "Google did not return the access we need. Please try again.",
  save: "Could not save the connection. Please try again.",
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
    .select("connected_at, revoked_at")
    .maybeSingle();
  const connected = Boolean(connection && !connection.revoked_at);

  return (
    <>
      <h1>Google Drive</h1>
      {error && <p role="alert">{ERRORS[error] ?? "Something went wrong."}</p>}
      {connected ? (
        <p>Drive is connected.</p>
      ) : (
        <a href="/api/drive/connect">Connect Google Drive</a>
      )}
      <p>
        <a href="/">Back</a>
      </p>
    </>
  );
}
