import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/drive")).toBe("/drive");
  });
  it("uses the fallback for empty or unsafe values", () => {
    expect(safeNextPath(null, "/drive")).toBe("/drive");
    expect(safeNextPath("https://evil.com", "/drive")).toBe("/drive");
    expect(safeNextPath("//evil.com", "/drive")).toBe("/drive");
    expect(safeNextPath("/\\evil.com", "/drive")).toBe("/drive");
  });
  it("defaults the fallback to /", () => {
    expect(safeNextPath(undefined)).toBe("/");
  });
});
