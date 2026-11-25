"use client";

import { useId, useRef, useState } from "react";

export interface CanvasReference {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  url?: string;
  media?: "image" | "video";
}

export function CanvasPrompt({ value, label, placeholder, zh, list, attach, change }: {
  value: string;
  label: string;
  placeholder: string;
  zh: boolean;
  list: () => CanvasReference[];
  attach: (ref: CanvasReference) => boolean;
  change: (value: string) => void;
}) {
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const before = caret === null ? "" : value.slice(0, caret);
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
    const next = value.slice(0, start) + insert + value.slice(caret);
    if (next.length > 5000 || !attach(item)) return;
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
      <textarea className="nc-prompt" ref={input} value={value} maxLength={5000} placeholder={placeholder} aria-label={label}
        aria-controls={choices.length ? listId : undefined}
        aria-describedby={choices[active] ? `${listId}-${active}` : undefined}
        onClick={(e) => cursor(e.currentTarget)} onBlur={() => setCaret(null)}
        onChange={(e) => { change(e.currentTarget.value); cursor(e.currentTarget); }}
        onKeyUp={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) cursor(e.currentTarget); }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || !choices.length) return;
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
