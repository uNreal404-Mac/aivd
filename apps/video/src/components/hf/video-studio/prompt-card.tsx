"use client";

import { useRef, useState } from "react";
import { AtSign, ImagePlus, Volume2, VolumeX } from "lucide-react";
import { referenceToken, type ReferenceThumb } from "./reference-block";
import { moveFocusWithArrows, useAnchoredPopover } from "./use-anchored-popover";

/** Put an @ token into the prompt between `start` and `end`, with a space on
 * either side where it would otherwise run into a word. */
export function insertToken(text: string, token: string, start: number, end = start): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after.startsWith(" ") ? "" : " ";
  const head = `${before}${lead}${token}${trail}`;
  return { text: `${head}${after}`, caret: head.length };
}

/**
 * The prompt, with the reference's two inline chips under it: "@ Elements"
 * mentions an attached image (or opens the library when there is none yet),
 * and the sound chip switches generated audio on and off for models that
 * make sound. Typing "@" with images attached offers the same list.
 */
export function PromptCard({
  zh,
  value,
  maxLength,
  placeholder,
  textareaRef,
  onChange,
  onSubmit,
  references,
  canReference,
  onOpenMedia,
  audio,
  draftRestored,
  onDiscardDraft,
}: {
  zh: boolean;
  value: string;
  maxLength: number;
  placeholder: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (text: string) => void;
  /** ⌘/Ctrl + Enter. */
  onSubmit: () => void;
  references: ReferenceThumb[];
  canReference: boolean;
  /** Opens the media library: on its Elements tab from the "@ Elements"
   * chip (as the reference does), on Upload from "Add or change images". */
  onOpenMedia: (tab: "upload" | "elements") => void;
  /** Present only for models that generate sound. */
  audio?: { on: boolean; onToggle: () => void };
  draftRestored: boolean;
  onDiscardDraft: () => void;
}) {
  const [menu, setMenu] = useState<null | { typedAt?: number }>(null);
  const open = menu !== null;
  const typed = menu?.typedAt !== undefined;
  const textRef = useRef(value);
  textRef.current = value;
  const popover = useAnchoredPopover<HTMLButtonElement>(
    open,
    () => {
      const wasTyped = typed;
      setMenu(null);
      if (wasTyped) requestAnimationFrame(() => textareaRef.current?.focus());
    },
    "top-start",
  );

  const mention = (index: number) => {
    const field = textareaRef.current;
    const current = textRef.current;
    const token = referenceToken(index, zh);
    const at = menu?.typedAt;
    const start = at ?? field?.selectionStart ?? current.length;
    const end = at !== undefined ? at + 1 : (field?.selectionEnd ?? start);
    const next = insertToken(current, token, start, end);
    onChange(next.text);
    setMenu(null);
    requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(next.caret, next.caret);
    });
  };

  const near = value.length >= maxLength * 0.8;
  const elementsTitle = !canReference
    ? zh
      ? "这个模型不接受参考图片"
      : "This model takes no reference images"
    : references.length
      ? zh
        ? "在提示词里 @ 引用一张参考图片"
        : "Mention a reference image in the prompt"
      : zh
        ? "先添加一张参考图片，再用 @ 引用它"
        : "Add a reference image first, then mention it with @";

  return (
    <div className="vst-prompt">
      <div className="vst-prompt-body">
        <label htmlFor="studio-prompt" className="vst-prompt-label">
          {zh ? "提示词" : "Prompt"}
        </label>
        <textarea
          id="studio-prompt"
          ref={textareaRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-keyshortcuts="Meta+Enter Control+Enter"
          onChange={(event) => {
            const text = event.target.value;
            const caret = event.target.selectionStart;
            onChange(text);
            // "@" just typed, with images to mention: offer them.
            if (references.length && text.length === textRef.current.length + 1 && text[caret - 1] === "@") {
              setMenu({ typedAt: caret - 1 });
            } else if (typed) {
              setMenu(null);
            }
          }}
          onKeyDown={(event) => {
            if (open && typed && event.key === "ArrowDown") {
              event.preventDefault();
              popover.popoverRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
              return;
            }
            if (open && typed && event.key === "Escape") {
              // Keep the popover's document handler from moving focus to the chip.
              event.nativeEvent.stopImmediatePropagation();
              setMenu(null);
              return;
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        {draftRestored ? (
          <p className="draft-note vst-draft">
            {zh ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
            <button type="button" onClick={onDiscardDraft}>
              {zh ? "清空" : "Clear"}
            </button>
          </p>
        ) : null}
      </div>
      <div className="vst-prompt-foot">
        <button
          ref={popover.anchorRef}
          type="button"
          className="vst-chip"
          title={elementsTitle}
          aria-label={elementsTitle}
          aria-expanded={references.length ? open : undefined}
          disabled={!canReference}
          onClick={() => {
            if (!references.length) {
              onOpenMedia("elements");
              return;
            }
            // Opening moves focus to the first image; closing leaves it on the chip.
            if (open) {
              setMenu(null);
              return;
            }
            setMenu({});
            requestAnimationFrame(() => popover.popoverRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
          }}
        >
          <AtSign aria-hidden="true" />
          <span aria-hidden="true">{zh ? "元素" : "Elements"}</span>
        </button>
        {audio ? (
          <button
            type="button"
            className="vst-chip"
            aria-pressed={audio.on}
            title={audio.on ? (zh ? "生成声音：开，点击关闭" : "Sound on, click to turn off") : zh ? "生成声音：关，点击开启" : "Sound off, click to turn on"}
            aria-label={zh ? "生成声音" : "Generate sound"}
            onClick={audio.onToggle}
          >
            {audio.on ? <Volume2 key="on" data-swap aria-hidden="true" /> : <VolumeX key="off" data-swap aria-hidden="true" />}
            <span aria-hidden="true">{audio.on ? (zh ? "开" : "On") : zh ? "关" : "Off"}</span>
          </button>
        ) : null}
        {near ? (
          <span className="vst-count du-num" aria-live="polite">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {popover.mounted ? (
        <div
          ref={popover.popoverRef}
          style={popover.style}
          data-presence="pop"
          data-state={popover.state}
          className="vst-menu vst-mentions"
          onKeyDown={moveFocusWithArrows}
        >
          <p className="vst-menu-title">{zh ? "引用参考图片" : "Mention a reference"}</p>
          {references.map((item, index) => (
            <button key={item.key} type="button" className="vst-menu-item vst-mention" onClick={() => mention(index)}>
              <img src={item.url} alt="" />
              <span className="vst-mention-token">{referenceToken(index, zh)}</span>
              <span className="vst-mention-name">{item.name}</span>
            </button>
          ))}
          {canReference ? (
            <button
              type="button"
              className="vst-menu-item vst-mention"
              onClick={() => {
                setMenu(null);
                onOpenMedia("upload");
              }}
            >
              <span className="vst-mention-add" aria-hidden="true">
                <ImagePlus />
              </span>
              <span className="vst-mention-token">{zh ? "添加或更换图片…" : "Add or change images…"}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
