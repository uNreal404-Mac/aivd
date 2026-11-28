"use client";

import { useEffect, useState } from "react";
import { Check, CircleX, List, LayoutDashboard, LayoutGrid, Maximize2, Minimize2, Search } from "lucide-react";
import { moveFocusWithArrows, useAnchoredPopover } from "./use-anchored-popover";

export type HistoryView = {
  layout: "list" | "grid" | "masonry";
  /** Card size, 1 (smallest) to 4 (largest). */
  size: 1 | 2 | 3 | 4;
  /** Fill the card (crop) or fit the whole frame in it. */
  fill: boolean;
};

const DEFAULT_VIEW: HistoryView = { layout: "grid", size: 3, fill: true };
const VIEW_KEY = "aivd:video-history-view";

export function useHistoryView(): [HistoryView, (patch: Partial<HistoryView>) => void] {
  const [view, setView] = useState<HistoryView>(DEFAULT_VIEW);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
      if (!saved || typeof saved !== "object") return;
      const row = saved as Partial<HistoryView>;
      setView({
        layout: row.layout === "masonry" || row.layout === "list" ? row.layout : "grid",
        size: row.size === 1 || row.size === 2 || row.size === 4 ? row.size : 3,
        fill: row.fill !== false,
      });
    } catch {
      // Storage can be blocked; the default view still works.
    }
  }, []);
  const update = (patch: Partial<HistoryView>) =>
    setView((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        // See above.
      }
      return next;
    });
  return [view, update];
}

/** Focus the checked row when a menu opens, so arrows start from it. */
function useFocusFirst(open: boolean, popover: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target =
        popover.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ??
        popover.current?.querySelector<HTMLElement>("button");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, popover]);
}

function BarButton({
  anchorRef,
  open,
  onToggle,
  icon,
  label,
  active = false,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      ref={anchorRef}
      type="button"
      className="vst-bar-button"
      aria-haspopup="menu"
      aria-expanded={open}
      data-active={active || undefined}
      onClick={onToggle}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function ViewMenu({ zh, view, onChange }: { zh: boolean; view: HistoryView; onChange: (patch: Partial<HistoryView>) => void }) {
  const [open, setOpen] = useState(false);
  const popover = useAnchoredPopover<HTMLButtonElement>(open, () => setOpen(false), "bottom-end");
  useFocusFirst(open, popover.popoverRef);
  const layouts = [
    { id: "list" as const, label: zh ? "列表" : "List", Icon: List },
    { id: "grid" as const, label: zh ? "网格" : "Grid", Icon: LayoutGrid },
    { id: "masonry" as const, label: zh ? "瀑布流" : "Masonry", Icon: LayoutDashboard },
  ];
  const sizeLabel = zh ? "卡片大小" : "Card size";
  const fillLabel = view.fill ? (zh ? "铺满卡片，点一下改为完整显示" : "Filling the card. Click to show the whole frame") : zh ? "完整显示，点一下改为铺满卡片" : "Showing the whole frame. Click to fill the card";
  return (
    <>
      <BarButton anchorRef={popover.anchorRef} open={open} onToggle={() => setOpen((was) => !was)} icon={<LayoutGrid aria-hidden="true" />} label={zh ? "查看" : "View"} />
      {popover.mounted ? (
        <div
          ref={popover.popoverRef}
          style={popover.style}
          role="menu"
          aria-label={zh ? "历史记录的显示方式" : "How history is shown"}
          data-presence="pop"
          data-state={popover.state}
          className="vst-menu vst-bar-menu vst-view-menu"
          onKeyDown={moveFocusWithArrows}
        >
          <p className="vst-menu-title">{zh ? "布局" : "Layout"}</p>
          {layouts.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={view.layout === id}
              className="vst-menu-item vst-bar-item"
              onClick={() => onChange({ layout: id })}
            >
              <Icon className="vst-bar-item-icon" aria-hidden="true" />
              <span className="vst-bar-item-label">{label}</span>
              {view.layout === id ? <Check className="vst-menu-check" aria-hidden="true" /> : null}
            </button>
          ))}
          <span className="vst-menu-sep" aria-hidden="true" />
          <p className="vst-menu-title">{sizeLabel}</p>
          <div className="vst-size-row">
            <button
              type="button"
              className="vst-fill-toggle"
              aria-pressed={view.fill}
              title={fillLabel}
              aria-label={zh ? "铺满卡片" : "Fill the card"}
              onClick={() => onChange({ fill: !view.fill })}
            >
              {view.fill ? <Maximize2 key="fill" data-swap aria-hidden="true" /> : <Minimize2 key="fit" data-swap aria-hidden="true" />}
            </button>
            <label className="vst-size">
              <span className="sr-only">{sizeLabel}</span>
              <span className="vst-size-track" aria-hidden="true">
                <span className="vst-size-fill" style={{ width: `${(view.size / 4) * 100}%` }} />
                <span className="vst-size-ticks">
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
                aria-valuetext={zh ? `第 ${view.size} 档，共 4 档` : `Step ${view.size} of 4`}
                onKeyDown={(event) => {
                  // ↑/↓ move between menu rows; ←/→ change the size.
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
                }}
                onChange={(event) => onChange({ size: Number(event.target.value) as HistoryView["size"] })}
              />
            </label>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The filters in force, under the stage bar, each with its own clear. */
export function ActiveFilters({ zh, filters, onClear }: { zh: boolean; filters: { key: string; name: string; clear: () => void }[]; onClear: () => void }) {
  return (
    <div className="vst-active-filters">
      {filters.map(filter => <button key={filter.key} type="button" className="vst-filter-chip" onClick={filter.clear} aria-label={zh ? `移除筛选 ${filter.name}` : `Remove filter ${filter.name}`}>
        {filter.name}<CircleX aria-hidden="true" />
      </button>)}
      <button type="button" className="vst-filter-clear" onClick={onClear}>{zh ? "清除筛选" : "Clear filters"}</button>
    </div>
  );
}

/** Nothing left once the filters apply. */
export function NoMatches({ zh, onClear }: { zh: boolean; onClear: () => void }) {
  return (
    <div className="vst-nomatch du-fade-swap" aria-live="polite">
      <span className="vst-nomatch-icon" aria-hidden="true">
        <Search />
      </span>
      <p className="vst-nomatch-title">{zh ? "没有匹配的视频" : "No matching clips"}</p>
      <p className="vst-nomatch-sub">{zh ? "没有符合当前筛选条件的视频" : "None of your clips fit the current filters"}</p>
      <button type="button" className="vst-nomatch-clear" onClick={onClear}>
        <CircleX aria-hidden="true" />
        {zh ? "清除筛选" : "Clear filters"}
      </button>
    </div>
  );
}
