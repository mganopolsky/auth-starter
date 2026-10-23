import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" throws outside a server bundle; stub it for unit tests.
vi.mock("server-only", () => ({}));

import { decryptToken, encryptToken } from "./crypto";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const REFRESH_TOKEN = "1//0gExampleRefreshTokenValue-abc_123";

const newKey = (bytes = 32) => randomBytes(bytes).toString("base64");

describe("drive token crypto", () => {
  const originalKey = process.env.DRIVE_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.DRIVE_TOKEN_ENCRYPTION_KEY = newKey();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
    else process.env.DRIVE_TOKEN_ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a token", () => {
    const stored = encryptToken(REFRESH_TOKEN, USER_A);
    expect(decryptToken(stored, USER_A)).toBe(REFRESH_TOKEN);
  });

  it("round-trips empty and unicode strings", () => {
    expect(decryptToken(encryptToken("", USER_A), USER_A)).toBe("");
    expect(decryptToken(encryptToken("tôken-日本語-🔑", USER_A), USER_A)).toBe("tôken-日本語-🔑");
  });

  it("produces a different value each time for the same input", () => {
    expect(encryptToken(REFRESH_TOKEN, USER_A)).not.toBe(encryptToken(REFRESH_TOKEN, USER_A));
  });

  it("uses the v1 format and does not contain the plaintext", () => {
    const stored = encryptToken(REFRESH_TOKEN, USER_A);
    expect(stored.split(".")).toHaveLength(4);
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("1//");
    expect(stored).not.toContain(REFRESH_TOKEN);
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, ct] = encryptToken(REFRESH_TOKEN, USER_A).split(".");
    const bytes = Buffer.from(ct, "base64");
    bytes[0] ^= 0xff;
    expect(() => decryptToken([v, iv, tag, bytes.toString("base64")].join("."), USER_A)).toThrow(
      "Could not decrypt token",
    );
  });

  it("rejects a tampered auth tag", () => {
    const [v, iv, tag, ct] = encryptToken(REFRESH_TOKEN, USER_A).split(".");
    const bytes = Buffer.from(tag, "base64");
    bytes[0] ^= 0xff;
    expect(() => decryptToken([v, iv, bytes.toString("base64"), ct].join("."), USER_A)).toThrow(
      "Could not decrypt token",
    );
  });

  it("rejects the wrong key", () => {
    const stored = encryptToken(REFRESH_TOKEN, USER_A);
    process.env.DRIVE_TOKEN_ENCRYPTION_KEY = newKey();
    expect(() => decryptToken(stored, USER_A)).toThrow("Could not decrypt token");
  });

  it("rejects the wrong user id", () => {
    const stored = encryptToken(REFRESH_TOKEN, USER_A);
    expect(() => decryptToken(stored, USER_B)).toThrow("Could not decrypt token");
  });

  it("rejects an unknown version", () => {
    const stored = encryptToken(REFRESH_TOKEN, USER_A).replace(/^v1\./, "v2.");
    expect(() => decryptToken(stored, USER_A)).toThrow("Unsupported encrypted token version: v2");
  });

  it("rejects malformed values", () => {
    expect(() => decryptToken("not-a-token", USER_A)).toThrow("Malformed encrypted token");
    expect(() => decryptToken("v1.a.b", USER_A)).toThrow("Malformed encrypted token");
    expect(() => decryptToken("v1.AAAA.BBBB.CCCC", USER_A)).toThrow("Malformed encrypted token");
  });

  it("fails clearly when the key is missing", () => {
    delete process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken(REFRESH_TOKEN, USER_A)).toThrow("DRIVE_TOKEN_ENCRYPTION_KEY is not set");
    expect(() => decryptToken("v1.a.b.c", USER_A)).toThrow(/Malformed|DRIVE_TOKEN_ENCRYPTION_KEY/);
  });

  it("rejects a key that is not 32 bytes", () => {
    for (const bytes of [16, 24, 33]) {
      process.env.DRIVE_TOKEN_ENCRYPTION_KEY = newKey(bytes);
      expect(() => encryptToken(REFRESH_TOKEN, USER_A)).toThrow("exactly 32 bytes");
    }
  });
});
