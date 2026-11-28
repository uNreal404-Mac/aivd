"use client";

import Link from "next/link";
import { ArrowUp, Bot, Check, ChevronLeft, Copy, Menu, MessageSquare, Plus, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import { localizedHref } from "@/lib/du-home";
import { AGENT_CANVAS_HANDOFF, agentCanvasTitle } from "@/lib/creative-space/agent-canvas-handoff";
import "./standalone-agent.css";

type Message = { id: string; role: "user" | "agent"; text: string; prompt?: string };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const STORAGE_PREFIX = "aivd:standalone-agent:";
const PENDING_DRAFT = "aivd:standalone-agent:pending-draft";

function readConversations(key: string): Conversation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 30).flatMap((item): Conversation[] => {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !Array.isArray(item.messages)) return [];
      const messages: Message[] = item.messages.slice(-60).flatMap((message: unknown): Message[] => {
        if (!message || typeof message !== "object" || !("role" in message) || !("text" in message)) return [];
        if ((message.role !== "user" && message.role !== "agent") || typeof message.text !== "string") return [];
        const saved = message as Record<string, unknown>;
        return [{ id: typeof saved.id === "string" ? saved.id : newId(), role: message.role, text: message.text.slice(0, 5000), prompt: typeof saved.prompt === "string" ? saved.prompt.slice(0, 5000) : undefined }];
      });
      return [{ id: item.id, title: typeof item.title === "string" ? item.title.slice(0, 80) : "AGENT", messages, updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now() }];
    });
  } catch {
    return [];
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return fallback;
}

