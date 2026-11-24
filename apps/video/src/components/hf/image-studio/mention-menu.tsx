"use client";

// "@" in the creation bar: point the prompt at one of the attached reference
// images ("@图片1"). The list also opens when "@" is typed in the prompt.
import { useRef } from "react";
import { AtSign, ImagePlus } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { moveFocus, useDismiss } from "./bar-menu";

export type MentionRef = { key: string; name: string; preview: string };

export function mentionToken(index: number, zh: boolean) {
  return `@${zh ? "图片" : "Image"}${index + 1}`;
}

export function MentionMenu({
  zh,
  refs,
  open,
  onOpenChange,
  onPick,
  onAdd,
  disabled,
  disabledNote,
}: {
  zh: boolean;
  refs: MentionRef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (index: number) => void;
  onAdd: () => void;
  disabled: boolean;
  disabledNote: string;
}) {
  const presence = usePresence(open);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useDismiss(open, (refocus) => {
    onOpenChange(false);
    if (refocus) buttonRef.current?.focus();
  }, wrapRef);
  const label = zh ? "引用参考图" : "Mention a reference";

  return (
    <span ref={wrapRef} className="is-pop-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="is-icon-btn"
        aria-label={label}
        title={disabled ? disabledNote : label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        // Keep the caret where it is in the prompt, so the mention lands there.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onOpenChange(!open)}
      >
        <AtSign className="h-4 w-4" aria-hidden="true" />
      </button>
      {presence.mounted ? (
        <div role="menu" aria-label={label} data-presence="pop" data-state={presence.state} className="is-pop is-mention-pop" onKeyDown={moveFocus}>
          <p className="is-pop-title">{label}</p>
          {refs.length ? (
            refs.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                data-menu-item
                className="is-pop-item is-pop-item-ref"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onPick(index)}
              >
                <img src={item.preview} alt="" className="is-mention-thumb" />
                <span className="is-pop-text">
                  <span className="is-pop-label">{mentionToken(index, zh)}</span>
                  <span className="is-pop-sub">{item.name}</span>
                </span>
              </button>
            ))
          ) : (
            <>
              <p className="is-pop-empty">
                {zh ? "还没有参考图。添加后，可以在提示词里用 @图片1 指明要参考哪一张。" : "No reference images yet. Once added, write @Image1 in the prompt to say which one to follow."}
              </p>
              <button
                type="button"
                role="menuitem"
                data-menu-item
                className="is-pop-item"
                onClick={() => {
                  onOpenChange(false);
                  onAdd();
                }}
              >
                <span className="is-pop-icon">
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="is-pop-text">
                  <span className="is-pop-label">{zh ? "添加参考图" : "Add reference images"}</span>
                </span>
              </button>
            </>
          )}
        </div>
      ) : null}
    </span>
  );
}
