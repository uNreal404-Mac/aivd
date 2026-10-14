type TestMp4Options = { width?: number; height?: number; durationSec?: number; audio?: boolean };

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, out.length, false);
  out.set([...type].map((char) => char.charCodeAt(0)), 4);
  out.set(payload, 8);
  return out;
}

function join(...items: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(items.reduce((sum, item) => sum + item.length, 0));
  let offset = 0;
  for (const item of items) { out.set(item, offset); offset += item.length; }
  return out;
}

function track(width: number, height: number, durationSec: number, handler: "vide" | "soun"): Uint8Array {
  const tkhd = new Uint8Array(84);
  const tkhdView = new DataView(tkhd.buffer);
  tkhdView.setUint32(tkhd.length - 8, width * 65536, false);
  tkhdView.setUint32(tkhd.length - 4, height * 65536, false);
  const mdhd = new Uint8Array(24);
  const mdhdView = new DataView(mdhd.buffer);
  mdhdView.setUint32(12, 1000, false);
  mdhdView.setUint32(16, durationSec * 1000, false);
  const hdlr = new Uint8Array(12);
  hdlr.set([...handler].map((char) => char.charCodeAt(0)), 8);
  return box("trak", join(box("tkhd", tkhd), box("mdia", join(box("mdhd", mdhd), box("hdlr", hdlr)))));
}

export function testMp4(options: TestMp4Options = {}): Uint8Array {
  const { width = 1920, height = 1080, durationSec = 10, audio = false } = options;
  const ftyp = box("ftyp", new Uint8Array(8));
  const video = track(width, height, durationSec, "vide");
  const tracks = audio ? join(video, track(0, 0, durationSec, "soun")) : video;
  return join(ftyp, box("moov", tracks), box("mdat", new Uint8Array([1, 2, 3, 4])));
}