export function StandaloneAgent({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const { data: session, isPending: sessionLoading } = useSession();
  const signIn = useSigninModal();
  const owner = session?.user?.id ?? "guest";
  const storageKey = `${STORAGE_PREFIX}${owner}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    requestRef.current?.abort();
    const saved = readConversations(storageKey);
    setConversations(saved);
    setActiveId(saved[0]?.id ?? null);
    setError("");
    setLoadedKey(storageKey);
    if (session?.user?.id) {
      try {
        const pending = sessionStorage.getItem(PENDING_DRAFT);
        if (pending) { setDraft(pending); sessionStorage.removeItem(PENDING_DRAFT); }
      } catch { /* Private browsing can disable storage. */ }
    }
  }, [sessionLoading, session?.user?.id, storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(conversations.slice(0, 30).map((conversation) => ({ ...conversation, messages: conversation.messages.slice(-60) })))); }
    catch { /* Conversation continues in memory if storage is unavailable. */ }
  }, [conversations, loadedKey, storageKey]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [activeId, conversations, busy]);
  useEffect(() => () => requestRef.current?.abort(), []);

  const active = conversations.find((item) => item.id === activeId);
  const messages = active?.messages ?? [];

  const startNew = () => {
    requestRef.current?.abort();
    setBusy(false);
    setActiveId(null);
    setDraft("");
    setError("");
    setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy || loadedKey !== storageKey) return;
    if (!session?.user?.id) {
      try { sessionStorage.setItem(PENDING_DRAFT, question); } catch { /* Draft stays in the composer. */ }
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }

    const threadId = activeId ?? newId();
    const userMessage: Message = { id: newId(), role: "user", text: question };
    const previous = active?.messages ?? [];
    const title = active?.title ?? question.replace(/\s+/g, " ").slice(0, 30);
    setConversations((current) => {
      const rest = current.filter((item) => item.id !== threadId);
      return [{ id: threadId, title, messages: [...previous, userMessage], updatedAt: Date.now() }, ...rest];
    });
    setActiveId(threadId);
    setDraft("");
    setError("");
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const conversation = previous.slice(-6).map((item) => `${item.role === "user" ? "User" : "Agent"}: ${item.text.slice(0, 500)}`).join("\n");
      const instruction = [
        zh ? "请作为创作助手与用户自然对话，帮助构思画面、影片和提示词。" : "Chat naturally as a creative assistant. Help develop images, films, and prompts.",
        conversation,
        `${zh ? "用户" : "User"}: ${question}`,
      ].filter(Boolean).join("\n\n").slice(0, 5000);
      const form = new FormData();
      form.set("action", "plan");
      form.set("instruction", instruction);
      form.set("locale", lang);
      const response = await fetch("/api/v1/creative-space/agent", {
        method: "POST",
        headers: { "X-Media-Account": session.user.id },
        body: form,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object" || !("data" in payload)) {
        if (response.status === 401) signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
        throw new Error(errorMessage(payload, zh ? "AGENT 暂时不可用，请稍后重试。" : "AGENT is unavailable. Please try again."));
      }
      const result = payload.data as { reply?: unknown; generationPrompt?: unknown };
      if (typeof result.reply !== "string" || !result.reply.trim()) throw new Error(zh ? "AGENT 没有返回内容，请重试。" : "AGENT returned no message. Please try again.");
      const agentMessage: Message = { id: newId(), role: "agent", text: result.reply, prompt: typeof result.generationPrompt === "string" ? result.generationPrompt : undefined };
      setConversations((current) => current.map((item) => item.id === threadId ? { ...item, messages: [...item.messages, agentMessage], updatedAt: Date.now() } : item));
    } catch (cause) {
      setConversations((current) => current.flatMap((item) => {
        if (item.id !== threadId) return [item];
        const remaining = item.messages.filter((message) => message.id !== userMessage.id);
        return remaining.length ? [{ ...item, messages: remaining }] : [];
      }));
      if (!controller.signal.aborted) {
        setDraft(question);
        setError(cause instanceof Error ? cause.message : zh ? "发送失败，请重试。" : "Could not send. Please try again.");
      }
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  };

  const copyText = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1800);
    } catch { /* Clipboard may be blocked by the browser. */ }
  };

  const continueOnCanvas = (prompt: string) => {
    const path = localizedHref(lang, "/creative-space/canvas");
    const token = newId();
    const history = messages.map(({ role, text, prompt: suggestion }) => ({ role, text, ...(suggestion ? { prompt: suggestion } : {}) }));
    try {
      sessionStorage.setItem(`${AGENT_CANVAS_HANDOFF}${token}`, JSON.stringify({
        ownerId: owner,
        title: agentCanvasTitle(history, active?.title ?? (zh ? "创意画布" : "Creative canvas")),
        prompt,
        messages: history,
      }));
      window.location.assign(`${path}?agentHandoff=${encodeURIComponent(token)}`);
    } catch {
      window.location.assign(`${path}?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  const suggestions = zh
    ? ["帮我构思一支产品短片", "把一个故事拆成分镜", "优化我的视频生成提示词"]
    : ["Help me plan a product film", "Turn a story into shots", "Improve my video prompt"];

  return <div className="agent-page">
    <div className="agent-shell">
      <aside className={`agent-history${sidebarOpen ? " is-open" : ""}`} aria-label={zh ? "对话历史" : "Chat history"}>
        <div className="agent-history-top"><span className="agent-wordmark"><Sparkles size={19} /> AGENT</span><button type="button" className="agent-mobile-close" onClick={() => setSidebarOpen(false)} aria-label={zh ? "关闭历史记录" : "Close history"}><X size={20} /></button></div>
        <button type="button" className="agent-new" onClick={startNew}><Plus size={17} />{zh ? "新对话" : "New chat"}</button>
        <div className="agent-history-label">{zh ? "最近对话" : "Recent chats"}</div>
        <div className="agent-history-list">
          {conversations.map((item) => <div key={item.id} className={`agent-history-row${activeId === item.id ? " is-active" : ""}`}>
            <button type="button" className="agent-history-select" onClick={() => { setActiveId(item.id); setError(""); setSidebarOpen(false); }}><MessageSquare size={15} /><span>{item.title}</span></button>
            <button type="button" className="agent-history-delete" aria-label={zh ? `删除对话 ${item.title}` : `Delete chat ${item.title}`} onClick={() => { setConversations((current) => current.filter((conversation) => conversation.id !== item.id)); if (activeId === item.id) setActiveId(null); }}><Trash2 size={14} /></button>
          </div>)}
          {conversations.length === 0 && <p className="agent-history-empty">{zh ? "从一个想法开始。" : "Start with an idea."}</p>}
        </div>
        <div className="agent-history-foot">{zh ? "对话仅保存在此浏览器" : "Chats are saved in this browser"}</div>
      </aside>

      {sidebarOpen && <button type="button" className="agent-scrim" onClick={() => setSidebarOpen(false)} aria-label={zh ? "关闭侧栏" : "Close sidebar"} />}
      <section className="agent-main" aria-label={zh ? "AGENT 对话" : "AGENT chat"}>
        <header className="agent-toolbar">
          <div className="agent-toolbar-title"><button type="button" className="agent-mobile-menu" onClick={() => setSidebarOpen(true)} aria-label={zh ? "打开历史记录" : "Open history"}><Menu size={21} /></button><span className="agent-toolbar-icon"><Bot size={18} /></span><strong>AGENT</strong></div>
          <Link href={localizedHref(lang, "/creative-space/canvas")} className="agent-canvas-link">{zh ? "前往画布" : "Open canvas"}<ChevronLeft size={14} /></Link>
        </header>

        <div className="agent-scroll" role="log" aria-live="polite">
          {messages.length === 0 ? <div className="agent-welcome">
            <div className="agent-welcome-mark"><WandSparkles size={31} strokeWidth={1.6} /></div>
            <div className="agent-welcome-eyebrow">YOUR CREATIVE PARTNER</div>
            <h1>{zh ? "今天想创作什么？" : "What will you create today?"}</h1>
            <p>{zh ? "从一句灵感开始。和 AGENT 聊聊你的画面、故事或想法，一起把它变得更清晰。" : "Start with a spark. Talk through an image, story, or idea and shape it into something clear."}</p>
            <div className="agent-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion}<ArrowUp size={14} /></button>)}</div>
          </div> : <div className="agent-messages">{messages.map((message) => <article key={message.id} className={`agent-message is-${message.role}`}>
            <div className="agent-message-avatar">{message.role === "agent" ? <Bot size={17} /> : (session?.user?.name?.slice(0, 1) || "U").toUpperCase()}</div>
            <div className="agent-message-body"><div className="agent-message-name">{message.role === "agent" ? "AGENT" : zh ? "你" : "You"}</div><p>{message.text}</p>
              {message.role === "agent" && <div className="agent-message-actions"><button type="button" onClick={() => void copyText(message)}>{copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}{copiedId === message.id ? (zh ? "已复制" : "Copied") : (zh ? "复制" : "Copy")}</button>{message.prompt && <button type="button" onClick={() => continueOnCanvas(message.prompt!)}>{zh ? "在画布中继续" : "Continue on canvas"}<ArrowUp size={13} /></button>}</div>}
            </div>
          </article>)}
          {busy && <div className="agent-thinking"><span className="agent-thinking-dots"><i /><i /><i /></span>{zh ? "AGENT 正在思考" : "AGENT is thinking"}</div>}
          </div>}
          <div ref={bottomRef} />
        </div>

        <div className="agent-bottom"><form className="agent-composer" onSubmit={(event) => void send(event)}>
          <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={3500} rows={2} placeholder={zh ? "向 AGENT 发送消息…" : "Message AGENT…"} aria-label={zh ? "向 AGENT 发送消息" : "Message AGENT"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <div className="agent-composer-bottom"><button type="submit" disabled={!draft.trim() || busy || loadedKey !== storageKey} aria-label={zh ? "发送消息" : "Send message"}><ArrowUp size={19} /></button></div>
        </form>{error && <p className="agent-error" role="alert">{error}</p>}<p className="agent-disclaimer">{zh ? "AGENT 的建议请在生成前确认。" : "Review AGENT's suggestions before generating."}</p></div>
      </section>
    </div>
  </div>;
}
