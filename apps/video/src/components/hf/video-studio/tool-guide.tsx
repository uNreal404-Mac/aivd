import { Film, ImagePlus, MonitorPlay, Type } from "lucide-react";
import type { VideoTool } from "@/lib/video-tool";

export function ToolGuide({
  kind,
  zh,
}: {
  kind: VideoTool | "extend";
  zh: boolean;
}) {
  const motion = kind === "motion",
    edit = kind === "edit";
  const choose = (cn: string, en: string) => (zh ? cn : en);
  const title = motion
    ? choose("用你的图片再现参考动作", "Recreate movement with your character")
    : edit
      ? choose("用一句描述编辑视频", "Edit your clip with a description")
      : choose("让镜头继续", "Continue your shot");
  const steps = [
    {
      Icon: Film,
      title: choose("选择原视频", "Choose a source clip"),
      text: motion
        ? choose(
            "选择包含清晰动作的 3–30 秒片段。",
            "Choose a 3–30 second clip with clear motion.",
          )
        : edit
          ? choose(
              "添加 3–15.5 秒的原视频。",
              "Add a 3–15.5 second source clip.",
            )
          : choose(
              "从自己的已完成作品中选择上一段视频。",
              "Choose a finished video from your creations.",
            ),
    },
    {
      Icon: motion ? ImagePlus : Type,
      title: motion
        ? choose("选择角色", "Add your character")
        : choose("描述变化", "Describe your changes"),
      text: motion
        ? choose(
            "添加一张面部和身体清晰的角色图。",
            "Choose a character image with a clear face and body.",
          )
        : edit
          ? choose(
              "写下要改变的场景、光线或风格。",
              "Describe the new scene, lighting or style.",
            )
          : choose(
              "写下下一段发生什么，设定新增秒数。",
              "Describe what happens next and choose the added seconds.",
            ),
    },
    {
      Icon: MonitorPlay,
      title: choose("生成并下载", "Generate and download"),
      text: choose(
        "确认积分后提交，在历史记录中观看结果。",
        "Review the credits, then follow the result in History.",
      ),
    },
  ];
  const images = motion
    ? ["autumn-walk", "boy-and-dog", "rain-couple"]
    : edit
      ? ["studio-room", "cosmic-bloom", "red-carpet"]
      : ["mountain-valley", "mountain-wind", "autumn-walk"];
  return (
    <div className="vst-howto du-fade-swap">
      <div className="vst-howto-main">
        <h2 className="vst-howto-title">{title}</h2>
        <ol className="vst-steps">
          {steps.map(({ Icon, title, text }, index) => (
            <li key={title} className="vst-step">
              <div className="vst-illus vtool-guide-icon">
                <img
                  src={`/home/samples/${images[index]}.webp`}
                  alt=""
                  loading="lazy"
                />
                <span>
                  <Icon aria-hidden="true" />
                </span>
              </div>
              <h3 className="vst-step-title">{title}</h3>
              <p className="vst-step-body">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
