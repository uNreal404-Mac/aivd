"use client";

import "@xyflow/react/dist/style.css";
import "./ai-canvas.css";

import {
  Background,
  BackgroundVariant,
  type FinalConnectionState,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  FolderOpen,
  Hand,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  Maximize,
  MessageSquareText,
  MousePointer2,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { localizedHref } from "@/lib/locale-path";
import { useCreditsStore } from "@/stores/credits-store";

import { CanvasContext, type CanvasContextValue, useCanvasContext } from "./context";
import { getCopy } from "./copy";
import { uploadImageFile } from "./generation";
import { KIND_ICONS, nodeTypes } from "./nodes";
import { useCanvasStore } from "./store";
import type { CanvasNode, CanvasNodeKind, GenerateData, MediaData, MediaType } from "./types";

const TOOL_KINDS: CanvasNodeKind[] = ["text", "image", "video", "audio", "storyboard", "character", "style"];
const PICKER_KINDS: CanvasNodeKind[] = [...TOOL_KINDS, "note"];
const DRAG_MIME = "application/x-aivd-node";

interface Picker {
  /** Screen position of the menu. */
  x: number;
  y: number;
  /** Flow position the new node goes to. */
  flow: { x: number; y: number };
  /** Connect the new node from this node, when the menu opened from a dropped wire. */
  fromId?: string;
}

type Panel = "layers" | "assets" | null;

export function AiCanvas({ locale }: { locale: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4000);
  }, []);
  const ctx = useMemo<CanvasContextValue>(
    () => ({
      locale,
      zh: locale === "zh",
      t: getCopy(locale),
      toast,
      onCreditsChanged: () => {
        fetchBalance().catch(() => {});
      },
    }),
    [locale, toast, fetchBalance],
  );

  return (
    <CanvasContext.Provider value={ctx}>
      <ReactFlowProvider>
        <CanvasInner />
        {message && (
          <output className="aic-toast">{message}</output>
        )}
      </ReactFlowProvider>
    </CanvasContext.Provider>
  );
}

