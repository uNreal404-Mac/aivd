"use client"

import { useState } from "react"
import * as Icons from "@/components/ui/icons";

export function CodeCopy() {
  const [copied, setCopied] = useState(false)
  const command = "pnpm install"

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <div className="rounded-full h-12 px-3 flex items-center justify-between max-w-xl bg-[var(--du-surface-2)] dark:bg-[var(--du-surface)]/40">
      <div className="flex items-center space-x-2 font-mono text-[var(--du-text-dim)] dark:text-[var(--du-text-muted)]">
        <span>$</span>
        <span>{command}</span>
      </div>
      <button
        type="button"
        onClick={copyToClipboard}
        className="p-1.5 hover:bg-[var(--du-surface-2)] dark:hover:bg-[var(--du-surface)] rounded-md transition-colors ml-2"
        aria-label="Copy to clipboard"
      >
        {copied ? <Icons.Check className="w-4 h-4 text-[var(--du-text-dim)] dark:text-[var(--du-text-muted)]" /> : <Icons.Copy className={`w-4 h-4 text-[var(--du-text-dim)] dark:text-[var(--du-text-muted)]`} />}
      </button>
    </div>
  )
}
