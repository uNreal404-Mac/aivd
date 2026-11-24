/** Take a representative frame so the existing upload safety service can review video assets. */
export function previewFrame(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => { video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); };
    video.onerror = () => { cleanup(); reject(new Error("Unable to read this video.")); };
    const capture = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        cleanup();
        if (!blob) { reject(new Error("Unable to preview this video.")); return; }
        resolve(new File([blob], "video-frame.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.75);
    };
    video.onloadedmetadata = () => {
      const target = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(video.duration / 2, Math.max(0, video.duration - 0.1)) : 0;
      if (target > 0) video.currentTime = target;
      else video.onloadeddata = capture;
    };
    video.onseeked = capture;
    video.src = url;
  });
}

export async function uploadWorkflowVideo(file: File): Promise<{ key: string; url: string }> {
  if (file.size > 25 * 1024 * 1024) throw new Error("Videos must be 25 MB or smaller.");
  const form = new FormData();
  form.set("file", file);
  form.set("frame", await previewFrame(file));
  const response = await fetch("/api/v1/creative-space/video-assets", { method: "POST", body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message ?? "Video upload failed.");
  return { key: payload.data.key, url: payload.data.signedUrl };
}
