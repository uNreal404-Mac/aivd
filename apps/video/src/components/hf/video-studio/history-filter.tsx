"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Boxes, CalendarDays, Check, ChevronRight, EyeOff, ListFilter } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { zhCN, enUS } from "date-fns/locale";
import { historyRangeStart, HISTORY_RANGES, type HistoryRange } from "../audio-studio/audio-data";
import "./history-filter.css";
import type { StudioResult } from "@/lib/ai-video-studio";

export type VideoHistoryFilter = {
  model: string;
  range: HistoryRange | "custom";
  dates?: DateRange;
  hideFailed: boolean;
};

export const INITIAL_FILTER: VideoHistoryFilter = { model: "", range: "all", hideFailed: false };

export function matchingHistory<T extends { status: string; model?: string; createdAt?: number }>(
  items: T[], filter: VideoHistoryFilter, now: number, hasMedia: (item: T) => boolean,
) {
  const start = filter.range === "custom" ? filter.dates?.from?.getTime() : historyRangeStart(filter.range, now);
  const lastDay = filter.range === "custom" ? filter.dates?.to ?? filter.dates?.from : undefined;
  const end = lastDay ? new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1).getTime() : undefined;
  return items.filter(item =>
    (!filter.model || item.model === filter.model) &&
    (!filter.hideFailed || (item.status !== "failed" && (item.status !== "completed" || hasMedia(item)))) &&
    (start == null || (item.createdAt !== undefined && item.createdAt >= start)) &&
    (end === undefined || (item.createdAt !== undefined && item.createdAt < end))
  );
}

export function matchingVideos(items: StudioResult[], filter: VideoHistoryFilter, now: number) {
  return matchingHistory(items, filter, now, item => Boolean(item.videoUrl));
}

export function rangeName(range: VideoHistoryFilter["range"], zh: boolean) {
  const names = {
    all: ["全部时间", "All time"], today: ["今天", "Today"], "7d": ["最近 7 天", "Last 7 days"],
    "30d": ["最近 30 天", "Last 30 days"], custom: ["自定义日期", "Custom dates"],
  };
  return names[range][zh ? 0 : 1];
}

export function FilterMenu({ zh, filter, models, onChange }: {
  zh: boolean;
  filter: VideoHistoryFilter;
  models: { id: string; name: string }[];
  onChange: (next: VideoHistoryFilter) => void;
}) {
  const allModels = zh ? "全部模型" : "All models";
  const modelName = models.find(item => item.id === filter.model)?.name;
  const row = "vst-menu-item vst-bar-item";
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger type="button" className="vst-bar-button" data-active={filter.hideFailed || Boolean(filter.model) || filter.range !== "all" || undefined}>
        <ListFilter aria-hidden="true" /><span>{zh ? "筛选" : "Filter"}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} collisionPadding={8} className="vst-menu vst-filter-menu">
          <Menu.Label className="vst-menu-title">{zh ? "类型" : "Type"}</Menu.Label>
          <Menu.Sub>
            <Menu.SubTrigger className={row}><Boxes className="vst-bar-item-icon" /><span className="vst-bar-item-label">{modelName ?? allModels}</span><ChevronRight size={16} /></Menu.SubTrigger>
            <Menu.Portal><Menu.SubContent className="vst-menu vst-filter-models" sideOffset={4} collisionPadding={8}>
              <Menu.RadioGroup value={filter.model} onValueChange={model => onChange({ ...filter, model })}>
                {[{ id: "", name: allModels }, ...models].map(item => (
                  <Menu.RadioItem key={item.id} value={item.id} className={row}>
                    <span className="vst-bar-item-label">{item.name}</span><Menu.ItemIndicator><Check size={16} /></Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.SubContent></Menu.Portal>
          </Menu.Sub>
          <Menu.Sub>
            <Menu.SubTrigger className={row}><CalendarDays className="vst-bar-item-icon" /><span className="vst-bar-item-label">{filter.range === "all" ? zh ? "日期范围" : "Date range" : rangeName(filter.range, zh)}</span><ChevronRight size={16} /></Menu.SubTrigger>
            <Menu.Portal><Menu.SubContent className="vst-menu vst-date-menu" sideOffset={4} collisionPadding={8}>
              <Menu.Label className="vst-menu-title">{zh ? "日期" : "Date"}</Menu.Label>
              <Menu.RadioGroup value={filter.range} onValueChange={value => onChange({ ...filter, range: value as HistoryRange, dates: undefined })}>
                {HISTORY_RANGES.map(value => (
                  <Menu.RadioItem key={value} value={value} className={row}><span className="vst-bar-item-label">{rangeName(value, zh)}</span><Menu.ItemIndicator><Check size={16} /></Menu.ItemIndicator></Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
              <Menu.Label className="vst-menu-title">{zh ? "自定义日期" : "Custom dates"}</Menu.Label>
              <DayPicker className="vst-calendar" mode="range" locale={zh ? zhCN : enUS} selected={filter.dates} defaultMonth={filter.dates?.from}
                onSelect={dates => onChange({ ...filter, range: dates?.from ? "custom" : "all", dates })} />
            </Menu.SubContent></Menu.Portal>
          </Menu.Sub>
          <Menu.CheckboxItem className={row} checked={filter.hideFailed} onCheckedChange={value => onChange({ ...filter, hideFailed: value === true })} onSelect={event => event.preventDefault()}>
            <EyeOff className="vst-bar-item-icon" /><span className="vst-bar-item-label">{zh ? "隐藏失败项" : "Hide failed"}</span><span className={filter.hideFailed ? "vst-switch vst-switch-on" : "vst-switch"} />
          </Menu.CheckboxItem>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
