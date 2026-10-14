import assert from "node:assert/strict";
import test from "node:test";
import { inspectZcvMp4 } from "../libs/zcvVideo";

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

function videoTrack(width: number, height: number, durationSec: number, handler = "vide"): Uint8Array {
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

function mp4(width = 1920, height = 1080, durationSec = 10, audio = false, includeMediaData = true): Uint8Array {
  const ftyp = box("ftyp", new Uint8Array(8));
  const video = videoTrack(width, height, durationSec);
  const tracks = audio ? join(video, videoTrack(0, 0, durationSec, "soun")) : video;
  const mdat = includeMediaData ? box("mdat", new Uint8Array([1, 2, 3, 4])) : new Uint8Array();
  return join(ftyp, box("moov", tracks), mdat);
}

test("only a silent 10-second 1920x1080 MP4 meets the delivery spec", () => {
  const reason = (bytes: Uint8Array) => {
    const result = inspectZcvMp4(bytes);
    return result.ok ? "unexpected_video_spec_success" : result.reason;
  };
  assert.deepEqual(inspectZcvMp4(mp4()), { ok: true, width: 1920, height: 1080, durationSec: 10, hasAudio: false });
  assert.equal(reason(mp4(1280, 720)), "video_resolution_invalid");
  assert.equal(reason(mp4(1920, 1080, 5)), "video_duration_invalid");
  assert.equal(reason(mp4(1920, 1080, 10, true)), "video_audio_track_present");
  assert.equal(reason(mp4(1920, 1080, 10, false, false)), "mp4_mdat_missing");
});
