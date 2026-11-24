"use client";

// The "View" button above the results: grid or masonry layout, grouping by
// day and card size. The choice is remembered on this device.
import { useEffect, useRef, useState } from "react";
import { Check, LayoutDashboard, LayoutGrid } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { moveFocus, useDismiss } from "./bar-menu";

export type ImageView = {
  layout: "grid" | "masonry";
  byDate: boolean;
  /** Card size, 1 (smallest) to 4 (largest). */
  size: 1 | 2 | 3 | 4;
};

const DEFAULT_VIEW: ImageView = { layout: "masonry", byDate: false, size: 3 };
const STORAGE_KEY = "aivd:image-view";

export function useImageView(): [ImageView, (patch: Partial<ImageView>) => void] {
  const [view, setView] = useState<ImageView>(DEFAULT_VIEW);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (!saved || typeof saved !== "object") return;
      const row = saved as Partial<ImageView>;
      setView({
        layout: row.layout === "grid" ? "grid" : "masonry",
        byDate: row.byDate === true,
        size: row.size === 1 || row.size === 2 || row.size === 4 ? row.size : 3,
      });
    } catch {
      // Storage can be blocked; the default view still works.
    }
  }, []);
  const update = (patch: Partial<ImageView>) =>
    setView((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // See above.
      }
      return next;
    });
  return [view, update];
}

export function ViewMenu({ zh, view, onChange }: { zh: boolean; view: ImageView; onChange: (patch: Partial<ImageView>) => void }) {
  const [open, setOpen] = useState(false);
  const presence = usePresence(open);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  useDismiss(open, close, wrapRef);
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }, [open]);

  const layouts = [
    { id: "grid" as const, label: zh ? "方格" : "Grid", Icon: LayoutGrid },
    { id: "masonry" as const, label: zh ? "瀑布流" : "Masonry", Icon: LayoutDashboard },
  ];
  const sizeLabel = zh ? "卡片大小" : "Card size";

  return (
    <div ref={wrapRef} className="is-view">
      <button
        ref={buttonRef}
        type="button"
        className="is-view-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        <span>{zh ? "查看" : "View"}</span>
      </button>
      {presence.mounted ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={zh ? "结果的显示方式" : "How results are shown"}
          data-presence="pop"
          data-state={presence.state}
          className="is-pop is-view-pop"
          onKeyDown={moveFocus}
        >
          <p className="is-pop-title">{zh ? "布局" : "Layout"}</p>
          {layouts.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={view.layout === id}
              data-menu-item
              className="is-pop-item"
              onClick={() => onChange({ layout: id })}
            >
              <span className="is-pop-icon">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="is-pop-text">
                <span className="is-pop-label">{label}</span>
              </span>
              {view.layout === id ? <Check className="is-pop-check" aria-hidden="true" /> : null}
            </button>
          ))}
          <span className="is-pop-sep" aria-hidden="true" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={view.byDate}
            data-menu-item
            className="is-pop-item"
            onClick={() => onChange({ byDate: !view.byDate })}
          >
            <span className="is-pop-text">
              <span className="is-pop-label">{zh ? "按日期分组" : "Group by date"}</span>
            </span>
            <span className={view.byDate ? "is-switch is-switch-on" : "is-switch"} aria-hidden="true" />
          </button>
          <span className="is-pop-sep" aria-hidden="true" />
          <p className="is-pop-title">{sizeLabel}</p>
          <label className="is-size">
            <span className="sr-only">{sizeLabel}</span>
            <span className="is-size-track" aria-hidden="true">
              <span className="is-size-fill" style={{ width: `${(view.size / 4) * 100}%` }} />
              <span className="is-size-ticks">
                <i />
                <i />
                <i />
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={view.size}
              data-menu-item
              aria-valuetext={zh ? `第 ${view.size} 档，共 4 档` : `Step ${view.size} of 4`}
              onKeyDown={(event) => {
                // ↑/↓ move between menu rows; ←/→ change the size.
                if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
              }}
              onChange={(event) => onChange({ size: Number(event.target.value) as ImageView["size"] })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
