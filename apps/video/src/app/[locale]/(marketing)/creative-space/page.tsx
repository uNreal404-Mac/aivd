import { StandaloneAgent } from "@/components/creative-space/standalone-agent";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const zh = locale.startsWith("zh");
  const alternates = buildAlternates("/creative-space", locale as never);
  return {
    title: zh ? "AGENT - AI 创作助手" : "AGENT - AI Creative Assistant",
    description: zh
      ? "与 AGENT 对话，梳理创意、分镜和生成提示词。"
      : "Chat with AGENT to develop ideas, storyboards, and generation prompts.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function CreativeSpacePage({ params }: Props) {
  const { locale } = await params;
  return <StandaloneAgent lang={locale} />;
}
