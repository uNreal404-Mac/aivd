"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  CloudCheck,
  Coins,
  Ellipsis,
  Layers,
  LayoutGrid,
  Link2,
  LoaderCircle,
  Map,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PreviewBadge } from "@/components/layout/preview-badge";

interface Props {
  zh: boolean;
  title: string;
  onTitle: (value: string) => void;
  back: string;
  creditsHref: string;
  contactHref: string;
  save: string;
  saveState: string;
  account: boolean;
  balance: number | null;
  signIn: () => void;
  canvases: { id: string; name: string }[];
  canvasId: string | null;
  onChoose: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
  onDeleteCanvas: (id: string) => void;
  onHome: () => void;
  agentOpen: boolean;
  toggleAgent: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  arrange: () => void;
  edgesOn: boolean;
  toggleEdges: () => void;
  mapOn: boolean;
  toggleMap: () => void;
}
export function CanvasHeader(p: Props) {
  const l = (cn: string, en: string) => (p.zh ? cn : en);
  const [open, setOpen] = useState<"list" | "more" | null>(null);
  const [filter, setFilter] = useState("");
  const [renaming, setRenaming] = useState(false);
  const root = useRef<HTMLElement>(null);
  const name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) {
      name.current?.focus();
      name.current?.select();
    }
  }, [renaming]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const act = (fn: () => void) => {
    setOpen(null);
    fn();
  };
  const Status = p.saveState === "error" ? CircleAlert : p.saveState === "saving" ? LoaderCircle : CloudCheck;
  return (
    <header ref={root} className="nc-glass-header">
      <button type="button" className="nc-home-brand" onClick={p.onHome} title={l("保存并返回首页", "Save and return home")}>
        <img src="/logo.svg" alt="" width={28} height={28} />
        <strong>aivd.ai</strong>
        <PreviewBadge lang={p.zh ? "zh" : "en"} />
      </button>
      <div className="nc-project-chip">
        <Link
          aria-label={l("返回创作空间", "Back to Creative Space")}
          title={l("返回创作空间", "Back to Creative Space")}
          href={p.back}
        >
          <Layers size={18} />
        </Link>
        {renaming ? (
          <input
            ref={name}
            aria-label={l("画布名称", "Canvas name")}
            value={p.title}
            maxLength={100}
            onChange={(e) => p.onTitle(e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button
            className="nc-project-name"
            type="button"
            aria-expanded={open === "list"}
            onClick={() => {
              setFilter("");
              setOpen(open === "list" ? null : "list");
            }}
          >
            <span>{p.title || l("未命名画布", "Untitled canvas")}</span>
            <ChevronDown size={14} />
          </button>
        )}
        <span className="nc-status-icon" role="status" aria-label={p.save} title={p.save}>
          <Status size={15} />
        </span>
        {open === "list" && (
          <section className="nc-chip-pop nc-project-list">
            <label>
              <Search size={15} />
              <input
                autoFocus
                aria-label={l("搜索画布", "Search canvases")}
                placeholder={l("搜索画布", "Search canvases")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <button type="button" onClick={() => act(() => setRenaming(true))}>
              <Pencil size={15} />
              {l("重命名当前画布", "Rename canvas")}
            </button>
            {p.canvases
              .filter((x) => x.name.toLowerCase().includes(filter.toLowerCase()))
              .map((c) => (
                <div className="nc-canvas-list-row" key={c.id}>
                  <button type="button" onClick={() => act(() => p.onChoose(c.id))}>
                    <Layers size={15} /><span>{c.name}</span>{p.canvasId === c.id && <Check size={14} />}
                  </button>
                  <button type="button" className="nc-canvas-row-delete" aria-label={`${l("删除", "Delete")} ${c.name}`} title={l("删除画布", "Delete canvas")}
                    onClick={() => act(() => p.onDeleteCanvas(c.id))}><Trash2 size={15} /></button>
                </div>
              ))}
            <button type="button" onClick={() => act(p.account ? p.onNew : p.signIn)}>
              <Plus size={15} />
              {l("新建画布", "New canvas")}
            </button>
            {p.canvasId && (
              <button type="button" onClick={() => act(p.onDelete)}>
                <Trash2 size={15} />
                {l("删除当前画布", "Delete this canvas")}
              </button>
            )}
          </section>
        )}
      </div>
      <div className="nc-session-tools">
        <button className="nc-round" type="button" aria-pressed={p.agentOpen} aria-label={l("切换 Agent 对话", "Toggle Agent chat")}
          title={l("Agent 对话", "Agent chat")} onClick={p.toggleAgent}><MessageCircle size={18} /></button>
        <button
          className="nc-round"
          type="button"
          aria-expanded={open === "more"}
          aria-label={l("更多操作", "More actions")}
          title={l("更多操作", "More actions")}
          onClick={() => setOpen(open === "more" ? null : "more")}
        >
          <Ellipsis size={18} />
        </button>
        {p.account ? (
          <Link className="nc-account-chip" href={p.creditsHref} title={l("可用积分", "Available credits")}>
            <Coins size={15} />
            {p.balance ?? "…"}
          </Link>
        ) : (
          <button type="button" className="nc-account-chip" onClick={p.signIn}>
            {l("登录", "Sign in")}
          </button>
        )}
        {open === "more" && (
          <section className="nc-chip-pop nc-more-list">
            <button type="button" disabled={!p.canUndo} onClick={() => act(p.undo)}>
              <Undo2 size={16} />
              {l("撤销", "Undo")}
            </button>
            <button type="button" disabled={!p.canRedo} onClick={() => act(p.redo)}>
              <Redo2 size={16} />
              {l("重做", "Redo")}
            </button>
            <button type="button" onClick={() => act(p.arrange)}>
              <LayoutGrid size={16} />
              {l("自动整理", "Auto-arrange")}
            </button>
            <button type="button" aria-pressed={p.edgesOn} onClick={p.toggleEdges}>
              <Link2 size={16} />
              {l("显示连线", "Show wires")}
              {p.edgesOn && <Check size={14} />}
            </button>
            <button type="button" aria-pressed={p.mapOn} onClick={p.toggleMap}>
              <Map size={16} />
              {l("小地图", "Minimap")}
              {p.mapOn && <Check size={14} />}
            </button>
            {p.account && (
              <Link href={p.creditsHref}>
                <Coins size={16} />
                {l("积分记录", "Credit history")}
              </Link>
            )}
            <Link href={p.contactHref}>
              <Mail size={16} />
              {l("联系我们", "Contact us")}
            </Link>
            <Link href={p.back}>
              <ArrowLeft size={16} />
              {l("返回创作空间", "Back to Creative Space")}
            </Link>
          </section>
        )}
      </div>
    </header>
  );
}
