"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { ArrowUp, Bot, Check, Coins, ImagePlus, Loader2, X } from "lucide-react";

import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { useSession } from "@/lib/auth/client";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { type PickerAsset } from "@/lib/home-media-library";
import { localizedHref } from "@/lib/du-home";

type AgentPlan = {
  reply: string;
  generationPrompt: string;
  steps: { assetLabel: string; title: string; instruction: string }[];
};

function responseMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return fallback;
}

async function visualFile(asset: PickerAsset, label: string): Promise<File> {
  const blob = asset.file ?? await (async () => {
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error("Unable to read the selected asset");
    return response.blob();
  })();
  const mimeType = blob.type || asset.mimeType;
  if (!new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]).has(mimeType) || blob.size > 10 * 1024 * 1024) {
    throw new Error("Invalid image asset");
  }
  return new File([blob], `${label}__${asset.name}`, { type: mimeType });
}

export function CreativeAgentComposer({ lang, active, brief, onBriefChange, inputRef }: {
  lang: string;
  active: boolean;
  brief: string;
  onBriefChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const { data: session } = useSession();
  const signIn = useSigninModal();
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const changeBrief = (value: string) => {
    onBriefChange(value);
    setPlan(null);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brief.trim() || planning) return;
    if (!session) {
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }
    setPlanning(true);
    setPlan(null);
    setError("");
    try {
      const data = new FormData();
      data.set("action", "plan");
      data.set("instruction", brief.trim());
      data.set("locale", lang);
      data.set("assets", JSON.stringify(assets.map((asset, index) => ({
        id: asset.id,
        label: String.fromCharCode(65 + index),
        name: asset.name,
        type: "image",
      }))));
      for (const [index, asset] of assets.entries()) {
        data.append("visual", await visualFile(asset, String.fromCharCode(65 + index)));
      }
      const response = await fetch("/api/v1/creative-space/agent", { method: "POST", body: data });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
        throw new Error(responseMessage(payload, zh ? "Agent 暂时不可用，请稍后重试。" : "The Agent is unavailable. Try again shortly."));
      }
      if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Invalid Agent response");
      const result = payload.data as AgentPlan;
      if (typeof result.reply !== "string") throw new Error("Invalid Agent response");
      setPlan(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (zh ? "Agent 暂时不可用。" : "The Agent is unavailable."));
    } finally {
      setPlanning(false);
    }
  };

  return <div className="cs-agent-panel" hidden={!active}>
    <HomeMediaPicker
      lang={lang}
      open={pickerOpen && active}
      onClose={() => setPickerOpen(false)}
      onSelect={(items) => { setAssets(items); setPlan(null); setError(""); }}
      onDelete={(id) => { setAssets((current) => current.filter((item) => item.id !== id)); setPlan(null); }}
      maxSelected={5}
      selectedIds={assets.map((asset) => asset.id)}
      userId={session?.user?.id}
    />
    <form ref={formRef} className="cs-composer cs-agent-form" onSubmit={(event) => void submit(event)}>
      <div className="cs-agent-input-row">
        <button type="button" className="cs-agent-add" onClick={() => setPickerOpen(true)} aria-label={zh ? "添加参考图片" : "Add reference images"} title={zh ? "从素材库添加图片" : "Add images from the library"}>
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
        </button>
        <textarea
          ref={inputRef}
          value={brief}
          onChange={(event) => changeBrief(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) formRef.current?.requestSubmit(); }}
          rows={3}
          maxLength={2000}
          placeholder={zh ? "告诉 Agent 你的创意目标，可用 @A、@B 引用参考图……" : "Tell the Agent what to create. Use @A or @B to reference images…"}
          aria-label={zh ? "Agent 创作目标" : "Agent creative brief"}
          className="cs-input"
        />
      </div>
      {assets.length ? <div className="cs-agent-assets">{assets.map((asset, index) => <div key={asset.id} className="cs-agent-asset">
        <button type="button" onClick={() => changeBrief(`${brief}${brief && !/\s$/.test(brief) ? " " : ""}@${String.fromCharCode(65 + index)} `)} title={zh ? `引用 ${asset.name}` : `Mention ${asset.name}`}><img src={asset.url} alt="" /><span>@{String.fromCharCode(65 + index)}</span></button>
        <button type="button" className="cs-agent-asset-remove" onClick={() => { setAssets((current) => current.filter((item) => item.id !== asset.id)); setPlan(null); }} aria-label={zh ? `移除 ${asset.name}` : `Remove ${asset.name}`}><X className="h-3 w-3" /></button>
      </div>)}</div> : null}
      <div className="cs-composer-bar cs-agent-bar">
        <button type="button" className="cs-chip-btn" onClick={() => setPickerOpen(true)}><ImagePlus className="h-4 w-4" aria-hidden="true" />{zh ? "添加素材" : "Add assets"}</button>
        <span className="cs-meta"><Bot className="h-4 w-4" aria-hidden="true" />DeepSeek Agent</span>
        <span className="cs-cost"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{zh ? "计划免费" : "Free plan"}</span>
        <button type="submit" className="cs-send" disabled={!brief.trim() || planning} aria-label={zh ? "发送给 Agent" : "Send to Agent"}>{planning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}</button>
      </div>
    </form>
    {error ? <p role="alert" className="cs-agent-error">{error}</p> : null}
    {plan ? <section className="cs-agent-plan" aria-live="polite">
      <div className="cs-agent-plan-head"><span><Check className="h-4 w-4" aria-hidden="true" />{zh ? "Agent 创作计划" : "Agent plan"}</span><Link href={`${localizedHref(lang, "/creative-space/canvas")}?prompt=${encodeURIComponent(plan.generationPrompt || brief)}`}>{zh ? "在画布中继续" : "Continue on canvas"}</Link></div>
      <p>{plan.reply}</p>
      {plan.steps?.length ? <ol>{plan.steps.map((step, index) => <li key={`${step.assetLabel}-${index}`}><strong>{step.title}</strong><span>{step.instruction}</span></li>)}</ol> : null}
      {plan.generationPrompt ? <div className="cs-agent-generation-prompt"><span>{zh ? "生成提示词" : "Generation prompt"}</span><p>{plan.generationPrompt}</p></div> : null}
    </section> : null}
  </div>;
}
