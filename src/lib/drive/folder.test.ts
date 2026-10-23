import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FOLDER_ID_PATTERN, FOLDER_MIME_TYPE, lookupFolder } from "./folder";

const ID = "1AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => vi.unstubAllGlobals());

describe("FOLDER_ID_PATTERN", () => {
  it("accepts Drive-style ids and rejects path tricks", () => {
    expect(FOLDER_ID_PATTERN.test(ID)).toBe(true);
    expect(FOLDER_ID_PATTERN.test("short")).toBe(false);
    expect(FOLDER_ID_PATTERN.test("../../etc/passwd")).toBe(false);
    expect(FOLDER_ID_PATTERN.test(`${ID}?fields=*`)).toBe(false);
  });
});

describe("lookupFolder", () => {
  it("rejects an invalid id without calling Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupFolder("t", "../x")).resolves.toEqual({ ok: false, reason: "invalid_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the folder with the name from Google", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: ID, name: "Receipts", mimeType: FOLDER_MIME_TYPE })),
    );
    await expect(lookupFolder("t", ID)).resolves.toEqual({ ok: true, id: ID, name: "Receipts" });
  });

  it("rejects a non-folder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: ID, name: "a.pdf", mimeType: "application/pdf" })),
    );
    await expect(lookupFolder("t", ID)).resolves.toEqual({ ok: false, reason: "not_a_folder" });
  });

  it("reports 403 and 404 as not accessible, with Google's status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await expect(lookupFolder("t", ID)).resolves.toEqual({
      ok: false,
      reason: "not_accessible",
      status: 404,
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
    await expect(lookupFolder("t", ID)).resolves.toMatchObject({ reason: "not_accessible", status: 403 });
  });

  it("reports other failures and network errors as lookup_failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    await expect(lookupFolder("t", ID)).resolves.toMatchObject({ reason: "lookup_failed" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    await expect(lookupFolder("t", ID)).resolves.toEqual({ ok: false, reason: "lookup_failed" });
  });
});
