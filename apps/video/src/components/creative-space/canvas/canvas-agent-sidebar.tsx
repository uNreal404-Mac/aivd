"use client";

import { ArrowUp, Bot, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

type Message = { role: "user" | "agent"; text: string; prompt?: string };

export function CanvasAgentSidebar({ zh, hidden, onClose, onSend, onApply }: {
  zh: boolean;
  hidden: boolean;
  onClose: () => void;
  onSend: (question: string, history: Message[]) => Promise<{ reply: string; prompt: string }>;
  onApply: (prompt: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const previous = messages;
    setQuestion(""); setError(""); setBusy(true);
    setMessages([...previous, { role: "user", text }]);
    try {
      const result = await onSend(text, previous);
      setMessages(current => [...current, { role: "agent", text: result.reply, prompt: result.prompt }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : zh ? "Agent 暂时不可用，请重试" : "Agent is unavailable. Try again.");
    } finally { setBusy(false); }
  };
  return <aside hidden={hidden} className="nc-agent-sidebar" aria-label={zh ? "画布 Agent 对话" : "Canvas Agent chat"}>
    <div className="nc-agent-sidebar-head"><span><Bot size={19} />Agent <small>DeepSeek Flash</small></span></div>
    <div className="nc-agent-messages" role="log" aria-live="polite">
      {messages.length === 0 && <div className="nc-agent-empty"><Sparkles size={25}/><strong>{zh ? "一起构思画布" : "Create together"}</strong>
        <p>{zh ? "告诉我想做的画面或影片。我会结合当前画布素材，帮你整理创意和提示词。" : "Describe your image or film. I can use this canvas to help plan and write prompts."}</p></div>}
      {messages.map((message, index) => <article key={index} className={`nc-agent-message is-${message.role}`}>
        <p>{message.text}</p>
        {message.prompt && <button type="button" onClick={() => onApply(message.prompt!)}>{zh ? "应用提示词到画布" : "Apply prompt to canvas"}</button>}
      </article>)}
      {busy && <div className="nc-agent-thinking"><Loader2 className="nc-spin" size={15}/>{zh ? "思考中…" : "Thinking…"}</div>}
    </div>
    <form className="nc-agent-compose" onSubmit={event => void send(event)}>
      <textarea value={question} maxLength={3500} onChange={event => setQuestion(event.target.value)}
        placeholder={zh ? "例如：把 @A 放在片头，帮我规划分镜……" : "For example: put @A in the opening shot…"}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>
      {error && <p role="alert">{error}</p>}
      <div><small>{zh ? "可让 Agent 协助编辑创作" : "Ask Agent to help create"}</small>
        <button type="submit" disabled={busy || !question.trim()} aria-label={zh ? "发送给 Agent" : "Send to Agent"}><ArrowUp size={18}/></button></div>
    </form>
    <button type="button" className="nc-agent-collapse" onClick={onClose} aria-label={zh ? "收起 Agent 对话栏" : "Collapse Agent sidebar"}
      title={zh ? "收起 Agent 对话栏" : "Collapse Agent sidebar"}><ChevronLeft size={17}/><span>{zh ? "收起" : "Hide"}</span></button>
  </aside>;
}
