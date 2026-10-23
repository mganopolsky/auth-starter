import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DRIVE_SCOPE,
  buildAuthUrl,
  codeChallenge,
  decodeCookie,
  encodeCookie,
  getOrigin,
  isSameOrigin,
  parseGrant,
  safeEqual,
} from "./oauth";

beforeEach(() => {
  process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
});

describe("codeChallenge", () => {
  it("matches the RFC 7636 example", () => {
    expect(codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("buildAuthUrl", () => {
  it("requests only drive.file, offline, with PKCE and forced consent", () => {
    const url = new URL(buildAuthUrl("http://localhost:3000", "st", "ver"));
    const p = url.searchParams;
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(p.get("scope")).toBe(DRIVE_SCOPE);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("include_granted_scopes")).toBe("true");
    expect(p.get("state")).toBe("st");
    expect(p.get("code_challenge")).toBe(codeChallenge("ver"));
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("redirect_uri")).toBe("http://localhost:3000/api/drive/callback");
    expect(p.get("client_id")).toBe("client-id");
  });

  it("adds login_hint only when given", () => {
    const withHint = new URL(buildAuthUrl("http://localhost:3000", "s", "v", "a@b.com"));
    expect(withHint.searchParams.get("login_hint")).toBe("a@b.com");
    const without = new URL(buildAuthUrl("http://localhost:3000", "s", "v"));
    expect(without.searchParams.has("login_hint")).toBe(false);
  });

  it("throws when the client id is missing", () => {
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    expect(() => buildAuthUrl("http://localhost:3000", "s", "v")).toThrow(/not set/);
  });
});

describe("cookie", () => {
  it("round-trips", () => {
    expect(decodeCookie(encodeCookie({ state: "a", verifier: "b" }))).toEqual({
      state: "a",
      verifier: "b",
    });
  });
  it("rejects missing or malformed values", () => {
    expect(decodeCookie(undefined)).toBeNull();
    expect(decodeCookie("not-base64-json")).toBeNull();
    expect(decodeCookie(Buffer.from('{"state":1}').toString("base64url"))).toBeNull();
  });
});

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("parseGrant", () => {
  it("accepts a refresh token with drive.file", () => {
    expect(parseGrant({ refresh_token: "rt", scope: `openid ${DRIVE_SCOPE}` })).toEqual({
      refreshToken: "rt",
      scopes: `openid ${DRIVE_SCOPE}`,
    });
  });
  it("rejects a missing refresh token, missing scope, or bad body", () => {
    expect(parseGrant({ scope: DRIVE_SCOPE })).toBeNull();
    expect(parseGrant({ refresh_token: "rt", scope: "openid" })).toBeNull();
    expect(parseGrant(null)).toBeNull();
  });
});

describe("getOrigin", () => {
  it("uses the request origin by default", () => {
    expect(getOrigin(new Request("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
});

describe("isSameOrigin", () => {
  const url = "http://localhost:3000/api/drive/token";
  it("accepts a matching Origin header", () => {
    expect(isSameOrigin(new Request(url, { headers: { origin: "http://localhost:3000" } }))).toBe(true);
  });
  it("rejects a different or missing Origin header", () => {
    expect(isSameOrigin(new Request(url, { headers: { origin: "https://evil.example" } }))).toBe(false);
    expect(isSameOrigin(new Request(url))).toBe(false);
  });
});
