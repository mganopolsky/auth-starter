import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { encryptToken } from "./crypto";
import {
  DriveNotConnectedError,
  getDriveAccessToken,
  revokeRefreshToken,
} from "./token";

const USER = "11111111-1111-1111-1111-111111111111";

type Row = { refresh_token_enc: string; revoked_at: string | null } | null;

function fakeSupabase(row: Row, readError = false) {
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: readError ? { message: "x" } : null }),
        }),
      }),
      update,
    })),
  };
  return { client: client as never, update };
}

function connectedRow(): Row {
  return { refresh_token_enc: encryptToken("refresh-token", USER), revoked_at: null };
}

beforeEach(() => {
  process.env.DRIVE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDriveAccessToken", () => {
  it("returns an access token for a connected user", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ access_token: "at", expires_in: 3599 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { client } = fakeSupabase(connectedRow());

    await expect(getDriveAccessToken(client, USER)).resolves.toEqual({
      accessToken: "at",
      expiresIn: 3599,
    });
    const body = (fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-token");
  });

  it("throws DriveNotConnectedError when there is no row", async () => {
    const { client } = fakeSupabase(null);
    await expect(getDriveAccessToken(client, USER)).rejects.toBeInstanceOf(DriveNotConnectedError);
  });

  it("throws DriveNotConnectedError when the row is revoked, without calling Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const row = { ...connectedRow()!, revoked_at: "2026-01-01T00:00:00Z" };
    const { client } = fakeSupabase(row);
    await expect(getDriveAccessToken(client, USER)).rejects.toBeInstanceOf(DriveNotConnectedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the row revoked on invalid_grant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 })),
    );
    const { client, update } = fakeSupabase(connectedRow());
    await expect(getDriveAccessToken(client, USER)).rejects.toBeInstanceOf(DriveNotConnectedError);
    expect(update).toHaveBeenCalledOnce();
    const patch = (update.mock.calls[0] as unknown as [{ revoked_at: string }])[0];
    expect(typeof patch.revoked_at).toBe("string");
  });

  it("throws a generic error that does not echo Google's response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret-body-with-token", { status: 500 })),
    );
    const { client, update } = fakeSupabase(connectedRow());
    const error = await getDriveAccessToken(client, USER).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(DriveNotConnectedError);
    expect((error as Error).message).not.toContain("secret-body");
    expect(update).not.toHaveBeenCalled();
  });

  it("propagates network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network"))));
    const { client } = fakeSupabase(connectedRow());
    await expect(getDriveAccessToken(client, USER)).rejects.toThrow("network");
  });

  it("fails when the stored token belongs to another user", async () => {
    const { client } = fakeSupabase(connectedRow());
    await expect(
      getDriveAccessToken(client, "22222222-2222-2222-2222-222222222222"),
    ).rejects.toThrow();
  });
});

describe("revokeRefreshToken", () => {
  it("returns true on success and false on failure or network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    await expect(revokeRefreshToken("t")).resolves.toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 400 })));
    await expect(revokeRefreshToken("t")).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    await expect(revokeRefreshToken("t")).resolves.toBe(false);
  });
});