function CanvasInner() {
  const { t, locale, toast } = useCanvasContext();
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, setCenter, getNode } = useReactFlow();
  const { zoom } = useViewport();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);
  const connect = useCanvasStore((s) => s.connect);
  const name = useCanvasStore((s) => s.name);
  const setName = useCanvasStore((s) => s.setName);
  const clear = useCanvasStore((s) => s.clear);
  const balance = useCreditsStore((s) => s.balance);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);

  const wrapper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    Promise.resolve(useCanvasStore.persist.rehydrate()).finally(() => setHydrated(true));
    fetchBalance().catch(() => {});
  }, [fetchBalance]);

  const viewportCenter = useCallback(() => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToFlowPosition({ x: rect.left + rect.width / 2 - 140, y: rect.top + rect.height / 2 - 120 });
  }, [screenToFlowPosition]);

  const create = useCallback(
    (kind: CanvasNodeKind, flow?: { x: number; y: number }, fromId?: string) => {
      const id = addNode(kind, flow ?? viewportCenter());
      if (fromId) connect(fromId, id);
      setPicker(null);
      return id;
    },
    [addNode, connect, viewportCenter],
  );

  const openPicker = useCallback(
    (clientX: number, clientY: number, fromId?: string) => {
      const rect = wrapper.current?.getBoundingClientRect();
      if (!rect) return;
      setPicker({
        x: Math.min(clientX - rect.left, rect.width - 240),
        y: Math.min(clientY - rect.top, rect.height - 380),
        flow: screenToFlowPosition({ x: clientX, y: clientY }),
        fromId,
      });
    },
    [screenToFlowPosition],
  );

  const onPaneDoubleClick = (event: ReactMouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("react-flow__pane")) return;
    openPicker(event.clientX, event.clientY);
  };

  // Dropping a wire on empty canvas offers a node to connect it to.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.fromNode || state.fromHandle?.type !== "source") return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      openPicker(point.clientX, point.clientY, state.fromNode.id);
    },
    [openPicker],
  );

  const onDragOver = (event: DragEvent) => {
    if (event.dataTransfer.types.includes(DRAG_MIME) || event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const kind = event.dataTransfer.getData(DRAG_MIME) as CanvasNodeKind;
    if (kind) {
      create(kind, flow);
      return;
    }
    if (event.dataTransfer.files.length) addFiles(Array.from(event.dataTransfer.files), flow);
  };

  const addFiles = async (files: File[], at?: { x: number; y: number }) => {
    const origin = at ?? viewportCenter();
    for (const [index, file] of files.entries()) {
      const mediaType: MediaType | null = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : null;
      if (!mediaType) continue;
      const position = { x: origin.x + index * 40, y: origin.y + index * 40 };
      const local = URL.createObjectURL(file);
      const id = addNode("media", position, { mediaType, url: local, name: file.name } as Partial<MediaData>);
      if (mediaType !== "image") continue;
      try {
        const uploaded = await uploadImageFile(file);
        useCanvasStore.getState().updateData(id, { url: uploaded.url, key: uploaded.key } as Partial<MediaData>);
        URL.revokeObjectURL(local);
      } catch (error) {
        toast(`${t.uploadFailed}: ${error instanceof Error ? error.message : ""}`);
      }
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) addFiles(files);
  };

  const focusNode = (id: string) => {
    const node = getNode(id);
    if (!node) return;
    const w = node.measured?.width ?? 300;
    const h = node.measured?.height ?? 300;
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1, duration: 300 });
  };

  const credits = balance?.availableCredits;

  return (
    <div className="aic-root" ref={wrapper} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<CanvasNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onDoubleClick={onPaneDoubleClick}
        onPaneClick={() => setPicker(null)}
        zoomOnDoubleClick={false}
        panOnDrag={panMode ? true : [1, 2]}
        selectionOnDrag={!panMode}
        panOnScroll={false}
        minZoom={0.1}
        maxZoom={3}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true }}
        colorMode="dark"
        fitView={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="color-mix(in srgb, var(--du-accent) 22%, transparent)" />
        {showMap && (
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            className="aic-minimap"
            maskColor="color-mix(in srgb, var(--du-bg) 60%, transparent)"
            nodeColor="color-mix(in srgb, var(--du-accent) 40%, transparent)"
          />
        )}
      </ReactFlow>

      {/* Top bar */}
      <div className="aic-top aic-top-left">
        <Link href={localizedHref(locale, "/")} className="aic-brand" aria-label="Aivd">
          <Sparkles size={16} />
        </Link>
        <input
          className="aic-name"
          value={name}
          placeholder={t.untitled}
          aria-label={t.rename}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
        />
        <button type="button" className={`aic-top-btn ${panel === "assets" ? "is-active" : ""}`} onClick={() => setPanel(panel === "assets" ? null : "assets")}>
          <FolderOpen size={15} /> {t.assets}
        </button>
      </div>
      <div className="aic-top aic-top-right">
        <span className="aic-saved">{t.saved}</span>
        <button
          type="button"
          className="aic-top-btn"
          title={t.clear}
          aria-label={t.clear}
          onClick={() => {
            if (nodes.length && window.confirm(t.clearConfirm)) clear();
          }}
        >
          <Trash2 size={15} />
        </button>
        <Link href={localizedHref(locale, "/pricing")} className="aic-credits" title={t.credits}>
          <Sparkles size={13} /> {typeof credits === "number" ? credits : "--"}
        </Link>
      </div>

      {/* Left toolbar */}
      <nav className="aic-toolbar" aria-label="tools">
        {TOOL_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, kind);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => create(kind)}
              data-tip={t.kinds[kind]}
              aria-label={t.kinds[kind]}
            >
              <Icon size={18} />
            </button>
          );
        })}
        <span className="aic-toolbar-sep" />
        <button type="button" className={panel === "layers" ? "is-active" : ""} onClick={() => setPanel(panel === "layers" ? null : "layers")} data-tip={t.layers} aria-label={t.layers}>
          <Layers size={18} />
        </button>
        <button type="button" draggable onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, "note")} onClick={() => create("note")} data-tip={t.kinds.note} aria-label={t.kinds.note}>
          {(() => {
            const Icon = KIND_ICONS.note;
            return <Icon size={18} />;
          })()}
        </button>
        <span className="aic-toolbar-sep" />
        <button type="button" className={panel === "assets" ? "is-active" : ""} onClick={() => setPanel(panel === "assets" ? null : "assets")} data-tip={t.assets} aria-label={t.assets}>
          <FolderOpen size={18} />
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} data-tip={t.upload} aria-label={t.upload}>
          <Upload size={18} />
        </button>
        <input ref={fileInput} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={onFileInput} />
      </nav>

      {/* Empty state */}
      {hydrated && nodes.length === 0 && (
        <div className="aic-empty" aria-hidden>
          <div className="aic-empty-line">
            <span>{t.hintLeft}</span>
            <MousePointer2 className="aic-empty-cursor" size={26} />
            <span>{t.hintRight}</span>
          </div>
          <p>{t.hintSub}</p>
        </div>
      )}

      {/* Node picker */}
      {picker && (
        <div className="aic-picker" style={{ left: picker.x, top: picker.y }} role="menu">
          {PICKER_KINDS.map((kind) => {
            const Icon = KIND_ICONS[kind];
            return (
              <button key={kind} type="button" role="menuitem" onClick={() => create(kind, picker.flow, picker.fromId)}>
                <Icon size={16} />
                <span>
                  <strong>{t.kinds[kind]}</strong>
                  <small>{t.kindHints[kind]}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom-left controls */}
      <div className="aic-controls-bar">
        <button type="button" className={!panMode ? "is-active" : ""} onClick={() => setPanMode(false)} title={t.select} aria-label={t.select}>
          <MousePointer2 size={15} />
        </button>
        <button type="button" className={panMode ? "is-active" : ""} onClick={() => setPanMode(true)} title={t.pan} aria-label={t.pan}>
          <Hand size={15} />
        </button>
        <button type="button" className={showMap ? "is-active" : ""} onClick={() => setShowMap(!showMap)} title={t.minimap} aria-label={t.minimap}>
          <MapIcon size={15} />
        </button>
        <span className="aic-controls-sep" />
        <button type="button" onClick={() => zoomOut({ duration: 150 })} title={t.zoomOut} aria-label={t.zoomOut}>
          <ZoomOut size={15} />
        </button>
        <span className="aic-zoom">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomIn({ duration: 150 })} title={t.zoomIn} aria-label={t.zoomIn}>
          <ZoomIn size={15} />
        </button>
        <button type="button" onClick={() => fitView({ padding: 0.2, duration: 300 })} title={t.fit} aria-label={t.fit}>
          <Maximize size={15} />
        </button>
      </div>

      {/* Chat */}
      {!chatOpen && (
        <button type="button" className="aic-chat-btn" onClick={() => setChatOpen(true)}>
          <MessageSquareText size={16} /> {t.chat}
        </button>
      )}

      {panel === "layers" && <LayersPanel onClose={() => setPanel(null)} onFocus={focusNode} />}
      {panel === "assets" && <AssetsPanel onClose={() => setPanel(null)} onAdd={(media) => useCanvasStore.getState().updateData(create("media"), media)} />}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} onCreate={create} />}
    </div>
  );
}

