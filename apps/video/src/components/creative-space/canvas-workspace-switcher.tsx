"use client";

import { GitBranch, Sparkles } from "lucide-react";
import { useState } from "react";

import { CreativeSpaceStudio } from "./creative-space-studio";
import { CreativeWorkflowStudio } from "./creative-workflow-studio";

interface CanvasWorkspaceSwitcherProps {
  locale: string;
  initialPrompt?: string;
  initialMode?: "canvas" | "workflow";
}

export function CanvasWorkspaceSwitcher({
  locale,
  initialPrompt = "",
  initialMode = "canvas",
}: CanvasWorkspaceSwitcherProps) {
  const zh = locale.toLowerCase().startsWith("zh");
  const [mode, setMode] = useState<"canvas" | "workflow">(initialMode);

  const switchMode = (next: "canvas" | "workflow") => {
    setMode(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "workflow") url.searchParams.set("mode", "workflow");
      else url.searchParams.delete("mode");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  };

  const modePill = (
    <div
      className="inline-flex items-center gap-0.5 rounded-[var(--ds-r-md)] border border-[var(--ds-line-1)] bg-[var(--ds-fill-1)] p-0.5"
      role="tablist"
      aria-label={zh ? "画布工作模式" : "Canvas workspace mode"}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "canvas"}
        onClick={() => switchMode("canvas")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-[var(--ds-r-sm)] px-2.5 text-xs font-semibold transition ${
          mode === "canvas"
            ? "bg-[var(--ds-fill-3)] text-[var(--ds-text-1)] shadow-[var(--ds-specular)]"
            : "text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)]"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {zh ? "即梦画布" : "Infinite Canvas"}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "workflow"}
        onClick={() => switchMode("workflow")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-[var(--ds-r-sm)] px-2.5 text-xs font-semibold transition ${
          mode === "workflow"
            ? "bg-[var(--ds-fill-3)] text-[var(--ds-text-1)] shadow-[var(--ds-specular)]"
            : "text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)]"
        }`}
      >
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        {zh ? "节点工作流" : "Node Workflow"}
      </button>
    </div>
  );

  if (mode === "canvas") {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <CreativeSpaceStudio locale={locale} initialPrompt={initialPrompt} modeSlot={modePill} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-line-1)] bg-[var(--du-bg-elev)] px-4 py-1.5">
        {modePill}
        <span className="hidden text-xs text-[var(--ds-text-3)] md:inline">
          {zh
            ? "ReactFlow 有向节点流水线 · 自动按依赖顺序运行并云端保存"
            : "Directed ReactFlow pipeline with dependency execution & cloud persistence"}
        </span>
      </div>
      <CreativeWorkflowStudio locale={locale} initialPrompt={initialPrompt} />
    </div>
  );
}
