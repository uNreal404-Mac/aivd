import { beforeEach, expect, it, vi } from "vitest";
import { canUseHomeKeyframe, prepareHomeKeyframes, remapHomeKeyframeMentions } from "@/lib/home-keyframes";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";

vi.mock("@/lib/home-media-library", () => ({ readyPickerImage: vi.fn() }));
const picture = (id: string): PickerAsset => ({ id, name: id, mimeType: "image/png", key: `uploads/mary/${id}`, url: `/preview/${id}` });
const [first, left, right, last] = ["first", "left", "right", "last"].map(picture);
beforeEach(() => vi.clearAllMocks());

it("retains slot identity when middle frames move or either endpoint is removed", () => {
  const frames = { first, middle: [left, right], last };
  expect(remapHomeKeyframeMentions("@图片1 → @Image2 / @图片3 → @图片4", frames, { first, middle: [right, left], last })).toBe("@图片1 → @Image3 / @图片2 → @图片4");
  expect(remapHomeKeyframeMentions("@图片1 → @Image2 / @图片3 → @图片4", frames, { middle: [left, right], last })).toBe(" → @Image1 / @图片2 → @图片3");
});

it("uses stable work references, rejects another user's upload and requires an image", async () => {
  const work = { ...first, id: "work:example:2", key: "https://private.test/signed" };
  expect(canUseHomeKeyframe(work)).toBe(false);
  expect(canUseHomeKeyframe({ ...first, key: "uploads/other/photo" }, "mary")).toBe(false);
  expect(canUseHomeKeyframe({ ...first, mimeType: "video/mp4" }, "mary")).toBe(false);
  const result = await prepareHomeKeyframes({ last: work }, "mary", () => true, vi.fn());
  expect(result).toEqual({ last: { key: work.id, name: work.name, url: work.url } });
  expect(readyPickerImage).not.toHaveBeenCalled();
});

it("keeps repeated roles and caches a successful guest upload before the next file fails", async () => {
  const guest = { ...first, key: undefined, file: new File(["guest"], "guest.png", { type: "image/png" }) };
  const stored = { key: "uploads/mary/frame.png", url: "/preview/frame", name: "first", sourceId: first.id };
  vi.mocked(readyPickerImage).mockResolvedValueOnce(stored).mockRejectedValueOnce(new Error("upload failed"));
  const uploaded = vi.fn();
  await expect(prepareHomeKeyframes({ first: guest, middle: [guest], last }, "mary", () => true, uploaded)).rejects.toThrow("upload failed");
  expect(readyPickerImage).toHaveBeenCalledTimes(2);
  expect(uploaded).toHaveBeenCalledWith(guest, { key: stored.key, name: first.name, url: stored.url });
});
