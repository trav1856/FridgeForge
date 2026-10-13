import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { serveImageFile, imageTypeForFile } from "@/lib/serve-image-file";

const tmp = mkdtempSync(path.join(os.tmpdir(), "ff-serve-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("serveImageFile (pantry / import / product photo routes)", () => {
  it("serves a file written after startup with image type + nosniff", async () => {
    writeFileSync(path.join(tmp, "abc-123.webp"), Buffer.from("RIFFxxxxWEBP"));
    const res = await serveImageFile(tmp, "abc-123.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("404s missing files, traversal and non-image types", async () => {
    expect((await serveImageFile(tmp, "nope.jpg")).status).toBe(404);
    expect((await serveImageFile(tmp, "..%2Fx.jpg")).status).toBe(404);
    expect((await serveImageFile(tmp, "a..b.jpg")).status).toBe(404);
    expect(imageTypeForFile("x.svg")).toBeNull();
    expect(imageTypeForFile("x.html")).toBeNull();
  });
});