function PanelShell({ title, onClose, children, side = "left" }: { title: string; onClose: () => void; children: React.ReactNode; side?: "left" | "right" }) {
  return (
    <aside className={`aic-panel aic-panel-${side}`}>
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={onClose} aria-label="close">
          <X size={15} />
        </button>
      </header>
      <div className="aic-panel-body">{children}</div>
    </aside>
  );
}

function nodeLabel(node: CanvasNode, t: ReturnType<typeof getCopy>): string {
  const data = node.data as Record<string, unknown>;
  const kind = (node.type ?? "text") as CanvasNodeKind;
  const text = [data.title, data.name, data.prompt, data.text].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return text ? `${t.kinds[kind]} · ${text.slice(0, 28)}` : t.kinds[kind];
}

function LayersPanel({ onClose, onFocus }: { onClose: () => void; onFocus: (id: string) => void }) {
  const { t } = useCanvasContext();
  const nodes = useCanvasStore((s) => s.nodes);
  const removeNode = useCanvasStore((s) => s.removeNode);
  return (
    <PanelShell title={t.layers} onClose={onClose}>
      {nodes.length === 0 ? (
        <p className="aic-dim">{t.emptyLayers}</p>
      ) : (
        <ul className="aic-layer-list">
          {[...nodes].reverse().map((node) => {
            const Icon = KIND_ICONS[(node.type ?? "text") as CanvasNodeKind];
            return (
              <li key={node.id} className={node.selected ? "is-active" : ""}>
                <button type="button" onClick={() => onFocus(node.id)}>
                  <Icon size={14} />
                  <span>{nodeLabel(node, t)}</span>
                </button>
                <button type="button" onClick={() => removeNode(node.id)} aria-label={t.delete}>
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

interface AssetItem {
  id: string;
  url: string;
  key?: string;
  name: string;
  mediaType: MediaType;
}

function AssetsPanel({ onClose, onAdd }: { onClose: () => void; onAdd: (media: Partial<MediaData>) => void }) {
  const { t } = useCanvasContext();
  const nodes = useCanvasStore((s) => s.nodes);
  const [tab, setTab] = useState<"canvas" | "uploads" | "generated">("canvas");
  const [remote, setRemote] = useState<AssetItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const canvasItems = useMemo<AssetItem[]>(() => {
    const items: AssetItem[] = [];
    for (const node of nodes) {
      if (node.type === "media") {
        const m = node.data as MediaData;
        if (m.url) items.push({ id: node.id, url: m.url, key: m.key, name: m.name, mediaType: m.mediaType });
      } else if (node.type === "image" || node.type === "video" || node.type === "audio") {
        const g = node.data as GenerateData;
        g.urls.forEach((url, i) => items.push({ id: `${node.id}-${i}`, url, name: g.prompt.slice(0, 40), mediaType: node.type as MediaType }));
      }
    }
    return items;
  }, [nodes]);

  useEffect(() => {
    if (tab === "canvas") return;
    let cancelled = false;
    setLoading(true);
    setRemote(null);
    setSignedOut(false);
    const load = async () => {
      if (tab === "uploads") {
        const response = await fetch("/api/v1/library", { cache: "no-store" });
        if (response.status === 401) return "signedOut" as const;
        const payload = await response.json();
        return ((payload?.data?.assets ?? []) as { id: string; key: string; name: string; mimeType: string; url: string }[]).map(
          (a): AssetItem => ({
            id: a.id,
            url: a.url,
            key: a.key,
            name: a.name,
            mediaType: a.mimeType.startsWith("video/") ? "video" : a.mimeType.startsWith("audio/") ? "audio" : "image",
          }),
        );
      }
      const lists = await Promise.all(
        (["image", "video"] as const).map(async (type) => {
          const response = await fetch(`/api/v1/video/list?type=${type}&limit=24`, { cache: "no-store" });
          if (response.status === 401) return null;
          const payload = await response.json();
          const rows = (payload?.data?.videos ?? []) as { uuid: string; mediaUrls?: string[]; videoUrl?: string | null; prompt?: string; status: string }[];
          return rows
            .filter((r) => r.status === "COMPLETED")
            .map((r): AssetItem => ({ id: r.uuid, url: r.mediaUrls?.[0] ?? r.videoUrl ?? "", name: r.prompt?.slice(0, 40) ?? "", mediaType: type }))
            .filter((r) => r.url);
        }),
      );
      if (lists.every((l) => l === null)) return "signedOut" as const;
      return lists.flatMap((l) => l ?? []);
    };
    load()
      .then((result) => {
        if (cancelled) return;
        if (result === "signedOut") setSignedOut(true);
        else setRemote(result);
      })
      .catch(() => !cancelled && setRemote([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const items = tab === "canvas" ? canvasItems : (remote ?? []);
  return (
    <PanelShell title={t.assets} onClose={onClose}>
      <div className="aic-tabs">
        {(["canvas", "uploads", "generated"] as const).map((key) => (
          <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
            {key === "canvas" ? t.canvasAssets : key === "uploads" ? t.myUploads : t.generated}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="aic-panel-loading">
          <LoaderCircle className="aic-spin" size={18} />
        </div>
      ) : signedOut ? (
        <p className="aic-dim">{t.signIn}</p>
      ) : items.length === 0 ? (
        <p className="aic-dim">{t.emptyAssets}</p>
      ) : (
        <div className="aic-asset-grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="aic-asset"
              title={`${t.addToCanvas}: ${item.name}`}
              onClick={() => onAdd({ mediaType: item.mediaType, url: item.url, key: item.key, name: item.name })}
            >
              {item.mediaType === "image" ? (
                <img src={item.url} alt={item.name} loading="lazy" />
              ) : item.mediaType === "video" ? (
                <video src={item.url} muted preload="metadata" />
              ) : (
                <span className="aic-asset-audio">♪</span>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="aic-dim aic-small">{t.onlyImageUpload}</p>
    </PanelShell>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  prompt?: string;
}

function ChatPanel({ onClose, onCreate }: { onClose: () => void; onCreate: (kind: CanvasNodeKind, flow?: { x: number; y: number }, fromId?: string) => string }) {
  const { t, locale } = useCanvasContext();
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: t.chatWelcome }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("action", "plan");
      form.append("instruction", text);
      form.append("locale", locale);
      form.append("assets", "[]");
      const response = await fetch("/api/v1/creative-space/agent", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) throw new Error(t.signIn);
      if (!payload?.success) throw new Error(payload?.error?.message || t.chatError);
      setMessages((m) => [...m, { role: "assistant", text: payload.data.reply || "", prompt: payload.data.generationPrompt || undefined }]);
    } catch (error) {
      setMessages((m) => [...m, { role: "assistant", text: error instanceof Error ? error.message : t.chatError }]);
    } finally {
      setBusy(false);
    }
  };

  const addPrompt = (prompt: string, withVideo: boolean) => {
    const textId = onCreate("text");
    useCanvasStore.getState().updateData(textId, { text: prompt });
    if (withVideo) {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === textId);
      if (node) onCreate("video", { x: node.position.x + 400, y: node.position.y }, textId);
    }
  };

  return (
    <PanelShell title={t.chatTitle} onClose={onClose} side="right">
      <div className="aic-chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`aic-msg aic-msg-${m.role}`}>
            {m.text && <p>{m.text}</p>}
            {m.prompt && (
              <div className="aic-msg-prompt">
                <pre>{m.prompt}</pre>
                <div className="aic-row">
                  <button type="button" className="aic-btn-ghost" onClick={() => addPrompt(m.prompt as string, false)}>
                    {t.chatToText}
                  </button>
                  <button type="button" className="aic-btn-ghost" onClick={() => addPrompt(m.prompt as string, true)}>
                    {t.chatToVideo}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="aic-msg aic-msg-assistant">
            <p className="aic-dim">
              <LoaderCircle className="aic-spin" size={13} /> {t.chatThinking}
            </p>
          </div>
        )}
      </div>
      <form
        className="aic-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={input}
          rows={2}
          placeholder={t.chatPlaceholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t.chatSend}>
          <Send size={15} />
        </button>
      </form>
    </PanelShell>
  );
}
