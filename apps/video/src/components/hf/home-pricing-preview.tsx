"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

type Plan = { name: string; priceUsd: number; credits: number; period: "month" | "year"; popular: boolean };

export function HomePricingPreview({ lang, plans, models }: { lang: string; plans: Plan[]; models: string[] }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const visible = plans.filter((plan) => plan.period === period);

  return (
    <section className="bg-[var(--du-bg)] px-6 py-20 text-[var(--du-text)]" aria-labelledby="home-pricing-title">
      <div className="mx-auto max-w-[1680px]">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--du-accent-text)]">{zh ? "创作套餐" : "Create more"}</p>
          <h2 id="home-pricing-title" className="mt-3 text-4xl font-semibold sm:text-5xl">{zh ? "选择适合你的套餐" : "Choose your plan"}</h2>
          <p className="mt-4 text-sm text-[var(--du-text-muted)]">{zh ? "以下金额与积分来自当前套餐配置，结账以前往定价页显示为准。" : "Plan amounts and credits reflect the current configuration. Review final checkout details on the pricing page."}</p>
          <div className="mt-7 inline-flex rounded-full border border-[var(--du-border)] bg-[var(--du-surface)] p-1">
            {(["month", "year"] as const).map((option) => <button key={option} type="button" aria-pressed={period === option} onClick={() => setPeriod(option)} className={`rounded-full px-5 py-2 text-sm transition-colors ${period === option ? "bg-[var(--du-accent)] font-semibold text-[var(--du-on-accent)]" : "text-[var(--du-text-muted)]"}`}>{option === "month" ? (zh ? "月付" : "Monthly") : (zh ? "年付" : "Yearly")}</button>)}
          </div>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {visible.map((plan) => {
            const baseName = plan.name.replace(/ \(Yearly\)$/, "");
            const monthlyCredits = period === "year" ? Math.floor(plan.credits / 12) : plan.credits;
            return <article key={plan.name} className={`relative flex flex-col rounded-[28px] border p-6 ${plan.popular ? "border-[var(--du-accent)] bg-[var(--du-surface-2)] shadow-[var(--du-glow)]" : "border-[var(--du-border)] bg-[var(--du-surface)]"}`}>
              {plan.popular ? <span className="absolute right-5 top-5 rounded-full bg-[var(--du-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--du-on-accent)]">{zh ? "热门选择" : "Popular"}</span> : null}
              <h3 className="text-2xl font-semibold">{baseName}</h3>
              <p className="mt-2 text-sm text-[var(--du-text-muted)]">{zh ? "按实际使用消耗积分" : "Credits are used as you create"}</p>
              <div className="mt-6 rounded-2xl border border-[var(--du-border)] bg-[var(--du-bg)] p-4"><span className="flex items-center gap-2 text-xl font-semibold text-[var(--du-accent-text)]"><Sparkles className="h-5 w-5" />{monthlyCredits.toLocaleString()} {zh ? "积分/月" : "credits/month"}</span><p className="mt-2 text-xs text-[var(--du-text-muted)]">{period === "year" ? (zh ? `全年共 ${plan.credits.toLocaleString()} 积分` : `${plan.credits.toLocaleString()} credits for the year`) : (zh ? "每月发放" : "Issued monthly")}</p></div>
              <p className="mt-6 text-4xl font-semibold">US${period === "year" ? (plan.priceUsd / 12).toFixed(2) : plan.priceUsd.toFixed(2)}<span className="ml-2 text-sm font-normal text-[var(--du-text-muted)]">/{zh ? "月" : "month"}</span></p>
              {period === "year" ? <p className="mt-1 text-xs text-[var(--du-text-muted)]">{zh ? `按年支付 US$${plan.priceUsd.toFixed(2)}` : `Billed yearly at US$${plan.priceUsd.toFixed(2)}`}</p> : null}
              <Link href={`/${lang}/pricing`} className={`mt-6 flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${plan.popular ? "bg-[var(--du-accent)] text-[var(--du-on-accent)]" : "border border-[var(--du-border-strong)] text-[var(--du-text)] hover:border-[var(--du-accent)]"}`}>{zh ? "查看套餐" : "View plan"}<ArrowRight className="h-4 w-4" /></Link>
              <div className="mt-7 border-t border-[var(--du-border)] pt-5"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--du-text-muted)]">{zh ? "当前启用的视频模型" : "Currently enabled video models"}</p><ul className="mt-3 space-y-2">{models.map((model) => <li key={model} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-[var(--du-accent-text)]" />{model}</li>)}</ul></div>
            </article>;
          })}
        </div>
      </div>
    </section>
  );
}
