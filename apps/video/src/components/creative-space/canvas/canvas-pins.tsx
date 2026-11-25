"use client";

import { Check, Ellipsis, Pin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Node } from "reactflow";
import { PIN_COLORS, type CanvasData, type PinColor } from "@/lib/creative-space/canvas-graph";

const LABEL: Record<PinColor, string> = { red: "红色", yellow: "黄色", green: "绿色", blue: "蓝色", purple: "紫色" };
const nameOf = (color: PinColor, zh: boolean) => zh ? LABEL[color] : color;

function Swatch({ color }: { color: PinColor }) {
  return <span aria-hidden="true" className={`nc-pin-dot pin-${color}`} />;
}

export function NodePins({ pins = [], zh, selected, onChange }: {
  pins?: PinColor[];
  zh: boolean;
  selected: boolean;
  onChange: (next: PinColor[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!selected) setOpen(false); }, [selected]);
  return (
    <div className="nc-node-pins nodrag nopan" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {pins.map((color) => <Swatch key={color} color={color} />)}
      {selected && <button ref={trigger} type="button" className="nc-pin-trigger" aria-label={zh ? "标记节点" : "Pin node"} title={zh ? "标记节点" : "Pin node"} aria-expanded={open} onClick={() => setOpen(!open)}><Pin size={15} /></button>}
      {selected && open && <div className="nc-pin-picker" onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
        {PIN_COLORS.map((color) => <button key={color} type="button" aria-label={nameOf(color, zh)} title={nameOf(color, zh)} aria-pressed={pins.includes(color)} onClick={() => onChange(pins.includes(color) ? pins.filter((pin) => pin !== color) : [...pins, color])}>
          <Swatch color={color} />{pins.includes(color) && <Check size={12} aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}

function thumbnail(data: CanvasData): string | undefined {
  if (data.kind === "media" && data.media === "image") return data.url;
  if (data.kind === "image") return data.urls?.[data.resultIndex ?? 0];
}

export function PinRail({ nodes, zh, pick, clear, label }: {
  nodes: Node<CanvasData>[];
  zh: boolean;
  pick: (node: Node<CanvasData>) => void;
  clear: (color?: PinColor) => void;
  label: (node: Node<CanvasData>) => string;
}) {
  const [active, setActive] = useState<PinColor | "all" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as globalThis.Node)) setActive(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [active]);
  const colors = PIN_COLORS.filter((color) => nodes.some((node) => node.data.pins?.includes(color)));
  if (!colors.length) return null;
  const colorNodes = active && active !== "all" ? nodes.filter((n) => n.data.pins?.includes(active)) : [];
  const show = (key: PinColor | "all") => { setActive(key); setPreview(null); };
  return (
    <nav className="nc-pin-rail" ref={ref} aria-label={zh ? "已标记节点" : "Pinned nodes"} onMouseLeave={() => setActive(null)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setActive(null); }}>
      {colors.map((color) => {
        const count = nodes.filter((n) => n.data.pins?.includes(color)).length;
        return <button type="button" key={color} aria-label={`${nameOf(color, zh)} (${count})`} aria-expanded={active === color} onMouseEnter={() => show(color)} onFocus={() => show(color)} onClick={() => show(color)}><Swatch color={color} /><small>{count}</small></button>;
      })}
      <button type="button" aria-label={zh ? "管理标记" : "Manage pins"} aria-expanded={active === "all"} onMouseEnter={() => show("all")} onFocus={() => show("all")} onClick={() => show("all")}><Ellipsis size={16} /></button>
      {active && (active === "all" || colorNodes.length > 0) && <div className="nc-pin-flyout">
        {active === "all" ? <>
          {colors.map((color) => <button key={color} type="button" onClick={() => clear(color)}><Swatch color={color} />{zh ? "清除" : "Clear "}{nameOf(color, zh)}</button>)}
          <button type="button" onClick={() => { clear(); setActive(null); }}>{zh ? "清除所有标记" : "Clear all pins"}</button>
        </> : <div className="nc-pinned-nodes">{colorNodes.map((node) => {
          const img = thumbnail(node.data);
          return <button type="button" key={node.id} onMouseEnter={() => setPreview(img ?? null)} onFocus={() => setPreview(img ?? null)} onClick={() => { pick(node); setActive(null); }}>
            {img && <img src={img} alt="" />}<span>{label(node)}</span>
          </button>;
        })}</div>}
        {preview && <img className="nc-pin-preview" src={preview} alt="" />}
      </div>}
    </nav>
  );
}
