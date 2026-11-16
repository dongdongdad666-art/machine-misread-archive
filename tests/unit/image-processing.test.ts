import { describe, expect, it, vi } from "vitest";

import {
  processImage,
  rotateProcessedImage,
  type ImageProcessingDependencies,
  type ImageRotationDependencies,
} from "../../src/lib/image-processing";

function dependencies(options?: {
  width?: number;
  height?: number;
  encodedBlobs?: Blob[];
}) {
  const blobs = [...(options?.encodedBlobs ?? [new Blob(["pixels-only"], { type: "image/webp" })])];
  const encode = vi.fn(async () => blobs.shift() ?? blobs.at(-1) ?? new Blob());
  const deps: ImageProcessingDependencies = {
    decode: vi.fn(async () => ({
      source: {} as CanvasImageSource,
      width: options?.width ?? 800,
      height: options?.height ?? 600,
      close: vi.fn(),
    })),
    encode,
    createObjectUrl: vi.fn(() => "blob:processed-preview"),
  };
  return { deps, encode };
}

describe("image preprocessing", () => {
  it("rejects unsupported image MIME types", async () => {
    const { deps } = dependencies();
    const file = new File(["not-an-image"], "object.gif", { type: "image/gif" });

    await expect(processImage(file, deps)).rejects.toThrow("仅支持 JPEG、PNG 或 WebP");
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it("limits the longest edge to 1600 pixels", async () => {
    const { deps, encode } = dependencies({ width: 3200, height: 2400 });

    const result = await processImage(
      new File(["image"], "object.jpg", { type: "image/jpeg" }),
      deps,
    );

    expect(result).toMatchObject({ width: 1600, height: 1200, mimeType: "image/webp" });
    expect(encode).toHaveBeenCalledWith(expect.anything(), 1600, 1200, 0.86);
  });

  it("lowers encoding quality until output is at most 2MB", async () => {
    const oversized = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)]);
    const acceptable = new Blob([new Uint8Array(1024)]);
    const { deps, encode } = dependencies({ encodedBlobs: [oversized, acceptable] });

    const result = await processImage(
      new File(["image"], "object.png", { type: "image/png" }),
      deps,
    );

    expect(result.blob.size).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(encode).toHaveBeenCalledTimes(2);
  });

  it("returns re-encoded pixels without the source EXIF marker", async () => {
    const { deps } = dependencies({
      encodedBlobs: [new Blob(["pixels-only"], { type: "image/webp" })],
    });
    const source = new File(["Exif\u0000\u0000private-location"], "object.jpg", {
      type: "image/jpeg",
    });

    const result = await processImage(source, deps);

    expect(await result.blob.text()).toBe("pixels-only");
    expect(await result.blob.text()).not.toContain("Exif");
  });

  it("rotates the encoded pixels and swaps portrait dimensions", async () => {
    const encodeRotated = vi.fn(async () => new Blob(["rotated"], { type: "image/webp" }));
    const deps: ImageRotationDependencies = {
      decode: vi.fn(async () => ({
        source: {} as CanvasImageSource,
        width: 800,
        height: 1200,
      })),
      encodeRotated,
      createObjectUrl: vi.fn(() => "blob:rotated"),
    };

    const result = await rotateProcessedImage(
      {
        blob: new Blob(["source"]),
        width: 800,
        height: 1200,
        mimeType: "image/webp",
        previewUrl: "blob:source",
      },
      90,
      deps,
    );

    expect(result).toMatchObject({ width: 1200, height: 800, previewUrl: "blob:rotated" });
    expect(encodeRotated).toHaveBeenCalledWith(expect.anything(), 800, 1200, 90, 0.86);
  });
});
