import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/lib/account";
import { getOrigin, isSameOrigin } from "@/lib/drive/oauth";
import { getRefreshToken, revokeRefreshToken } from "@/lib/drive/token";

// Deletes the signed-in user's own account. The user id always comes from the session.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });

  const origin = getOrigin(request);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(`${origin}/login`, 303);

  try {
    await deleteAccount(userId, {
      getRefreshToken: () => getRefreshToken(supabase, userId),
      revokeToken: revokeRefreshToken,
      deleteUser: async (id) => {
        const { error } = await createAdminClient().auth.admin.deleteUser(id);
        if (error) throw new Error("Could not delete user");
      },
    });
  } catch {
    return NextResponse.redirect(`${origin}/?error=delete`, 303);
  }

  // The session cookie is now for a user that no longer exists; clear it.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.redirect(`${origin}/login?deleted=1`, 303);
}
