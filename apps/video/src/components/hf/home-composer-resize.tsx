"use client";

import { useRef, type PointerEvent } from "react";

type Size = { width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The top-right grip expands the text area upwards and the card outwards. */
export function HomeComposerResize({ zh, onResize }: { zh: boolean; onResize: (size: Size) => void }) {
  const drag = useRef<(Size & { x: number; y: number; id: number }) | null>(null);
  const label = zh ? "调整输入框大小" : "Resize prompt";
  const resize = (width: number, height: number) => onResize({
    width: clamp(width, 600, Math.min(1200, document.documentElement.clientWidth - 32)),
    height: clamp(height, 158, 420),
  });
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== drag.current?.id) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <button type="button" className="du-composer-resize" aria-label={label}
    title={zh ? "拖动或使用方向键调整大小" : "Drag or use arrow keys to resize"}
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const box = event.currentTarget.form?.getBoundingClientRect();
      if (!box) return;
      drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, width: box.width, height: box.height };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }}
    onPointerMove={(event) => {
      const start = drag.current;
      if (start?.id === event.pointerId) resize(start.width + event.clientX - start.x, start.height + start.y - event.clientY);
    }}
    onPointerCancel={release} onPointerUp={release} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={(event) => {
      const keys: Record<string, [number, number]> = { ArrowUp: [0, 16], ArrowDown: [0, -16], ArrowLeft: [-16, 0], ArrowRight: [16, 0] };
      const change = keys[event.key];
      const box = event.currentTarget.form?.getBoundingClientRect();
      if (!box || !change) return;
      event.preventDefault();
      resize(box.width + change[0], box.height + change[1]);
    }}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </button>;
}
