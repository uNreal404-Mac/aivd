"use client";

import { Bold, Check, Copy, Italic, List, ListOrdered, Minus, Pilcrow } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { TextData } from "@/lib/creative-space/canvas-graph";
import { paintCanvasText, readCanvasText } from "@/lib/creative-space/text-editor";
import { TextDictation } from "./text-dictation";
import "./canvas-inspector.css";

export function CanvasTextPreview({ value }: { value: string }) {
  const preview = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (preview.current) paintCanvasText(preview.current, value); }, [value]);
  return <div className="nci-prose nci-text-preview" ref={preview}/>;
}

export function CanvasTextEditor({ data, zh, open, onOpenChange, onText }: {
  data: TextData; zh: boolean; open: boolean; onOpenChange: (next: boolean) => void; onText: (value: string) => void;
}) {
  const input = useRef<HTMLDivElement | null>(null);
  const seen = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const currentText = useRef(data.text);
  currentText.current = data.text;
  const attachInput = useCallback((element: HTMLDivElement | null) => {
    input.current = element;
    if (element) { paintCanvasText(element, currentText.current); seen.current = currentText.current; }
  }, []);
  const save = () => {
    const field = input.current;
    if (!field) return;
    const text = readCanvasText(field);
    if (text === seen.current) return;
    if (text.length > 5000) {
      paintCanvasText(field, seen.current ?? data.text); setFull(true); return;
    }
    setFull(false); setCopied(false); seen.current = text; onText(text);
  };
  const cmd = (name: string, value?: string) => {
    const field = input.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    document.execCommand(name, false, value);
    save();
  };
  useLayoutEffect(() => {
    if (input.current && data.text !== seen.current) {
      paintCanvasText(input.current, data.text); seen.current = data.text;
    }
  }, [data.text, open]);
  const controls: [string,string,string | typeof Bold,string?][] = [
    ["formatBlock",zh ? "一级标题" : "Heading 1","H1","h1"], ["formatBlock",zh ? "二级标题" : "Heading 2","H2","h2"], ["formatBlock",zh ? "三级标题" : "Heading 3","H3","h3"],
    ["formatBlock",zh ? "正文" : "Paragraph",Pilcrow,"p"], ["bold",zh ? "加粗" : "Bold",Bold], ["italic",zh ? "斜体" : "Italic",Italic],
    ["insertUnorderedList",zh ? "无序列表" : "Bulleted list",List], ["insertOrderedList",zh ? "有序列表" : "Numbered list",ListOrdered], ["insertHorizontalRule",zh ? "分割线" : "Divider",Minus],
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="nci-text-editor nodrag nopan nowheel" aria-describedby={undefined}>
      <DialogTitle className="sr-only">{zh ? "编辑节点正文" : "Edit node text"}</DialogTitle>
      <div className="nci-textbar" role="toolbar" aria-label={zh ? "正文格式" : "Text formatting"}>
        <button type="button" className="nci-copy-text" aria-label={zh ? "复制正文" : "Copy text"} title={zh ? "复制" : "Copy"} onClick={async () => {
          try { await navigator.clipboard.writeText(data.text); setCopied(true); } catch {
            if (input.current) { const selection = window.getSelection(); selection?.selectAllChildren(input.current); }
          }
        }}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button>
        {controls.map(([command,label,Icon,value]) => <button key={label} type="button" title={label} aria-label={label}
          onMouseDown={e => e.preventDefault()} onClick={() => cmd(command, value)}>{typeof Icon === "string" ? Icon : <Icon size={15}/>}</button>)}
      </div>
      <div className="nci-prose nci-editable" ref={attachInput} contentEditable suppressContentEditableWarning role="textbox" tabIndex={0} aria-multiline="true" aria-label={zh ? "节点正文" : "Node text"}
        onInput={save} onPaste={e => { e.preventDefault(); cmd("insertText",e.clipboardData.getData("text/plain")); }}
        onDrop={e => e.preventDefault()} onKeyDown={e => { if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation(); }}/>
      <footer><span>{full ? zh ? "最多 5000 字" : "5,000 character limit" : `${data.text.length} ${zh ? "字" : "characters"}`}</span>
        <TextDictation zh={zh} insert={text => cmd("insertText", text)}/></footer>
    </DialogContent>
  </Dialog>;
}
