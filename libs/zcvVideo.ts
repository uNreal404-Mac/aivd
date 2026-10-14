type Box = { type: string; start: number; payload: number; end: number };

function boxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset, false);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error("mp4_box_header_truncated");
      const large = view.getBigUint64(offset + 8, false);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("mp4_box_size_invalid");
      size = Number(large);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) throw new Error("mp4_box_size_invalid");
    found.push({ type, start: offset, payload: offset + headerSize, end: offset + size });
    offset += size;
  }
  if (offset !== end) throw new Error("mp4_box_tail_invalid");
  return found;
}

function child(list: Box[], type: string): Box | undefined {
  return list.find((box) => box.type === type);
}

function boxDuration(bytes: Uint8Array, box: Box): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = bytes[box.payload];
  const timescaleOffset = box.payload + (version === 1 ? 20 : 12);
  const durationOffset = timescaleOffset + 4;
  if (durationOffset + (version === 1 ? 8 : 4) > box.end) return null;
  const timescale = view.getUint32(timescaleOffset, false);
  if (!timescale) return null;
  const duration = version === 1
    ? Number(view.getBigUint64(durationOffset, false))
    : view.getUint32(durationOffset, false);
  return Number.isFinite(duration) ? duration / timescale : null;
}

function trackDimensions(bytes: Uint8Array, tkhd: Box): { width: number; height: number } | null {
  if (tkhd.end - tkhd.payload < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const widthRaw = view.getUint32(tkhd.end - 8, false);
  const heightRaw = view.getUint32(tkhd.end - 4, false);
  return { width: Math.round(widthRaw / 65536), height: Math.round(heightRaw / 65536) };
}

export type ZcvVideoInspection =
  | { ok: true; width: number; height: number; durationSec: number; hasAudio: false }
  | { ok: false; reason: string; width?: number; height?: number; durationSec?: number; hasAudio?: boolean };

/** Read basic ISO-BMFF metadata so delivery is gated on the frozen video spec. */
export function inspectZcvMp4(bytes: Uint8Array): ZcvVideoInspection {
  try {
    const top = boxes(bytes, 0, bytes.byteLength);
    if (!child(top, "ftyp")) return { ok: false, reason: "mp4_ftyp_missing" };
    const moov = child(top, "moov");
    if (!moov) return { ok: false, reason: "mp4_moov_missing" };
    if (!top.some((box) => box.type === "mdat" && box.end > box.payload)) return { ok: false, reason: "mp4_mdat_missing" };
    const moovChildren = boxes(bytes, moov.payload, moov.end);
    const videoTracks: Array<{ width: number; height: number; durationSec: number }> = [];
    let hasAudio = false;
    for (const trak of moovChildren.filter((box) => box.type === "trak")) {
      const trackChildren = boxes(bytes, trak.payload, trak.end);
      const mdia = child(trackChildren, "mdia");
      if (!mdia) continue;
      const mediaChildren = boxes(bytes, mdia.payload, mdia.end);
      const hdlr = child(mediaChildren, "hdlr");
      if (!hdlr || hdlr.end - hdlr.payload < 12) continue;
      const handler = String.fromCharCode(bytes[hdlr.payload + 8], bytes[hdlr.payload + 9], bytes[hdlr.payload + 10], bytes[hdlr.payload + 11]);
      if (handler === "soun") hasAudio = true;
      if (handler !== "vide") continue;
      const tkhd = child(trackChildren, "tkhd");
      const mdhd = child(mediaChildren, "mdhd");
      if (!tkhd || !mdhd) continue;
      const dimensions = trackDimensions(bytes, tkhd);
      const durationSec = boxDuration(bytes, mdhd);
      if (dimensions && durationSec !== null) videoTracks.push({ ...dimensions, durationSec });
    }
    if (videoTracks.length !== 1) return { ok: false, reason: "mp4_video_track_invalid", hasAudio };
    const video = videoTracks[0];
    if (video.width !== 1920 || video.height !== 1080) return { ok: false, reason: "video_resolution_invalid", ...video, hasAudio };
    if (video.durationSec < 9.5 || video.durationSec > 10.5) return { ok: false, reason: "video_duration_invalid", ...video, hasAudio };
    if (hasAudio) return { ok: false, reason: "video_audio_track_present", ...video, hasAudio };
    return { ok: true, ...video, hasAudio: false };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "mp4_metadata_invalid" };
  }
}
