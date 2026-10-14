import { PhotonImage, SamplingFilter, resize } from "@cf-wasm/photon";

const GLYPHS: Record<string, string[]> = {
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
};

function blendPixel(pixels: Uint8Array, width: number, x: number, y: number, rgba: [number, number, number, number]): void {
  const at = (y * width + x) * 4;
  const alpha = rgba[3] / 255;
  const back = 1 - alpha;
  pixels[at] = Math.round(rgba[0] * alpha + pixels[at] * back);
  pixels[at + 1] = Math.round(rgba[1] * alpha + pixels[at + 1] * back);
  pixels[at + 2] = Math.round(rgba[2] * alpha + pixels[at + 2] * back);
  pixels[at + 3] = 255;
}

/** Downscale and permanently burn in a centered PREVIEW mark before storing or returning an image. */
export function makeWatermarkedPreview(input: Uint8Array): { bytes: Uint8Array; contentType: "image/jpeg" } {
  const original = PhotonImage.new_from_byteslice(input);
  let scaled: PhotonImage | null = null;
  let marked: PhotonImage | null = null;
  try {
    const width = original.get_width();
    const height = original.get_height();
    if (width < 1 || height < 1 || width * height > 40_000_000) throw new Error("invalid image dimensions");
    const ratio = Math.min(1, 480 / Math.max(width, height));
    const outWidth = Math.max(1, Math.round(width * ratio));
    const outHeight = Math.max(1, Math.round(height * ratio));
    scaled = resize(original, outWidth, outHeight, SamplingFilter.Lanczos3);
    const pixels = new Uint8Array(scaled.get_raw_pixels());
    const label = "PREVIEW";
    const scale = Math.max(2, Math.min(5, Math.floor(outWidth / 100)));
    const glyphWidth = 5 * scale;
    const gap = 2 * scale;
    const totalWidth = label.length * glyphWidth + (label.length - 1) * gap;
    const bandHeight = 11 * scale;
    const left = Math.max(0, Math.floor((outWidth - totalWidth) / 2));
    const top = Math.max(0, Math.floor((outHeight - bandHeight) / 2));

    for (let y = top; y < Math.min(outHeight, top + bandHeight); y++) {
      for (let x = 0; x < outWidth; x++) blendPixel(pixels, outWidth, x, y, [0, 0, 0, 145]);
    }
    label.split("").forEach((letter, index) => {
      const glyph = GLYPHS[letter];
      glyph.forEach((row, gy) => row.split("").forEach((pixel, gx) => {
        if (pixel !== "1") return;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = left + index * (glyphWidth + gap) + gx * scale + dx;
            const y = top + 2 * scale + gy * scale + dy;
            if (x < outWidth && y < outHeight) blendPixel(pixels, outWidth, x, y, [255, 255, 255, 255]);
          }
        }
      }));
    });

    marked = new PhotonImage(pixels, outWidth, outHeight);
    return { bytes: marked.get_bytes_jpeg(48), contentType: "image/jpeg" };
  } finally {
    marked?.free();
    scaled?.free();
    original.free();
  }
}
