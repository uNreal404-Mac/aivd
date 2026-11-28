"use client";

import { MessageSquareText, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

const DRAFT_KEY = "aivd:help-contact-draft";

export function HelpContact({ lang }: { lang: string }) {
  const zh = lang === "zh";
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try { setMessage(localStorage.getItem(DRAFT_KEY) ?? ""); } catch { /* browser storage is optional */ }
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    try { localStorage.setItem(DRAFT_KEY, message.trim()); } catch { /* keep it in memory */ }
    setSaved(true);
  };
  return <section className="help-contact" aria-labelledby="help-contact-title">
    <div className="help-contact-intro"><span className="help-contact-icon"><MessageSquareText size={21} /></span><div><h2 id="help-contact-title">{zh ? "联系我们" : "Contact us"}</h2><p>{zh ? "使用中遇到问题，或有新的想法？欢迎留言。" : "Have a question or an idea? Leave us a message."}</p></div></div>
    <form onSubmit={submit}>
      <label htmlFor="help-contact-message">{zh ? "留言内容" : "Your message"}</label>
      <textarea id="help-contact-message" value={message} maxLength={2000} rows={4} onChange={(event) => { setMessage(event.target.value); setSaved(false); }} placeholder={zh ? "请描述遇到的问题或希望改进的地方…" : "Describe the issue or what you would like to improve…"} />
      <div className="help-contact-actions"><small>{zh ? "目前仅在本设备暂存，反馈接收功能稍后接入。" : "Saved on this device for now. Message delivery is coming soon."}</small><button type="submit" disabled={!message.trim()}><Send size={15} />{zh ? "发送" : "Send"}</button></div>
      {saved && <output className="help-contact-status">{zh ? "留言已暂存，接收通道接入后即可正式发送。" : "Message saved here. Delivery will be available soon."}</output>}
    </form>
  </section>;
}
