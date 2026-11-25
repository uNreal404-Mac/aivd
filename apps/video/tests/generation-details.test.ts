import { describe, expect, it } from "vitest";
import { generationDetails } from "@/lib/generation-details";

describe("generation details", () => {
  it("shows the submitted video settings and counts references without exposing keys", () => {
    const rows = generationDetails("video", "Seedance 2.5", {
      mode: "reference-to-video", preset: "push-in", aspectRatio: "16:9",
      quality: "1080p", duration: 8, generateAudio: false,
      imageUrls: ["uploads/private/a", "uploads/private/b"],
    }, true);
    expect(rows).toEqual([
      { label: "模型", value: "Seedance 2.5" },
      { label: "生成方式", value: "参考生视频" },
      { label: "镜头预设", value: "缓慢推近" },
      { label: "画面比例", value: "16:9" },
      { label: "分辨率", value: "1080p" },
      { label: "时长", value: "8 秒" },
      { label: "声音", value: "关闭" },
      { label: "参考素材", value: "2" },
    ]);
  });

  it("shows only settings available on old image records", () => {
    expect(generationDetails("image", "Nano Banana Pro", { count: 4 }, false)).toEqual([
      { label: "Model", value: "Nano Banana Pro" },
      { label: "Images", value: "4" },
    ]);
  });
});
