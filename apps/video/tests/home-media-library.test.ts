import { beforeEach, describe, expect, it, vi } from "vitest";
import { readyPickerImage } from "@/lib/home-media-library";
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
    expect(uploadImage).toHaveBeenCalledWith(file);
    expect(result).toEqual({ key: "uploads/user/guest.png", name: "guest.png", url: "https://assets.example/guest", sourceId: "guest-1" });
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
