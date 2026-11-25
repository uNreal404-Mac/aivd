"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Coins, Film, ImagePlus, Loader2, X } from "lucide-react";
import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";
import { submitMedia } from "@/lib/media-studio";
import {
  videoToolModel,
  videoToolMessage,
  type VideoTool,
  type VideoToolOrientation,
  type VideoToolSource,
} from "@/lib/video-tool";
import { useCredits } from "@/stores/credits-store";

type Source = VideoToolSource & { name: string; id: string };
type Character = { key: string; name: string; id: string };
type Draft = {
  prompt: string;
  quality: "720p" | "1080p";
  orientation: VideoToolOrientation;
  source: Source | null;
  character: Character | null;
};
const blank: Draft = {
  prompt: "",
  quality: "720p",
  orientation: "video",
  source: null,
  character: null,
};
function restore(slot: string): Draft {
  try {
    const value = JSON.parse(sessionStorage.getItem(slot) ?? "null");
    if (!value) return blank;
    return {
      prompt: typeof value.prompt === "string" ? value.prompt : "",
      quality: value.quality === "1080p" ? "1080p" : "720p",
      orientation: value.orientation === "image" ? "image" : "video",
      source: value.source?.id ? value.source : null,
      character: value.character?.key ? value.character : null,
    };
  } catch {
    return blank;
  }
}
async function inspect(
  owner: string,
  body: Record<string, unknown>,
  zh: boolean,
  signal?: AbortSignal,
): Promise<{ preview: string; seconds: number }> {
  const res = await fetch("/api/v1/video/tool-source", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Media-Account": owner },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await res.json();
  if (!res.ok || !payload.success)
    throw new Error(
      videoToolMessage(
        payload.error?.details?.code,
        payload.error?.message ??
          (zh ? "读取素材失败。" : "Could not inspect the selected file."),
        zh,
      ),
    );
  return payload.data;
}

export function VideoToolPanel({
  kind,
  active,
  locale,
  owner,
  enabled,
  free,
  onStarted,
  onExtend,
}: {
  kind: VideoTool;
  active: boolean;
  onExtend: () => void;
  locale: string;
  owner?: string;
  enabled: boolean;
  free: boolean;
  onStarted: (uuid: string, prompt: string) => void;
}) {
  const zh = locale.startsWith("zh"),
    motion = kind === "motion",
    model = videoToolModel(kind);
  const label = (cn: string, en: string) => (zh ? cn : en);
  const login = useSigninModal();
  const { invalidate, refetch } = useCredits();
  const slot = `aivd:video-tool:${owner ?? "guest"}:${kind}`;
  const [draft, setDraft] = useState<Draft>(blank);
  const [loaded, setLoaded] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [picker, setPicker] = useState<"video" | "image" | null>(null);
  const [progress, setProgress] = useState(false),
    [sending, setSending] = useState(false);
  const [seconds, setSeconds] = useState(0),
    [video, setVideo] = useState(""),
    [photo, setPhoto] = useState("");
  const [notice, setNotice] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [characterError, setCharacterError] = useState("");
  const mounted = useRef(false),
    locked = useRef(false);
  const sourcePending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    setDraft(restore(slot));
    setLoaded(true);
    return () => {
      mounted.current = false;
    };
  }, [slot]);
  useEffect(() => {
    if (loaded) {
      try {
        if (draft === blank) sessionStorage.removeItem(slot);
        else sessionStorage.setItem(slot, JSON.stringify(draft));
      } catch {
        /* Keep the in-memory draft. */
      }
    }
  }, [draft, loaded, slot]);
  useEffect(() => {
    setSeconds(0);
    setVideo("");
    setSourceError("");
    if (!draft.source || !owner) {
      sourcePending.current = false;
      return;
    }
    sourcePending.current = true;
    const controller = new AbortController();
    inspect(owner, { model, ...draft.source }, zh, controller.signal)
      .then((info) => {
        if (!controller.signal.aborted) {
          setSeconds(info.seconds);
          setVideo(info.preview);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSourceError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) sourcePending.current = false;
      });
    return () => controller.abort();
  }, [draft.source, owner, model]);
  useEffect(() => {
    setPhoto("");
    setCharacterError("");
    if (!draft.character || !owner) return;
    const controller = new AbortController();
    inspect(owner, { characterKey: draft.character.key }, zh, controller.signal)
      .then((info) => {
        if (!controller.signal.aborted) setPhoto(info.preview);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCharacterError(error.message);
      });
    return () => controller.abort();
  }, [draft.character, owner]);
  useEffect(() => {
    if (!active) {
      setPicker(null);
      setToolsOpen(false);
    }
  }, [active]);
  function update(patch: Partial<Draft>) {
    setNotice("");
    setDraft((prev) => ({ ...prev, ...patch }));
  }
  function choose(type: "image" | "video") {
    if (!owner) {
      login.onOpen();
      return;
    }
    setPicker(type);
  }
  async function selected(items: PickerAsset[]) {
    const item = items[0],
      type = picker;
    setPicker(null);
    if (!owner || !type || !item) return;
    setProgress(true);
    setNotice("");
    try {
      const work = /^work:([A-Za-z0-9_-]+):(\d+)$/.exec(item.id);
      if (type === "image") {
        const key = work ? item.id : (await readyPickerImage(item, owner)).key;
        if (mounted.current) {
          setPhoto("");
          update({ character: { key, name: item.name, id: item.id } });
        }
      } else {
        const ref: VideoToolSource = work
          ? { sourceVideoUuid: work[1] }
          : {
              sourceVideoKey:
                item.key ??
                (item.file
                  ? (await uploadWorkflowVideo(item.file, fetch, owner)).key
                  : undefined),
            };
        if (!ref.sourceVideoUuid && !ref.sourceVideoKey)
          throw new Error(
            label("请重新上传这段视频", "Upload the clip again."),
          );
        if (mounted.current) {
          sourcePending.current = true;
          setSeconds(0);
          setVideo("");
          update({ source: { ...ref, name: item.name, id: item.id } });
        }
      }
    } catch (error) {
      if (mounted.current)
        setNotice(
          error instanceof Error
            ? error.message
            : label("素材读取失败", "Could not read the file."),
        );
    } finally {
      if (mounted.current) setProgress(false);
    }
  }
  const market = getMarketModel(model)!;
  const credits = seconds
    ? marketCredits(market, {
        prompt: draft.prompt,
        duration: seconds,
        resolution: draft.quality,
      })
    : null;
  async function generate() {
    if (locked.current || progress) return;
    if (!owner) {
      login.onOpen();
      return;
    }
    if (!draft.source) {
      choose("video");
      return;
    }
    if (motion && !draft.character) {
      choose("image");
      return;
    }
    if (!credits || sourcePending.current || (motion && !photo)) {
      setNotice(
        label(
          "请确认素材格式和时长后再生成。",
          "Check the files and their duration first.",
        ),
      );
      return;
    }
    if (!motion && !draft.prompt.trim()) {
      setNotice(label("请描述希望修改的内容。", "Describe the edit to make."));
      return;
    }
    if (!enabled) {
      setNotice(
        label(
          "当前预览未开启视频生成。",
          "Video generation is unavailable in this preview.",
        ),
      );
      return;
    }
    locked.current = true;
    setSending(true);
    setNotice("");
    try {
      const result = await submitMedia(
        {
          model,
          prompt: draft.prompt.trim(),
          duration: seconds,
          quality: draft.quality,
          expectedCredits: credits,
          ...(draft.source.sourceVideoKey
            ? { sourceVideoKey: draft.source.sourceVideoKey }
            : { sourceVideoUuid: draft.source.sourceVideoUuid! }),
          ...(motion
            ? {
                characterKey: draft.character!.key,
                orientation: draft.orientation,
              }
            : {}),
        },
        zh,
        "/api/v1/video/generate",
        owner,
      );
      if (!mounted.current) return;
      if (!result.ok) {
        setNotice(videoToolMessage(result.code, result.message, zh));
        if (result.needsLogin) login.onOpen();
        return;
      }
      setDraft(blank);
      onStarted(result.uuid, draft.prompt.trim() || market.name);
      invalidate();
      void refetch();
      setNotice(
        label(
          "已提交，可以在历史记录查看进度。",
          "Submitted. Track it in History.",
        ),
      );
    } finally {
      locked.current = false;
      if (mounted.current) setSending(false);
    }
  }
  const sourceLabel = motion
    ? label("添加要复制的动作", "Add motion to copy")
    : label("添加要编辑的视频", "Add a video to edit");
  return (
    <div className="vtool-panel">
      {!motion && (
        <div className="vtool-edit-menu">
          <button
            type="button"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen(!toolsOpen)}
          >
            {label("编辑工具", "Editing tools")}
            <ChevronDown />
          </button>
          {toolsOpen && (
            <div>
              <button type="button" onClick={() => setToolsOpen(false)}>
                {label("编辑视频", "Edit video")}
                <small>{label("精准修改", "Make a precise edit")}</small>
              </button>
              <button type="button" onClick={onExtend}>
                {label("延长视频", "Extend video")}
                <small>
                  {label("生成后续片段", "Generate the next segment")}
                </small>
              </button>
            </div>
          )}
        </div>
      )}
      <div className="vtool-cover">
        <img
          src={
            motion
              ? "/home/samples/rain-couple.webp"
              : "/home/samples/red-carpet.webp"
          }
          alt=""
        />
        <div>
          <strong>
            {motion
              ? label("运动控制", "Motion Control")
              : label("编辑视频", "Edit video")}
          </strong>
          <span>
            {motion
              ? label("用参考视频控制动作", "Copy movement from your reference")
              : label("根据描述修改原视频", "Transform your source clip")}
          </span>
        </div>
      </div>
      <div className={motion ? "vtool-slots vtool-pair" : "vtool-slots"}>
        <div className="vtool-slot">
          <button
            type="button"
            disabled={progress || sending}
            onClick={() => choose("video")}
            aria-label={sourceLabel}
          >
            {video ? (
              <video src={video} preload="metadata" muted playsInline />
            ) : (
              <Film aria-hidden="true" />
            )}
            <strong>{draft.source?.name || sourceLabel}</strong>
            <small>
              {seconds
                ? label(`已核验 ${seconds} 秒`, `Verified · ${seconds}s`)
                : motion
                  ? "MP4 / MOV · 3–30s"
                  : "MP4 / MOV · 3–15.5s"}
            </small>
          </button>
          {draft.source && (
            <button
              className="vtool-remove"
              disabled={sending}
              aria-label={label("移除视频", "Remove video")}
              onClick={() => update({ source: null })}
            >
              <X />
            </button>
          )}
        </div>
        {motion && (
          <div className="vtool-slot">
            <button
              type="button"
              disabled={progress || sending}
              onClick={() => choose("image")}
              aria-label={label("添加你的角色", "Add your character")}
            >
              {photo ? (
                <img src={photo} alt="" />
              ) : (
                <ImagePlus aria-hidden="true" />
              )}
              <strong>
                {draft.character?.name ||
                  label("添加你的角色", "Add your character")}
              </strong>
              <small>
                {label("面部和身体清晰可见", "Face and body clearly visible")}
              </small>
            </button>
            {draft.character && (
              <button
                className="vtool-remove"
                disabled={sending}
                aria-label={label("移除角色", "Remove character")}
                onClick={() => update({ character: null })}
              >
                <X />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="vtool-setting">
        <span>{label("模型", "Model")}</span>
        <strong>{market.name}</strong>
      </div>
      <label className="vtool-setting">
        <span>{label("画质", "Quality")}</span>
        <select
          disabled={sending}
          value={draft.quality}
          onChange={(e) =>
            update({ quality: e.target.value as Draft["quality"] })
          }
        >
          <option>720p</option>
          <option>1080p</option>
        </select>
      </label>
      {motion && (
        <div className="vtool-setting">
          <span>{label("角色朝向参考", "Character orientation")}</span>
          <div className="vtool-segment">
            {(["video", "image"] as const).map((value) => (
              <button
                key={value}
                disabled={sending}
                aria-pressed={draft.orientation === value}
                onClick={() => update({ orientation: value })}
              >
                {value === "video"
                  ? label("视频", "Video")
                  : label("图像", "Image")}
              </button>
            ))}
          </div>
        </div>
      )}
      <details open={!motion || undefined} className="vtool-instruction">
        <summary>
          {motion
            ? label("高级设置", "Advanced settings")
            : label("编辑指令", "Edit instruction")}
          <ChevronDown />
        </summary>
        <textarea
          aria-label={label("提示词", "Prompt")}
          disabled={sending}
          maxLength={market.options.maxPromptLength}
          value={draft.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder={
            motion
              ? label(
                  "补充动作或场景描述（可选）",
                  "Add movement or scene details (optional)",
                )
              : label(
                  "描述要保留的主体，以及要修改的场景或风格…",
                  "Describe what to keep and what to change…",
                )
          }
        />
      </details>
      {draft.source && !seconds && !sourceError && !notice && (
        <small role="status">
          {label("正在核验原视频…", "Checking the source clip…")}
        </small>
      )}
      {(sourceError || characterError) && (
        <output className="vst-notice" role="alert">
          {sourceError || characterError}
        </output>
      )}
      {notice && (
        <output aria-live="polite" className="vst-notice">
          {notice}
        </output>
      )}
      <button
        type="button"
        disabled={progress || sending}
        onClick={generate}
        className="vst-generate"
      >
        {(sending || progress) && <Loader2 className="animate-spin" />}
        {sending ? label("正在提交", "Submitting") : label("生成", "Generate")}
        <span className="vst-generate-cost">
          <Coins />
          {credits !== null ? (free ? 0 : credits) : "—"}
        </span>
      </button>
      {credits !== null && (
        <small className="vtool-rate">
          {label(
            `按源视频 ${seconds} 秒计价，不足一秒按一秒计算。`,
            `Quoted for ${seconds}s of source video, rounded up to whole seconds.`,
          )}
        </small>
      )}
      <HomeMediaPicker
        lang={locale}
        open={picker !== null}
        userId={owner}
        videoToolAsset={picker ?? "video"}
        acceptedTypes={[picker ?? "video"]}
        maxSelected={1}
        initialTab="upload"
        selectedIds={[]}
        onClose={() => setPicker(null)}
        onSelect={(items) => void selected(items)}
      />
    </div>
  );
}
