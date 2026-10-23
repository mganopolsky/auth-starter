import "server-only";

export type DeleteAccountDeps = {
  /** The user's stored Drive refresh token, or null if none. */
  getRefreshToken: () => Promise<string | null>;
  /** Revokes the token at Google. Returns false on failure. */
  revokeToken: (token: string) => Promise<boolean>;
  /** Deletes the auth user. Throws on failure. Cascades to profiles and drive connections. */
  deleteUser: (userId: string) => Promise<void>;
};

/**
 * Deletes a user's account: revoke the Drive token at Google (best effort), then delete the
 * auth user. Database rows are removed by `on delete cascade` from auth.users.
 * Revocation failure does not block deletion; a failed user delete throws.
 */
export async function deleteAccount(userId: string, deps: DeleteAccountDeps): Promise<void> {
  try {
    const token = await deps.getRefreshToken();
    if (token) await deps.revokeToken(token);
  } catch {
    // Unreadable or undecryptable row: nothing to revoke. Continue with deletion.
  }
  await deps.deleteUser(userId);
}
