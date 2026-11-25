"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
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
  generationEnabled: boolean;
  freeGeneration: boolean;
};

export function asExtendSource(row: StudioResult): ExtendSource | null {
  if (row.status !== "completed" || !row.videoUuid || !row.videoUrl) return null;
  return { videoUuid: row.videoUuid, videoUrl: row.videoUrl, prompt: row.prompt, resolution: row.resolution, audio: row.audio };
}

export function ExtendPanel({ locale, source, onSource, onStarted, generationEnabled, freeGeneration }: Props) {
  const zh = locale.startsWith("zh");
  const { data: session } = useSession();
  const login = useSigninModal();
  const [picker, setPicker] = useState(false);
  const [choices, setChoices] = useState<ExtendSource[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
    <ExtendDialog freeGeneration={freeGeneration} source={source} zh={zh} onClose={() => onSource(null)} onStarted={onStarted}
      inline={{ generationEnabled, chooseSource: () => { if (session?.user?.id) setPicker(true); else login.onOpen(); } }} />
    <Dialog open={picker} onOpenChange={setPicker}>
      <DialogContent className="xd-picker">
        <DialogTitle>{zh ? "选择要延长的视频" : "Choose a video to extend"}</DialogTitle>
        <DialogDescription>{zh ? "从我的作品中选择一段已完成的视频。" : "Select a finished clip from your creations."}</DialogDescription>
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
