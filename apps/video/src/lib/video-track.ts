/** Inspect a non-fragmented MP4/MOV video track. Movie length alone can include audio. */
export function readVideoTrack(bytes: Uint8Array): {
  seconds: number;
  width: number;
  height: number;
  fps: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bad = () => {
    throw new Error("Unreadable video track");
  };
  const word = (p: number) => view.getUint32(p);
  const tag = (p: number) => String.fromCharCode(...bytes.subarray(p, p + 4));
  type Box = { start: number; end: number; type: string };
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start + 8 <= end) {
      const size = word(start);
      const length =
        size === 0
          ? end - start
          : size === 1
            ? Number(view.getBigUint64(start + 8))
            : size;
      const header = size === 1 ? 16 : 8;
      if (length < header || start + length > end || result.length > 4096)
        bad();
      result.push({
        start: start + header,
        end: start + length,
        type: tag(start + 4),
      });
      start += length;
    }
    if (start !== end) bad();
    return result;
  }
  const child = (box: Box, type: string) =>
    boxes(box.start, box.end).find((b) => b.type === type) ?? bad();
  const movie = child({ start: 0, end: bytes.length, type: "" }, "moov");
  const movieChildren = boxes(movie.start, movie.end);
  if (movieChildren.some((box) => box.type === "mvex")) bad();
  let result:
    | { seconds: number; width: number; height: number; fps: number }
    | undefined;
  for (const track of movieChildren.filter((box) => box.type === "trak")) {
    const media = child(track, "mdia");
    const handler = child(media, "hdlr");
    if (handler.start + 12 > handler.end || tag(handler.start + 8) !== "vide")
      continue;
    if (result) bad();
    const tkhd = child(track, "tkhd");
    const mdhd = child(media, "mdhd");
    if (bytes[mdhd.start] > 1) bad();
    const offset = bytes[mdhd.start] === 1 ? 20 : 12;
    if (tkhd.end - tkhd.start < 8 || mdhd.start + offset + 4 > mdhd.end) bad();
    const width = word(tkhd.end - 8) / 65536;
    const height = word(tkhd.end - 4) / 65536;
    const scale = word(mdhd.start + offset);
    const timing = child(child(child(media, "minf"), "stbl"), "stts");
    const entries = word(timing.start + 4);
    if (!entries || timing.start + 8 + entries * 8 !== timing.end) bad();
    let ticks = 0,
      frames = 0;
    for (let i = timing.start + 8; i < timing.end; i += 8) {
      const count = word(i),
        delta = word(i + 4);
      if (!count || !delta) bad();
      ticks += count * delta;
      frames += count;
    }
    const seconds = ticks / scale;
    if (!scale || !Number.isSafeInteger(ticks) || !seconds || !width || !height)
      bad();
    // Some movie timelines include a long edited segment, audio tail or slow motion.
    // Do not quote such a clip using only its unedited video samples.
    const header = child(movie, "mvhd");
    const version = bytes[header.start];
    const timescale = header.start + (version === 1 ? 20 : 12);
    if (timescale + (version === 1 ? 12 : 8) > header.end) bad();
    const movieSeconds =
      (version === 1
        ? Number(view.getBigUint64(timescale + 4))
        : word(timescale + 4)) / word(timescale);
    if (
      !Number.isFinite(movieSeconds) ||
      Math.abs(movieSeconds - seconds) > 0.12
    )
      bad();
    result = { seconds: movieSeconds, width, height, fps: frames / seconds };
  }
  return result ?? bad();
}

/** Skip media data and fetch only the movie header from private storage. */
export async function readMovieBox(
  size: number,
  read: (start: number, end: number) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  let position = 0;
  let buffer = new Uint8Array(0) as Uint8Array;
  let bufferStart = 0;
  for (
    let boxesRead = 0;
    boxesRead < 256 && position + 8 <= size;
    boxesRead++
  ) {
    if (
      position < bufferStart ||
      position + Math.min(16, size - position) > bufferStart + buffer.length
    ) {
      bufferStart = position;
      buffer = await read(position, Math.min(size, position + 65536) - 1);
    }
    const offset = position - bufferStart,
      view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const shortSize = view.getUint32(offset);
    const length =
      shortSize === 0
        ? size - position
        : shortSize === 1
          ? Number(view.getBigUint64(offset + 8))
          : shortSize;
    if (length < (shortSize === 1 ? 16 : 8) || position + length > size) break;
    if (view.getUint32(offset + 4) === 0x6d6f6f76) {
      if (length > 4 * 1024 * 1024)
        throw new Error("Movie metadata exceeds 4 MB");
      return offset + length <= buffer.length
        ? buffer.subarray(offset, offset + length)
        : read(position, position + length - 1);
    }
    position += length;
  }
  throw new Error("Movie metadata is missing");
}
