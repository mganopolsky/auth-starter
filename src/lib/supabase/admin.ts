import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the project's secret key. It bypasses row-level security.
 *
 * This is the ONLY place the secret key is used. Import it only from server code that has
 * already checked who the signed-in user is, and only for admin calls that cannot be done
 * as the user (today: deleting the user's own auth record). Never expose it to the browser
 * and never prefix the env var with NEXT_PUBLIC_.
 * https://supabase.com/docs/guides/api/api-keys
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
