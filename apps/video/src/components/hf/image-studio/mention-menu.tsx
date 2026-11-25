"use client";

// "@" in the creation bar: point the prompt at one of the attached reference
// images ("@图片1"), or bring one in from the media library or the saved
// elements (the reference's "@" is its elements button). The list also opens
// when "@" is typed in the prompt.
import { useEffect, useRef } from "react";
import { AtSign, ImagePlus, Shapes } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { Tip, moveFocus, useDismiss } from "./bar-menu";

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
  onElements,
  disabled,
  disabledNote,
}: {
  zh: boolean;
  refs: MentionRef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (index: number) => void;
  /** Opens the media library on its uploads. */
  onAdd: () => void;
  /** Opens the media library on the saved elements. */
  onElements: () => void;
  disabled: boolean;
  disabledNote: string;
}) {
  const presence = usePresence(open);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Opened from the keyboard: focus goes into the list so ↑/↓ work. Opened by
  // typing "@" or with the mouse, the caret stays in the prompt.
  const focusOnOpen = useRef(false);
  useDismiss(open, (refocus) => {
    onOpenChange(false);
    if (refocus) buttonRef.current?.focus();
  }, wrapRef);
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    menuRef.current?.querySelector<HTMLElement>("[data-menu-item]")?.focus({ preventScroll: true });
  }, [open]);
  const label = zh ? "引用参考图" : "Mention a reference";
  const tipId = "is-mention-tip";
  const action = (text: string, icon: React.ReactNode, run: () => void) => (
    <button
      type="button"
      role="menuitem"
      data-menu-item
      className="is-pop-item"
      onClick={() => {
        onOpenChange(false);
        run();
      }}
    >
      <span className="is-pop-icon">{icon}</span>
      <span className="is-pop-text">
        <span className="is-pop-label">{text}</span>
      </span>
    </button>
  );

  return (
    <Tip id={tipId} text={disabled ? disabledNote : label}>
      <span ref={wrapRef} className="is-pop-wrap">
        <button
          ref={buttonRef}
          type="button"
          className="is-icon-btn"
          aria-label={label}
          aria-describedby={disabled ? tipId : undefined}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          // Keep the caret where it is in the prompt, so the mention lands there.
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            if (!open && event.detail === 0) focusOnOpen.current = true;
            onOpenChange(!open);
          }}
        >
          <AtSign className="h-4 w-4" aria-hidden="true" />
        </button>
        {presence.mounted ? (
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            data-presence="pop"
            data-state={presence.state}
            className="is-pop is-mention-pop"
            onKeyDown={moveFocus}
          >
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
              <p className="is-pop-empty">
                {zh ? "还没有参考图。添加后，可以在提示词里用 @图片1 指明要参考哪一张。" : "No reference images yet. Once added, write @Image1 in the prompt to say which one to follow."}
              </p>
            )}
            <span className="is-pop-sep" aria-hidden="true" />
            {action(zh ? "添加参考图" : "Add reference images", <ImagePlus className="h-5 w-5" aria-hidden="true" />, onAdd)}
            {action(zh ? "从元素中选择" : "Choose from elements", <Shapes className="h-5 w-5" aria-hidden="true" />, onElements)}
          </div>
        ) : null}
      </span>
    </Tip>
  );
}
