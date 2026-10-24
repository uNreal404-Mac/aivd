/**
 * ToolLandingPage Component
 *
 * 工具页面落地页组件，用于未登录用户
 *
 * 根据工具页面配置动态显示：
 * - Hero 区域（标题、描述、CTA）
 * - 示例视频展示
 * - 特性列表
 * - 支持的模型展示
 * - 统计数据（可选）
 *
 * SEO 友好，支持服务端渲染
 */

"use client";

import { Play, ArrowRight, Sparkles, Check, Users, Video } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/components/ui";
import { BlurFade } from "@/components/magicui/blur-fade";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import type { ToolPageConfig } from "@/config/tool-pages";

// ============================================================================
// Props
// ============================================================================

export interface ToolLandingPageProps {
  /**
   * 工具页面配置
   */
  config: ToolPageConfig;

  /**
   * 当前语言
   */
  locale?: string;

  /**
   * 额外的 CSS 类名
   */
  className?: string;
}

// ============================================================================
// ToolLandingPage Component
// ============================================================================

/**
 * ToolLandingPage - 工具页面落地页
 *
 * 根据配置动态显示落地页内容
 *
 * @example
 * ```tsx
 * import { imageToVideoConfig } from "@/config/tool-pages";
 *
 * <ToolLandingPage
 *   config={imageToVideoConfig}
 *   locale="en"
 * />
 * ```
 */
