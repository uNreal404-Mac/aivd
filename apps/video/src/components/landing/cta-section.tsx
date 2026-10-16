"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { BlurFade } from "@/components/magicui/blur-fade";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { BorderBeam } from "@/components/magicui/border-beam";
import { LocaleLink } from "@/i18n/navigation";
import { cn } from "@/components/ui";
import { NEW_USER_GIFT } from "@/config/pricing-user";

/**
 * CTA Section - 行动号召区域
 *
 * 设计模式: Social Proof + CTA
 * - 用户头像展示社交证明
 * - Marquee 滚动展示评价
 * - Glassmorphism 风格卡片
 */

// 优势列表
const benefits = [
  { icon: Check, labelKey: "benefits.free", color: "text-[var(--du-success)]" },
  { icon: Check, labelKey: "benefits.noCard", color: "text-[var(--du-success)]" },
  { icon: Check, labelKey: "benefits.cancel", color: "text-[var(--du-success)]" },
  { icon: Check, labelKey: "benefits.support", color: "text-[var(--du-success)]" },
];

export function CTASection() {
  const t = useTranslations("CTA");

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[image:var(--du-gradient)] opacity-[0.05]" />
      </div>

      <div className="container mx-auto px-4">
        <div className="relative max-w-6xl mx-auto">
          {/* 主要 CTA 卡片 */}
          <BlurFade inView>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl border border-border bg-card dark:bg-[var(--du-glass-bg-strong)] backdrop-blur-xl overflow-hidden shadow-2xl"
            >
              {/* 边框光效 */}
              <BorderBeam
                size={400}
                duration={12}
                anchor={90}
                borderWidth={2}
                colorFrom="var(--du-accent)"
                colorTo="var(--du-accent-2)"
              />

              {/* 顶部渐变装饰 */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[image:var(--du-gradient)]" />

              <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12">
                {/* 左侧: 内容 */}
                <div className="space-y-6">
                  {/* 徽章 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {t("badge")}
                    </span>
                  </motion.div>

                  {/* 标题 */}
                  <h2 className="text-3xl md:text-4xl font-bold">
                    {t("title")}
                    <span className="block bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mt-2">
                      {t("subtitle")}
                    </span>
                  </h2>

                  {/* 描述 */}
                  <p className="text-lg text-muted-foreground">
                    {t("description")}
                  </p>

                  {/* 优势列表 */}
                  <ul className="space-y-3">
                    {benefits.map((benefit, index) => {
                      const Icon = benefit.icon;
                      return (
                        <motion.li
                          key={benefit.labelKey}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3 text-muted-foreground"
                        >
                          <Icon className={cn("h-5 w-5 shrink-0", benefit.color)} />
                          <span>{t(benefit.labelKey, { credits: NEW_USER_GIFT.credits })}</span>
                        </motion.li>
                      );
                    })}
                  </ul>

                  {/* CTA 按钮组 */}
                  <div className="flex flex-wrap gap-4 pt-4">
                    <LocaleLink href="/#generator">
                      <ShimmerButton
                        shimmerColor="var(--du-on-accent)"
                        shimmerSize="0.05em"
                        shimmerDuration="3s"
                        borderRadius="100px"
                        background="var(--du-accent)"
                        className="px-8 py-3 text-base font-medium shadow-lg shadow-primary/25"
                      >
                        {t("getStarted")}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </ShimmerButton>
                    </LocaleLink>

                  </div>

                  {/* 社交证明 - 头像 (Hidden for audit) */}
                  {/* <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-4 pt-4"
                  >
                    <AvatarCircles
                      numPeople={500000}
                      avatarUrls={avatarUrls}
                      className="justify-start"
                    />
                    <div className="text-sm">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-[var(--du-warning)] text-[var(--du-warning)]" />
                        ))}
                      </div>
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">4.9/5</span>{" "}
                        {t("from")} 2,000+ {t("reviews")}
                      </p>
                    </div>
                  </motion.div> */}
                </div>

                {/* 右侧: 预览卡片 */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  {/* 装饰性光晕 */}
                  <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full blur-3xl -z-10 bg-[var(--du-accent)]/30" />
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl -z-10 bg-[var(--du-accent-2)]/20" />

                  {/* 视频预览卡片 */}
                  <div className="relative rounded-2xl border border-border dark:border-[var(--du-glass-border)] bg-muted dark:bg-[var(--du-glass-bg)] backdrop-blur-sm overflow-hidden">
                    {/* 静态图片预览 (Video preview replaced with image for audit) */}
                    <div className="aspect-video bg-muted/80 flex items-center justify-center overflow-hidden">
                      <motion.img
                        src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80"
                        alt="AI Video Generation Preview"
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>

                    {/* 模拟进度条 - 保持不动或移除动画 */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("generating")}</span>
                        <span className="font-medium text-primary">100%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full w-full bg-[image:var(--du-gradient)]" />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {t("readyIn")} 2-5 {t("minutes")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </BlurFade>

        </div>
      </div>
    </section>
  );
}
