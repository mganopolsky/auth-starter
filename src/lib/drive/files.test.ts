import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PAGE_SIZE, buildListQuery, listFolderFiles } from "./files";

const ID = "1AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => vi.unstubAllGlobals());

describe("buildListQuery", () => {
  it("builds the children query for a valid id", () => {
    expect(buildListQuery(ID)).toBe(`'${ID}' in parents and trashed = false`);
  });
  it("refuses ids that could break out of the query", () => {
    expect(() => buildListQuery("x' or 'a'='a")).toThrow();
    expect(() => buildListQuery("short")).toThrow();
  });
});

describe("listFolderFiles", () => {
  it("sends the expected request and returns files with the next page token", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ files: [{ id: "f1", name: "a.pdf", mimeType: "application/pdf" }], nextPageToken: "n1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listFolderFiles("tok", ID, "page2");
    expect(result).toEqual({
      ok: true,
      files: [{ id: "f1", name: "a.pdf", mimeType: "application/pdf" }],
      nextPageToken: "n1",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe(buildListQuery(ID));
    expect(params.get("pageSize")).toBe(String(PAGE_SIZE));
    expect(params.get("pageToken")).toBe("page2");
    expect(params.get("orderBy")).toBe("folder,name");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("returns an empty list when Google returns no files", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    await expect(listFolderFiles("t", ID)).resolves.toEqual({
      ok: true,
      files: [],
      nextPageToken: undefined,
    });
  });

  it("maps 403 and 404 to folder_access_denied with Google's status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await expect(listFolderFiles("t", ID)).resolves.toEqual({
      ok: false,
      reason: "folder_access_denied",
      status: 404,
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
    await expect(listFolderFiles("t", ID)).resolves.toMatchObject({ reason: "folder_access_denied" });
  });

  it("maps 401 to unauthorized and other failures to upstream", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(listFolderFiles("t", ID)).resolves.toMatchObject({ reason: "unauthorized" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    await expect(listFolderFiles("t", ID)).resolves.toMatchObject({ reason: "upstream", status: 503 });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    await expect(listFolderFiles("t", ID)).resolves.toEqual({ ok: false, reason: "upstream" });
  });

  it("rejects an invalid folder id without calling Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(listFolderFiles("t", "bad id")).resolves.toEqual({ ok: false, reason: "invalid_folder" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