export function ToolLandingPage({
  config,
  locale = "en",
  className,
}: ToolLandingPageProps) {
  const { landing, i18nPrefix } = config;
  const isChinese = locale.toLowerCase().startsWith("zh");
  const zhLanding = {
    "text-to-video": {
      hero: {
        title: "用文字创作精彩视频",
        description: "用自然语言描述你的创意，让 AI 将它变成生动影像。从电影场景到产品展示，灵感都能快速落地。",
        ctaText: "开始创作",
        ctaSubtext: "注册即可获得免费体验积分",
      },
      examples: [
        { title: "电影感山景", prompt: "金色时刻的壮丽山脉，镜头缓缓飞过山谷" },
        { title: "城市延时摄影", prompt: "纽约夜景延时，车流形成光轨，建筑闪耀" },
        { title: "海上日落", prompt: "平静海浪与落日，镜头缓缓拉远，氛围安宁" },
      ],
      features: ["用自然语言描述想看的画面", "支持多种 Seedance AI 模型", "最高 1080p 的电影感画质", "可自动生成音频与音效", "适配各类平台的多种画面比例"],
    },
    "image-to-video": {
      hero: {
        title: "让静态图片变成精彩视频",
        description: "上传任意照片，让 AI 以流畅自然的运动赋予它生命，适合社交媒体、营销和创意项目。",
        ctaText: "免费开始",
        ctaSubtext: "注册即可获得免费体验积分",
      },
      examples: [
        { title: "照片变成鲜活场景", prompt: "女孩走在海滩上，发丝随风飘动，金色夕阳" },
        { title: "产品动画", prompt: "智能手机在白色背景中旋转，粒子漂浮" },
        { title: "抽象艺术动画", prompt: "色彩与形状平滑流动变换，迷幻风格" },
      ],
      features: ["支持 JPG、PNG、WEBP 图片", "多种模型适配不同动画风格", "最高 1080p 全高清输出", "通常数分钟内完成生成", "包含商业使用授权"],
    },
    "reference-to-video": {
      hero: {
        title: "用 AI 延展你的参考画面",
        description: "上传参考素材，在保留核心内容的同时创建风格变化、视觉特效或新的镜头版本。",
        ctaText: "立即体验",
        ctaSubtext: "注册即可获得免费体验积分",
      },
      examples: [
        { title: "风格转换", prompt: "转换为色彩鲜明的动漫风格" },
        { title: "添加天气效果", prompt: "为场景加入雨雾氛围" },
        { title: "改变季节", prompt: "把夏日场景变成飘雪的冬季" },
      ],
      features: ["上传参考素材开始创作", "AI 驱动的风格转换", "保持原有节奏与画面逻辑", "从同一参考生成多个版本", "支持多种艺术风格与特效"],
    },
  } as const;
  const zhContent = config.generator.mode in zhLanding
    ? zhLanding[config.generator.mode as keyof typeof zhLanding]
    : undefined;
  const content = isChinese && zhContent
    ? {
        ...landing,
        hero: zhContent.hero,
        examples: landing.examples.map((example, index) => ({
          ...example,
          ...(zhContent.examples[index] ?? {}),
        })),
        features: [...zhContent.features],
      }
    : landing;
  void i18nPrefix;
  const labels = isChinese
    ? {
        powered: "AI 智能驱动",
        examples: "示例",
        features: "功能亮点",
        models: "由领先 AI 模型提供支持",
        videos: "已生成视频",
        users: "创作者",
        rating: "平均评分",
        ready: "准备好创作精彩视频了吗？立即注册并开始创作。",
        start: "免费开始",
      }
    : {
        powered: "AI-Powered",
        examples: "Examples",
        features: "Features",
        models: "Powered by Leading AI Models",
        videos: "Videos Generated",
        users: "Happy Users",
        rating: "Average Rating",
        ready: "Ready to create amazing videos? Sign up now and get started!",
        start: "Get Started Free",
      };

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-12">
        {/* Hero Section */}
        <BlurFade inView>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-4"
          >
            {/* 徽章 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4"
            >
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {labels.powered}
              </span>
            </motion.div>

            {/* 标题 */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              {content.hero.title}
            </h1>

            {/* 描述 */}
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" suppressHydrationWarning>
              {content.hero.description}
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href={`/${locale}/login`}>
                <ShimmerButton
                  shimmerColor="#ffffff"
                  shimmerSize="0.05em"
                  shimmerDuration="3s"
                  borderRadius="100px"
                  background="linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)"
                  className="px-8 py-3 text-base font-medium shadow-lg shadow-blue-500/25"
                >
                  {content.hero.ctaText}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </ShimmerButton>
              </Link>
              {content.hero.ctaSubtext && (
                <span className="text-sm text-muted-foreground">
                  {content.hero.ctaSubtext}
                </span>
              )}
            </div>
          </motion.div>
        </BlurFade>

        {/* Examples Section */}
        {content.examples.length > 0 && (
          <BlurFade delay={0.1} inView>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold">{labels.examples}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {content.examples.map((example, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
                    className="group relative aspect-video rounded-xl overflow-hidden border border-border bg-muted cursor-pointer"
                  >
                    <img
                      src={example.thumbnail}
                      alt={example.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-5 w-5 text-foreground fill-foreground ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-sm font-medium">{example.title}</p>
                      <p className="text-white/70 text-xs truncate">{example.prompt}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </BlurFade>
        )}

        {/* Features Section */}
        {content.features.length > 0 && (
          <BlurFade delay={0.2} inView>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-muted/30 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-semibold flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
                {labels.features}
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.features.map((feature, index: number) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-start gap-2"
                  >
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </BlurFade>
        )}

        {/* Supported Models */}
        {landing.supportedModels.length > 0 && (
          <BlurFade delay={0.3} inView>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-center">{labels.models}</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {landing.supportedModels.map((model, index: number) => (
                  <motion.div
                    key={model.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="px-4 py-2 rounded-lg border border-border bg-background hover:border-border/80 transition-colors"
                    style={{
                      borderColor: index === 0 ? model.color : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: model.color }}
                      />
                      <div className="text-sm">
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-muted-foreground">{model.provider}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </BlurFade>
        )}

        {/* Stats Section (optional) */}
        {landing.stats && (
          <BlurFade delay={0.4} inView>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-3 gap-4 py-8"
            >
              {landing.stats.videosGenerated && (
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                    <Video className="h-5 w-5 text-blue-500" />
                    {landing.stats.videosGenerated}
                  </div>
                  <div className="text-xs text-muted-foreground">{labels.videos}</div>
                </div>
              )}
              {landing.stats.usersCount && (
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                    <Users className="h-5 w-5 text-purple-500" />
                    {landing.stats.usersCount}
                  </div>
                  <div className="text-xs text-muted-foreground">{labels.users}</div>
                </div>
              )}
              {landing.stats.avgRating && (
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-yellow-500">
                    {landing.stats.avgRating} ★
                  </div>
                  <div className="text-xs text-muted-foreground">{labels.rating}</div>
                </div>
              )}
            </motion.div>
          </BlurFade>
        )}

        {/* Bottom CTA */}
        <BlurFade delay={0.5} inView>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center pt-8 border-t border-border"
          >
            <p className="text-muted-foreground mb-4">
              {labels.ready}
            </p>
            <Link href={`/${locale}/login`}>
              <ShimmerButton
                shimmerColor="#ffffff"
                shimmerSize="0.05em"
                shimmerDuration="3s"
                borderRadius="100px"
                background="linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)"
                className="px-8 py-3 text-base font-medium"
              >
                {labels.start}
                <ArrowRight className="ml-2 h-5 w-5" />
              </ShimmerButton>
            </Link>
          </motion.div>
        </BlurFade>
      </div>
    </div>
  );
}

export default ToolLandingPage;
