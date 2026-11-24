"use client";

import { useEffect, useRef } from "react";
import { Check, Pencil, X } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { VIDEO_PRESETS } from "@/lib/video-presets";

/**
 * The card at the top of the settings column: the chosen camera preset over
 * its picture (in the accent colour), the model under it, and "Change",
 * which opens the preset library. The whole card is the button.
 */
export function PresetCard({
  cover,
  title,
  model,
  changeLabel,
  label,
  open,
  onToggle,
  buttonRef,
}: {
  cover: string;
  title: string;
  model: string;
  changeLabel: string;
  /** Accessible name: what the card is and what it opens. */
  label: string;
  open: boolean;
  onToggle: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="vst-preset-card"
      aria-label={label}
      aria-expanded={open}
      aria-controls="vst-preset-library"
      data-open={open || undefined}
      onClick={onToggle}
    >
      <img src={cover} alt="" className="vst-preset-cover" />
      <span className="vst-preset-shade" aria-hidden="true" />
      <span className="vst-preset-change" aria-hidden="true">
        <Pencil />
        {changeLabel}
      </span>
      <span className="vst-preset-text" aria-hidden="true">
        <span className="vst-preset-name">{title}</span>
        <span className="vst-preset-model">{model}</span>
      </span>
    </button>
  );
}

type LibraryItem = { id: string | undefined; name: string; image: string; motion?: string };

/**
 * Camera presets, opened from the preset card. On wide screens it drops over
 * the top of the stage, as the reference's preset library does; on phones it
 * fills the screen. "General" (no camera move) comes first; an effect that
 * arrived from the effects page is listed after it while it is in use.
 */
export function PresetLibrary({
  open,
  onClose,
  zh,
  selected,
  onSelect,
  generalCover,
  effect,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  zh: boolean;
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  generalCover: string;
  /** An effect preset in use, shown so it can be seen and replaced. */
  effect?: { id: string; name: string; image: string };
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const presence = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, triggerRef]);

  if (!presence.mounted) return null;

  const items: LibraryItem[] = [
    { id: undefined, name: zh ? "通用" : "General", image: generalCover },
    ...(effect ? [{ id: effect.id, name: effect.name, image: effect.image }] : []),
    ...VIDEO_PRESETS.map((preset) => ({ id: preset.id, name: zh ? preset.zh : preset.en, image: preset.image, motion: preset.motion })),
  ];

  return (
    <div
      ref={panelRef}
      id="vst-preset-library"
      className="vst-library"
      data-presence="pop"
      data-state={presence.state}
      aria-label={zh ? "镜头预设" : "Camera presets"}
    >
      <div className="vst-library-head">
        <span className="vst-library-title">{zh ? "镜头预设" : "Camera presets"}</span>
        <span className="vst-library-note">
          {zh ? "选中的运镜会加到提示词后面，所有模型都能用" : "The camera move is added to your prompt, so it works with every model"}
        </span>
        <button
          type="button"
          className="vst-icon-button"
          aria-label={zh ? "关闭" : "Close"}
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="vst-library-grid">
        {items.map((item) => {
          const chosen = item.id === selected;
          return (
            <button
              key={item.id ?? "general"}
              type="button"
              aria-pressed={chosen}
              className="vst-library-item"
              onClick={() => {
                onSelect(item.id);
                onClose();
                triggerRef.current?.focus();
              }}
            >
              <span className={item.motion ? `vst-library-media vst-move-${item.motion}` : "vst-library-media"}>
                <img src={item.image} alt="" loading="lazy" decoding="async" />
              </span>
              <span className="vst-library-shade" aria-hidden="true" />
              <span className="vst-library-name">{item.name}</span>
              {chosen ? (
                <span className="vst-library-check" aria-hidden="true">
                  <Check />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
