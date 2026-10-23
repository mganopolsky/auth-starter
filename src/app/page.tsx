import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = claims?.claims?.email as string | undefined;

  return (
    <>
      <h1>Signed in</h1>
      <p>{email ?? "Unknown user"}</p>
      <p>
        <Link href="/drive">Google Drive</Link>
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}
