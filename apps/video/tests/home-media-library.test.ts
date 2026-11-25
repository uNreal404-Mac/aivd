import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { readyPickerImage, readyPickerVideo } from "@/lib/home-media-library";
import { UploadError, uploadImage } from "@/lib/image-to-video";

vi.mock("@/lib/image-to-video", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/image-to-video")>()), uploadImage: vi.fn() }));

describe("readyPickerImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuses an account upload from the shared library", async () => {
    const result = await readyPickerImage({ id: "upload:uploads/user/one.png", key: "uploads/user/one.png", name: "one.png", mimeType: "image/png", url: "https://assets.example/one" });
    expect(result).toEqual({ key: "uploads/user/one.png", name: "one.png", url: "https://assets.example/one", sourceId: "upload:uploads/user/one.png" });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("uploads a guest library file before using it in a studio", async () => {
    const file = new File(["image"], "guest.png", { type: "image/png" });
    vi.mocked(uploadImage).mockResolvedValue({ ok: true, key: "uploads/user/guest.png", url: "https://assets.example/guest" });
    const result = await readyPickerImage({ id: "guest-1", name: file.name, mimeType: file.type, url: "blob:guest", file });
    expect(uploadImage).toHaveBeenCalledWith(file, fetch, undefined);
    expect(result).toEqual({ key: "uploads/user/guest.png", name: "guest.png", url: "https://assets.example/guest", sourceId: "guest-1" });
  });

  it("binds new uploads to the selected account and rejects an upload from the previous login", async () => {
    const file = new File(["png"], "frame.png", { type: "image/png" });
    const asset = { id: "frame", name: file.name, mimeType: file.type, url: "blob:frame", file };
    vi.mocked(uploadImage).mockResolvedValue({ ok: true, key: "uploads/owner/one.png", url: "signed" });
    await readyPickerImage(asset, "owner");
    expect(uploadImage).toHaveBeenCalledWith(file, fetch, "owner");
    await expect(readyPickerImage({ ...asset, key: "uploads/other/one.png" }, "owner")).rejects.toThrow();
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it("says a guest file that has gone is no longer available", async () => {
    const pending = readyPickerImage({ id: "guest-2", name: "gone.png", mimeType: "image/png", url: "blob:gone" });
    await expect(pending).rejects.toBeInstanceOf(UploadError);
    await expect(pending).rejects.toMatchObject({ code: "missing_item" });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("passes the upload's own error code on", async () => {
    const file = new File(["image"], "guest.png", { type: "image/png" });
    vi.mocked(uploadImage).mockResolvedValue({ ok: false, code: "unauthorized", message: "Sign in to upload." });
    await expect(readyPickerImage({ id: "guest-3", name: file.name, mimeType: file.type, url: "blob:guest", file })).rejects.toMatchObject({ code: "unauthorized" });
  });
});


vi.mock("@/lib/creative-space/upload-video", () => ({ uploadWorkflowVideo: vi.fn() }));

describe("readyPickerVideo", () => {
  const upload = { id: "upload:uploads/alex/clip.mp4", key: "uploads/alex/clip.mp4", url: "https://storage.test/signed", name: "clip.mp4", mimeType: "video/mp4", size: 64 };
  beforeEach(() => vi.clearAllMocks());

  it("hands the account upload key to the generator and keeps the URL for preview", async () => {
    await expect(readyPickerVideo(upload, "alex")).resolves.toEqual({ key: upload.key, name: upload.name, mimeType: upload.mimeType, url: upload.url, sourceId: upload.id });
    expect(uploadWorkflowVideo).not.toHaveBeenCalled();
  });

  it("uploads a guest MOV using the video pipeline after sign-in", async () => {
    const file = new File(["movie"], "ref.mov", { type: "video/quicktime" });
    vi.mocked(uploadWorkflowVideo).mockResolvedValue({ key: "uploads/alex/ref.mov", url: upload.url });
    const result = await readyPickerVideo({ id: "local-1", file, mimeType: file.type, name: file.name, url: "blob:movie" }, "alex");
    expect(uploadWorkflowVideo).toHaveBeenCalledWith(file, fetch, "alex");
    expect(result.mimeType).toBe(file.type);
  });

  it("refuses foreign uploads, URLs used as keys, unsupported types and oversized files", async () => {
    for (const bad of [{ key: "uploads/other/clip.mp4" }, { key: upload.url }, { mimeType: "video/webm" }, { size: 10 * 1024 * 1024 + 1 }]) {
      await expect(readyPickerVideo({ ...upload, ...bad }, "alex")).rejects.toThrow();
    }
    expect(uploadWorkflowVideo).not.toHaveBeenCalled();
  });
});
