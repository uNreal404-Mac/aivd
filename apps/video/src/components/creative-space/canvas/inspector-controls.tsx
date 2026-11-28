"use client";

import { Maximize2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "./canvas-inspector.css";

export function InspectorFrame({ title, zh, children, kind }: { title: string; zh: boolean; children: ReactNode; kind: string }) {
  const [expanded, setExpanded] = useState(false);
  const stopEditingKeys = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
  };
  return <>
    {!expanded && <section className={`nc-inspector nc-inspector-${kind} nodrag nopan nowheel`} aria-label={title} onKeyDown={stopEditingKeys}>
      <button type="button" className="nci-expand" aria-label={zh ? "展开编辑器" : "Expand editor"} onClick={() => setExpanded(true)}><Maximize2 size={14}/></button>
      {children}
    </section>}
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className={`nci-expanded nc-inspector nc-inspector-${kind} nodrag nopan nowheel`} aria-describedby={undefined} onKeyDown={stopEditingKeys}>
        <DialogTitle className="sr-only">{title}</DialogTitle>{children}
      </DialogContent>
    </Dialog>
  </>;
}

export function InspectorMenu({ label, button, children, className = "", triggerClass = "", disabled, onOpen }: {
  label: string; button: ReactNode; children: (close: () => void) => ReactNode; className?: string; triggerClass?: string; disabled?: boolean; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (value) onOpen?.(); }}>
    <PopoverTrigger asChild><button type="button" className={`nci-chip ${triggerClass}`} aria-label={label} title={label} disabled={disabled}>{button}</button></PopoverTrigger>
    <PopoverContent align="start" collisionPadding={12} sideOffset={6} className={`nci-pop nodrag nopan nowheel ${className}`}
      aria-label={label} onKeyDown={e => { if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation(); }}>
      {children(() => setOpen(false))}
    </PopoverContent>
  </Popover>;
}

export function InspectorOptions({ options, value, label, set, grid = false, disabledOptions = [] }: {
  options: string[]; value?: string; label: string; set: (value: string) => void; grid?: boolean; disabledOptions?: string[];
}) {
  return <fieldset aria-label={label} className={grid ? "nci-option-grid" : "nci-options"}>
    {options.map(option => <button type="button" key={option} disabled={disabledOptions.includes(option)} aria-pressed={option === value} onClick={() => set(option)}>{option}</button>)}
  </fieldset>;
}
