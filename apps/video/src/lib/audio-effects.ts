export type VoiceEffect = "broadcast" | "telephone" | "robot";

function encodeWav(audio: AudioBuffer): Blob {
  const channels = audio.numberOfChannels;
  const dataBytes = audio.length * channels * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF"); view.setUint32(4, dataBytes + 36, true); tag(8, "WAVE");
  tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  tag(36, "data"); view.setUint32(40, dataBytes, true);
  const tracks = Array.from({ length: channels }, (_, index) => audio.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < audio.length; frame++) {
    for (const track of tracks) {
      const sample = Math.min(1, Math.max(-1, track[frame]));
      view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Render the recording at its original pace; a video contributes its audio track. */
export async function renderVoiceEffect(file: File, effect: VoiceEffect): Promise<Blob> {
  const sampleRate = 24000;
  if (file.size > 32 * 1024 * 1024) throw new Error("limit");
  const decoder = new OfflineAudioContext(1, 1, sampleRate);
  const audio = await decoder.decodeAudioData(await file.arrayBuffer());
  if (audio.duration > 180 || audio.length === 0) throw new Error("limit");
  const ctx = new OfflineAudioContext(Math.min(2, audio.numberOfChannels), audio.length, sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = audio;
  const filter = ctx.createBiquadFilter();
  source.connect(filter);
  if (effect === "telephone") {
    filter.type = "highpass"; filter.frequency.value = 420;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass"; lowpass.frequency.value = 2700;
    filter.connect(lowpass).connect(ctx.destination);
  } else if (effect === "broadcast") {
    filter.type = "lowshelf"; filter.frequency.value = 225; filter.gain.value = 5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24; compressor.ratio.value = 5;
    filter.connect(compressor).connect(ctx.destination);
  } else {
    filter.type = "highpass"; filter.frequency.value = 100;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = 43;
    oscillator.connect(gain.gain);
    filter.connect(gain).connect(ctx.destination);
    oscillator.start();
  }
  source.start();
  return encodeWav(await ctx.startRendering());
}
