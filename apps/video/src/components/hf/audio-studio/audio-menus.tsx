"use client";

import { type RefObject, useId, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";
import type { MarketModel } from "@/ai/kie-market";
import { MODEL_INFO } from "./audio-data";
import { AudioPopover } from "./audio-popover";

/**
 * The model list the "Model" row opens, measured from the reference: a search
 * field on top, a heading, then 52px rows with a 40px icon tile, the name and
 * one line about the model, a check on the chosen one.
 */
export function AudioModelMenu({
  open,
  onClose,
  anchorRef,
  zh,
  title,
  models,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  zh: boolean;
  title: string;
  models: MarketModel[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  // Every opening starts from the whole list. Reset while rendering, so the
  // list is placed at its full height (an effect would run after placing).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? models.filter((item) => {
        const info = MODEL_INFO[item.id];
        return [item.name, info?.zh, info?.en].some((text) => text?.toLowerCase().includes(needle));
      })
    : models;

  return (
    <AudioPopover open={open} onClose={onClose} anchorRef={anchorRef} label={title}>
      <div className="au-pop-search">
        <Search className="au-pop-search-icon" aria-hidden="true" />
        <label htmlFor={searchId} className="sr-only">
          {zh ? "搜索模型" : "Search models"}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder={zh ? "搜索……" : "Search…"}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="au-pop-head au-pop-head-icon">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1">{title}</span>
      </p>
      <div className="au-pop-list">
        {shown.map((item) => {
          const info = MODEL_INFO[item.id];
          const Icon = info?.icon;
          const on = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              className="au-opt"
              onClick={() => {
                onChange(item.id);
                onClose();
                anchorRef.current?.focus();
              }}
            >
              <span className="au-opt-tile" aria-hidden="true">
                {Icon ? <Icon className="h-4 w-4" /> : null}
              </span>
              <span className="au-opt-text">
                <span className="au-opt-name">{item.name}</span>
                {info ? <span className="au-opt-sub">{zh ? info.zh : info.en}</span> : null}
              </span>
              {on ? <Check className="au-opt-check du-check-pop" aria-hidden="true" /> : null}
            </button>
          );
        })}
        {shown.length === 0 ? <p className="au-pop-none">{zh ? "没有找到相关模型" : "No models match"}</p> : null}
      </div>
    </AudioPopover>
  );
}
