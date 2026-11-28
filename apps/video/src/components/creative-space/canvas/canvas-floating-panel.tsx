"use client";

import { Grip, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./canvas-floating-panel.css";

export function CanvasFloatingPanel({ title, onClose, children, className = "", width = 520, id }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  width?: number;
  id?: string;
}) {
  const [position, setPosition] = useState(() => ({
    x: typeof window === "undefined" ? 24 : Math.max(12, Math.round((window.innerWidth - width) / 2)),
    y: 92,
  }));
  const panel = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const start = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { pointer: event.pointerId, x: position.x, y: position.y, startX: event.clientX, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const box = panel.current?.getBoundingClientRect();
    const w = box?.width ?? width;
    const h = box?.height ?? 300;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - w - 8, current.x + event.clientX - current.startX)),
      y: Math.max(8, Math.min(window.innerHeight - Math.min(h, 120), current.y + event.clientY - current.startY)),
    });
  };
  if (typeof document === "undefined") return null;
  return createPortal(<dialog open ref={panel} id={id} className={`nc-floating ${className}`} style={{ left: position.x, top: position.y, "--nc-floating-width": `${width}px` } as CSSProperties} aria-label={title} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <header className="nc-floating-head" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <div><Grip size={15} aria-hidden="true" /><strong>{title}</strong></div>
      <button type="button" aria-label="Close" title="Close" onClick={onClose}><X size={17} /></button>
    </header>
    <div className="nc-floating-body">{children}</div>
  </dialog>, document.body);
}
