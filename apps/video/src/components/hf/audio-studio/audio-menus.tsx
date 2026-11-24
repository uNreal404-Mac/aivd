"use client";

import type { RefObject } from "react";
import { Check, Play, Square } from "lucide-react";
import type { MarketModel } from "@/ai/kie-market";
import { MODEL_INFO, voiceTag } from "./audio-data";
import { AudioPopover } from "./audio-popover";

/** The model list the "Model" row opens. */
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
  return (
    <AudioPopover open={open} onClose={onClose} anchorRef={anchorRef} label={title}>
      <p className="au-pop-head">{title}</p>
      <div className="au-pop-list">
        {models.map((item) => {
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
      </div>
    </AudioPopover>
  );
}

/** The voice list the "Voice" row opens: pick one, or play any to hear it. */
export function AudioVoiceMenu({
  open,
  onClose,
  anchorRef,
  zh,
  title,
  voices,
  value,
  onChange,
  previewing,
  onPreview,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  zh: boolean;
  title: string;
  voices: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  previewing: string | null;
  onPreview: (name: string) => void;
}) {
  return (
    <AudioPopover open={open} onClose={onClose} anchorRef={anchorRef} label={title}>
      <p className="au-pop-head">
        {title}
        <span className="au-pop-hint">{zh ? "点 ▶ 试听" : "Tap ▶ to hear"}</span>
      </p>
      <div className="au-pop-list">
        {voices.map((item) => {
          const on = item.id === value;
          const playing = previewing === item.name;
          return (
            <div key={item.id} className="au-opt-wrap">
              <button
                type="button"
                aria-pressed={on}
                className="au-opt au-opt-voice"
                onClick={() => {
                  onChange(item.id);
                  onClose();
                  anchorRef.current?.focus();
                }}
              >
                <span className="au-opt-tile au-opt-avatar" aria-hidden="true">
                  {item.name.slice(0, 1)}
                </span>
                <span className="au-opt-text">
                  <span className="au-opt-name">{item.name}</span>
                  <span className="au-opt-sub">{voiceTag(item.name, zh)}</span>
                </span>
                {on ? <Check className="au-opt-check du-check-pop" aria-hidden="true" /> : null}
              </button>
              <button
                type="button"
                className={playing ? "au-play au-play-on" : "au-play"}
                aria-label={playing ? (zh ? `停止试听 ${item.name}` : `Stop ${item.name}`) : zh ? `试听 ${item.name}` : `Preview ${item.name}`}
                onClick={() => onPreview(item.name)}
              >
                {playing ? <Square key="stop" data-swap="" className="h-3 w-3" aria-hidden="true" /> : <Play key="play" data-swap="" className="h-3 w-3" aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
    </AudioPopover>
  );
}
