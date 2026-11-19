"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";

/** Prompt box on a model page: opens the studio with this model and the text. */
export function ModelPrompt({
  href,
  placeholder,
  label,
  disabled = false,
}: {
  /** Localized studio link that already selects the model. */
  href: string;
  placeholder: string;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    router.push(text ? `${href}${href.includes("?") ? "&" : "?"}prompt=${encodeURIComponent(text)}` : href);
  };
  return (
    <form className="ml-prompt" onSubmit={submit}>
      <label htmlFor="ml-prompt-input" className="sr-only">
        {placeholder}
      </label>
      <input
        id="ml-prompt-input"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={placeholder}
        maxLength={2000}
        autoComplete="off"
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        {label}
        <ArrowUp aria-hidden="true" />
      </button>
    </form>
  );
}
