import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deleteAccount } from "./account";

type Overrides = {
  getRefreshToken?: () => Promise<string | null>;
  revokeToken?: (token: string) => Promise<boolean>;
  deleteUser?: (userId: string) => Promise<void>;
};

function deps(o: Overrides = {}) {
  return {
    getRefreshToken: vi.fn(o.getRefreshToken ?? (async () => "refresh-token" as string | null)),
    revokeToken: vi.fn(o.revokeToken ?? (async () => true)),
    deleteUser: vi.fn(o.deleteUser ?? (async () => undefined)),
  };
}

describe("deleteAccount", () => {
  it("revokes the token, then deletes the user", async () => {
    const d = deps();
    await deleteAccount("user-1", d);
    expect(d.revokeToken).toHaveBeenCalledWith("refresh-token");
    expect(d.deleteUser).toHaveBeenCalledWith("user-1");
    expect(d.revokeToken.mock.invocationCallOrder[0]).toBeLessThan(
      d.deleteUser.mock.invocationCallOrder[0],
    );
  });

  it("still deletes when there is no Drive connection", async () => {
    const d = deps({ getRefreshToken: async () => null });
    await deleteAccount("user-1", d);
    expect(d.revokeToken).not.toHaveBeenCalled();
    expect(d.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("still deletes when revocation fails or the token cannot be read", async () => {
    const failedRevoke = deps({ revokeToken: async () => false });
    await deleteAccount("user-1", failedRevoke);
    expect(failedRevoke.deleteUser).toHaveBeenCalled();

    const unreadable = deps({ getRefreshToken: async () => Promise.reject(new Error("x")) });
    await deleteAccount("user-1", unreadable);
    expect(unreadable.deleteUser).toHaveBeenCalled();
  });

  it("throws when the user delete fails", async () => {
    const d = deps({ deleteUser: async () => Promise.reject(new Error("db")) });
    await expect(deleteAccount("user-1", d)).rejects.toThrow("db");
  });
});
