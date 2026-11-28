"use client";

import { useEffect, useRef, useState } from "react";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { Film, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ExtendDialog, type ExtendSource, type ExtendStarted } from "@/components/hf/extend-dialog";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import { fetchRecentResults, type StudioResult } from "@/lib/ai-video-studio";
import { localizedHref } from "@/lib/locale-path";

type Props = {
  locale: string;
  source: ExtendSource | null;
  onSource: (source: ExtendSource | null) => void;
  onStarted: (job: ExtendStarted) => void;
  onPending: (id: string, prompt?: string) => void;
  generationEnabled: boolean;
  freeGeneration: boolean;
};

export function asExtendSource(row: StudioResult): ExtendSource | null {
  if (row.status !== "completed" || !row.videoUuid || !row.videoUrl) return null;
  return { videoUuid: row.videoUuid, videoUrl: row.videoUrl, prompt: row.prompt, resolution: row.resolution, audio: row.audio };
}

export function ExtendPanel({ locale, source, onSource, onStarted, onPending, generationEnabled, freeGeneration }: Props) {
  const zh = locale.startsWith("zh");
  const { data: session } = useSession();
  const login = useSigninModal();
  const [picker, setPicker] = useState(false);
  const [choices, setChoices] = useState<ExtendSource[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false),
    [fileError, setFileError] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const upload = async (file: File) => {
    const owner = session?.user?.id;
    if (!owner || uploading) return;
    setUploading(true);
    setFileError("");
    try {
      const { key, url } = await uploadWorkflowVideo(file, fetch, owner);
      if (mounted.current) {
        onSource({ videoUuid: "", sourceVideoKey: key, videoUrl: url, prompt: file.name });
        setPicker(false);
      }
    } catch (error) {
      if (mounted.current)
        setFileError(error instanceof Error ? error.message : zh ? "上传失败" : "Upload failed.");
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  useEffect(() => {
    if (!picker || !session?.user?.id) return;
    let current = true;
    setChoices(null);
    setLoadError(false);
    // Request completed clips directly so unfinished jobs never displace choices.
    void fetchRecentResults(fetch, 60, {
      completedOnly: true,
      onError: () => { if (current) setLoadError(true); },
    }).then(rows => {
      if (current) setChoices(rows.map(asExtendSource).filter((item): item is ExtendSource => item !== null));
    });
    return () => { current = false; };
  }, [picker, session?.user?.id, attempt]);

  return <>
    <ExtendDialog freeGeneration={freeGeneration} source={source} zh={zh} onClose={() => onSource(null)} onStarted={onStarted} onPending={onPending}
      inline={{ generationEnabled, chooseSource: () => { if (session?.user?.id) setPicker(true); else login.onOpen(); } }} />
    <Dialog open={picker} onOpenChange={setPicker}>
      <DialogContent className="xd-picker">
        <DialogTitle>{zh ? "选择要延长的视频" : "Choose a video to extend"}</DialogTitle>
        <DialogDescription>{zh ? "上传原视频，或从自己的已完成作品中选择。" : "Upload your source clip or choose a finished creation."}</DialogDescription>
        <button type="button" className="vtool-upload-extend" disabled={uploading} onClick={()=>fileInput.current?.click()}>{uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload/>}{uploading ? (zh ? "上传中…" : "Uploading…") : (zh ? "上传视频" : "Upload video")}</button>
        {uploading ? <output aria-live="polite">{zh ? "视频上传中，完成后会自动添加" : "Uploading the video. It will be added when ready."}</output> : null}
        <input ref={fileInput} type="file" hidden accept="video/mp4,video/quicktime,video/webm" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value="";}}/>
        {fileError && <output role="alert">{fileError}</output>}
        {loadError ? <button type="button" className="xd-retry" onClick={() => setAttempt(count => count + 1)}>{zh ? "加载失败，重试" : "Couldn’t load videos. Retry"}</button>
          : choices === null ? <output>{zh ? "正在加载视频…" : "Loading videos…"}</output>
          : choices.length ? <div className="xd-source-grid">{choices.map(item => (
            <button type="button" key={item.videoUuid} onClick={() => { onSource(item); setPicker(false); }}>
              <video src={item.videoUrl} muted playsInline preload="metadata" />
              <span>{item.prompt || (zh ? "未命名视频" : "Untitled video")}</span>
            </button>
          ))}</div> : <p className="xd-empty"><Film aria-hidden="true" />{zh ? "完成第一段视频后，就可以在这里续写。" : "Your finished videos will appear here."}</p>}
        <Link href={localizedHref(locale, "/my-creations")}>{zh ? "查看我的全部作品" : "View all creations"}</Link>
      </DialogContent>
    </Dialog>
  </>;
}
