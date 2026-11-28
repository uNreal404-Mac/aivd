"use client";

import { Bookmark, ChevronRight, ClipboardPaste, Copy, CopyPlus, FolderOpen, Group, MessageSquare, Pencil, Plus, Redo2, RefreshCw, Trash2, Undo2, Ungroup } from "lucide-react";
import type { CSSProperties } from "react";
import type { CanvasData } from "@/lib/creative-space/canvas-graph";

type MenuAction = "add" | "asset" | "paste" | "undo" | "redo" | "refresh" | "copy" | "duplicate" | "group" | "ungroup" | "delete" | "save" | "title" | "annotation";

export function GraphContextMenu({ style, zh, node, count, canUndo, canRedo, canPaste, onAction }: {
  style: CSSProperties;
  zh: boolean;
  node?: CanvasData;
  count: number;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  onAction: (action: MenuAction) => void;
}) {
  const label = (cn: string, en: string) => zh ? cn : en;
  const item = (action: MenuAction, Icon: typeof Plus, name: string, hint?: string, disabled = false) => (
    <button key={action} type="button" role="menuitem" disabled={disabled} onClick={() => onAction(action)}>
      <Icon size={15} aria-hidden="true" />{name}{hint ? <kbd>{hint}</kbd> : null}{action === "add" ? <ChevronRight size={13} /> : null}
    </button>
  );
  return <div className="nc-menu nc-context-menu" style={style} role="menu" aria-label={node ? label("节点操作", "Node actions") : label("画布操作", "Canvas actions")}>
    {node ? <>
      {item("save", Bookmark, label("存为模板", "Save as template"))}
      {count === 1 && item("title", Pencil, label("修改节点名称", "Rename node"), "F2")}
      {count === 1 && node.kind !== "group" && item("annotation", MessageSquare, node.annotation ? label("编辑标注", "Edit note") : label("添加标注", "Add note"))}
      <hr />
      {item("copy", Copy, label("复制节点", "Copy nodes"), "⌘/Ctrl C")}
      {item("duplicate", CopyPlus, label("创建副本", "Duplicate"), "⌘/Ctrl D")}
      {node.kind === "group" && count === 1 ? item("ungroup", Ungroup, label("解组", "Ungroup")) : item("group", Group, count === 1 ? label("打组（单节点）", "Group this node") : label("打组", "Group"))}
      {item("paste", ClipboardPaste, label("粘贴", "Paste"), "⌘/Ctrl V", !canPaste)}
      {item("delete", Trash2, label("删除", "Delete"), "⌫")}
    </> : <>
      {item("add", Plus, label("添加节点", "Add node"), "Tab")}
      {item("asset", FolderOpen, label("添加资产", "Add asset"))}
      <hr />
      {item("paste", ClipboardPaste, label("粘贴", "Paste"), "⌘/Ctrl V", !canPaste)}
      {item("undo", Undo2, label("撤销", "Undo"), "⌘/Ctrl Z", !canUndo)}
      {item("redo", Redo2, label("重做", "Redo"), "⌘/Ctrl ⇧Z", !canRedo)}
    </>}
    <hr />{item("refresh", RefreshCw, label("刷新画布", "Refresh canvas"))}
  </div>;
}
