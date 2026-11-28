"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface CanvasReference {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  url?: string;
  media?: "image" | "video";
  attachable?: boolean;
}

export function CanvasPrompt({ value, label, placeholder, zh, list, attach, change, insert, onSubmit }: {
  value: string;
  label: string;
  placeholder: string;
  zh: boolean;
  list: () => CanvasReference[];
  attach: (ref: CanvasReference) => boolean;
  change: (value: string) => void;
  insert?: { text: string; nonce: number } | null;
  onSubmit?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const lastInsert = useRef<number | null>(insert?.nonce ?? null);
  useEffect(() => { if (!composing.current) setDraft(value); }, [value]);
  useEffect(() => {
    if (!insert || lastInsert.current === insert.nonce) return;
    lastInsert.current = insert.nonce;
    const next = [draft.trim(), insert.text].filter(Boolean).join("\n");
    if (next.length > 5000) return;
    setDraft(next);
    change(next);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.length, next.length);
    });
    // Only a new explicit click should insert text; value changes are handled by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insert?.nonce]);
  const before = caret === null || composing.current ? "" : draft.slice(0, caret);
  const match = /@([^@\s]*)$/u.exec(before);
  const candidates = caret === null || !before.trim() ? [] : list();
  const named = !match && candidates.filter((item) => !item.connected && before.endsWith(item.name)).sort((a, b) => b.name.length - a.name.length)[0];
  const choices = match
    ? candidates.filter((item) => item.name.toLowerCase().includes(match[1].toLowerCase())).slice(0, 24)
    : named ? [named] : [];
  const choose = (item: CanvasReference) => {
    if (caret === null) return;
    const start = caret - (match ? match[0].length : item.name.length);
    const insert = `@${item.token} `;
    const next = draft.slice(0, start) + insert + draft.slice(caret);
    if (next.length > 5000 || !attach(item)) return;
    setDraft(next);
    change(next);
    setCaret(null);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(start + insert.length, start + insert.length);
    });
  };
  const cursor = (el: HTMLTextAreaElement) => {
    setCaret(el.selectionStart === el.selectionEnd ? el.selectionStart : null);
    setActive(0);
  };
  return (
    <div className="nc-reference-prompt">
      <textarea className="nc-prompt" ref={input} value={draft} maxLength={5000} placeholder={placeholder} aria-label={label}
        aria-controls={choices.length ? listId : undefined}
        aria-describedby={choices[active] ? `${listId}-${active}` : undefined}
        onClick={(e) => { if (!composing.current) cursor(e.currentTarget); }} onBlur={(e) => { if (composing.current) { composing.current = false; change(e.currentTarget.value); } setCaret(null); }}
        onCompositionStart={() => { composing.current = true; setCaret(null); }}
        onCompositionEnd={(e) => { composing.current = false; setDraft(e.currentTarget.value); change(e.currentTarget.value); cursor(e.currentTarget); }}
        onChange={(e) => { setDraft(e.currentTarget.value); if (!composing.current) { change(e.currentTarget.value); cursor(e.currentTarget); } }}
        onKeyUp={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) cursor(e.currentTarget); }}
        onKeyDown={(e) => {
          if (onSubmit && e.key === "Enter" && e.shiftKey && !composing.current && !e.nativeEvent.isComposing) {
            e.preventDefault(); onSubmit(); return;
          }
          if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229 || !choices.length) return;
          if (e.key === "Escape") { e.stopPropagation(); setCaret(null); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((index) => (index + (e.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length);
          }
          if (e.key === "Enter" && !e.shiftKey && choices[active]) { e.preventDefault(); choose(choices[active]); }
        }} />
      {choices.length > 0 && <ul id={listId} className="nc-reference-list nowheel" aria-label={zh ? "画布素材" : "Canvas references"}>
        {choices.map((item, index) => <li key={item.id}><button id={`${listId}-${index}`} type="button" tabIndex={-1}
          aria-current={active === index} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}>
          {match ? item.name : `${zh ? "引用" : "Reference"} ${item.name}`}
        </button></li>)}
      </ul>}
    </div>
  );
}
