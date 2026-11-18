import { CreativeSpaceHome } from "@/components/creative-space/creative-space-home";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const zh = locale.startsWith("zh");
  const alternates = buildAlternates("/creative-space", locale as never);
  return {
    title: zh ? "AI 视频创作 Agent - 说出想法自动拆分镜生成视频" : "AI Video Agent - Turn an Idea into Shots and Video",
    description: zh
      ? "在创作空间里写下目标或上传素材，Agent 先拆分镜、写提示词，确认后用 Veo 3.1 生成有声视频。"
      : "Write a goal or add assets in Creative Space. The agent plans the shots and prompt, then Veo 3.1 generates a video with sound once you approve.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function CreativeSpacePage({ params }: Props) {
  const { locale } = await params;
  return <CreativeSpaceHome lang={locale} />;
}
