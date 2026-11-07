"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ImagePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { TOOL_PREFILL_KEY } from "@/components/gallery/use-template";
import { localizedHref } from "@/lib/du-home";
import { ScreeningPlayer } from "./screening-player";
import styles from "./studio-hero.module.css";

const en = {
  title: ["AI VIDEO GENERATOR.", "STUDIO-GRADE RESULTS."],
  description: "Write a shot from scratch, or borrow a prompt from the screening room.",
  label: "Your shot",
  placeholder: "A close-up at the marina. A woman raises her glass as the camera moves closer…",
  submit: "Open video studio",
  fromImage: "Start with an image",
  empty: "Describe your shot, or use a prompt from one of the films.",
  unavailable: "Your browser could not carry this prompt to the studio. Enable site storage and try again.",
};

const zh = {
  title: ["AI 视频生成器。", "电影级创作效果。"],
  description: "写下你想拍的镜头，或选一条样片，把它的提示词改成自己的分镜。",
  label: "你的分镜",
  placeholder: "码头边的特写。她举起酒杯，镜头缓缓靠近，海面反射着夕阳……",
  submit: "打开视频工作台",
  fromImage: "从一张图片开始",
  empty: "请先写下分镜，或选用一条样片的提示词。",
  unavailable: "浏览器未能保存这段提示词。请允许网站存储后再打开工作台。",
};

export function StudioHero({ lang }: { lang: string }) {
  const isChinese = lang.startsWith("zh");
  const copy = isChinese ? zh : en;
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");

  function useShot(value: string) {
    setPrompt(value);
    setError("");
    input.current?.focus();
  }

  function openStudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError(copy.empty);
      input.current?.focus();
      return;
    }

    try {
      sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify({ prompt: trimmed }));
    } catch {
      setError(copy.unavailable);
      return;
    }
    router.push(localizedHref(lang, "/text-to-video"));
  }

  return (
    <section className={styles.hero} aria-labelledby="studio-headline">
      <div className={styles.layout}>
        <div className={styles.desk}>
          <h1 id="studio-headline" className={styles.headline} lang={lang}>
            {copy.title[0]}<br />{copy.title[1]}
          </h1>
          <p className={styles.intro}>{copy.description}</p>
          <form className={styles.composer} onSubmit={openStudio}>
            <label htmlFor="hero-prompt">{copy.label}</label>
            <textarea
              id="hero-prompt"
              ref={input}
              value={prompt}
              maxLength={2000}
              rows={3}
              placeholder={copy.placeholder}
              onChange={(event) => { setPrompt(event.target.value); setError(""); }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "shot-error" : undefined}
            />
            {error && <p id="shot-error" role="alert" className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button className={styles.primary} type="submit">{copy.submit}<ArrowRight size={16} aria-hidden="true" /></button>
              <Link className={styles.fromImage} href={localizedHref(lang, "/image-to-video")}>
                <ImagePlus size={15} aria-hidden="true" />{copy.fromImage}
              </Link>
            </div>
          </form>
        </div>
        <div className={styles.screen}>
          <ScreeningPlayer lang={lang} onUsePrompt={useShot} />
        </div>
      </div>
    </section>
  );
}
