"use client";

import { ArrowUp, ChevronDown, Loader2, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import type { TextData } from "@/lib/creative-space/canvas-graph";
import type { CanvasActions } from "./canvas-nodes";
import { CanvasPrompt } from "./canvas-prompt";
import { InspectorReferences } from "./inspector-references";
import { InspectorFrame, InspectorMenu } from "./inspector-controls";

export { CanvasTextEditor, CanvasTextPreview } from "./canvas-rich-text";

export function CanvasTextInspector({ id, data, actions }: { id: string; data: TextData; actions: CanvasActions }) {
  const { zh } = actions;
  const { data: session } = useSession();
  const signIn = useSigninModal();
  const [mode, setMode] = useState<"prompt" | "plan">("prompt");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const latest = useRef({ ownerId: session?.user?.id, text: data.text });
  latest.current = { ownerId: session?.user?.id, text: data.text };
  useEffect(() => () => { request.current?.abort(); request.current = null; }, [id, session?.user?.id]);
  const instruction = data.instruction ?? "";
  const modeName = mode === "prompt" ? zh ? "视频提示词" : "Video prompt" : zh ? "分镜策划" : "Storyboard";
  const submit = async () => {
    if (request.current) return;
    const owner = session?.user?.id;
    if (!owner) { signIn.onOpen(); return; }
    if (!instruction.trim()) { setMessage(zh ? "请先写下创作需求。" : "Write your creative brief first."); return; }
    const initialText = data.text;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setMessage(""); setRetained("");
    try {
      const body = await actions.agentForm(id, instruction.trim());
      if (controller.signal.aborted || latest.current.ownerId !== owner) return;
      const response = await fetch("/api/v1/creative-space/agent", { method: "POST", headers: { "X-Media-Account": owner }, body, signal: controller.signal });
      const result = await response.json();
      if (controller.signal.aborted || latest.current.ownerId !== owner) return;
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || (zh ? "暂时无法生成，请稍后重试。" : "Generation is temporarily unavailable."));
      }
      const out = result.data;
      const output = mode === "prompt" ? out?.generationPrompt : out?.reply;
      if (typeof output !== "string" || !output.trim()) throw new Error(zh ? "本次没有返回可用文本。" : "No text was returned.");
      if (latest.current.text !== initialText) {
        setMessage(zh ? "正文已编辑，生成结果已保留在下方。" : "The text changed; your generated result is available below.");
        setRetained(output.slice(0, 5000)); return;
      }
      actions.patch(id, { text: output.slice(0, 5000) });
    } catch (err) {
      if (!controller.signal.aborted) setMessage(err instanceof Error ? err.message : zh ? "请求失败，请再试一次。" : "Please try again.");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const [retained, setRetained] = useState("");
  return <InspectorFrame title={zh ? "文本节点参数" : "Text node settings"} kind="text" zh={zh}>
    <InspectorReferences id={id} actions={actions} limit={8} busy={busy} onBusy={setUploading}/>
    <div className="nci-top"><InspectorMenu label={zh ? "快捷提示词" : "Prompt shortcuts"} button={<>{zh ? "快捷提示词" : "Prompt shortcuts"}<WandSparkles/></>}>
      {close => (zh ? ["把以下想法写成视频生成提示词", "为以下场景规划镜头和节奏", "丰富画面的光线、色彩和构图"]
        : ["Write a video generation prompt for this idea", "Plan the shots and pacing for this scene", "Develop the lighting, colors and composition"]).map((text,index) =>
        <button key={text} type="button" className="nci-row" onClick={() => {
          const next = [text, instruction].filter(Boolean).join("\n");
          if (next.length <= 5000) { setMode(index === 1 ? "plan" : "prompt"); actions.patch(id, { instruction: next }); }
          close();
        }}>{text}</button>)}
    </InspectorMenu></div>
    <CanvasPrompt value={instruction} label={zh ? "文本节点提示词" : "Text node prompt"} zh={zh}
      placeholder={zh ? "输入创作需求，输入 @ 引用参考素材…" : "Write a brief; type @ to mention a reference…"}
      list={() => actions.referencesFor(id)} attach={ref => actions.attachReference(id, ref)} change={instruction => actions.patch(id, { instruction })}/>
    {message && <output className="nci-info">{message}</output>}
    {retained && <textarea readOnly aria-label={zh ? "本次生成结果" : "Generated result"} value={retained}/>}
    <div className="nci-bottom">
      <span className="nci-chip">DeepSeek Flash</span>
      <InspectorMenu label={zh ? "文本输出类型" : "Text output"} button={<>{modeName}<ChevronDown/></>}>
        {close => (["prompt","plan"] as const).map(m => <button type="button" className="nci-row" key={m} aria-pressed={mode===m} onClick={() => { setMode(m); close(); }}>
          {m === "prompt" ? zh ? "视频提示词" : "Video prompt" : zh ? "分镜策划" : "Storyboard"}</button>)}
      </InspectorMenu>
      <div className="nci-submit"><span>{zh ? "0 积分" : "0 credits"}</span><button type="button" className="nci-run" disabled={busy || uploading || !instruction.trim()}
        onClick={() => void submit()} aria-label={zh ? "生成文本" : "Generate text"}>{busy ? <Loader2 className="nc-spin"/> : <ArrowUp/>}</button></div>
    </div>
  </InspectorFrame>;
}
