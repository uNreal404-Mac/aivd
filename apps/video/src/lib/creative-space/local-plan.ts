export interface CreativeAssetSummary {
  id: string;
  label: string;
  name: string;
  type: "image" | "video";
}

export interface CreativePlanStep {
  assetId: string;
  assetLabel: string;
  title: string;
  instruction: string;
}

export interface CreativePlan {
  mentionedAssetIds: string[];
  steps: CreativePlanStep[];
  summary: string;
}

function isMentioned(prompt: string, asset: CreativeAssetSummary) {
  const normalized = prompt.toLocaleLowerCase();
  return (
    normalized.includes(`@${asset.label.toLocaleLowerCase()}`) ||
    normalized.includes(`@${asset.name.toLocaleLowerCase()}`)
  );
}

export function buildLocalCreativePlan(
  prompt: string,
  assets: CreativeAssetSummary[],
  locale: string
): CreativePlan {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const mentioned = assets.filter((asset) => isMentioned(prompt, asset));
  const sourceAssets = mentioned.length > 0 ? mentioned : assets;

  const asksForOpening = /片头|开场|opening|intro|start/i.test(prompt);
  const asksForEnding = /片尾|结尾|ending|outro|end/i.test(prompt);

  const steps = sourceAssets.map((asset, index) => {
    let position = isChinese ? `镜头 ${index + 1}` : `Shot ${index + 1}`;
    if (index === 0 && asksForOpening) {
      position = isChinese ? "片头" : "Opening";
    }
    if (index === sourceAssets.length - 1 && asksForEnding) {
      position = isChinese ? "片尾" : "Ending";
    }

    return {
      assetId: asset.id,
      assetLabel: asset.label,
      title: `${position} · @${asset.label}`,
      instruction: isChinese
        ? `使用${asset.type === "video" ? "视频" : "图片"}“${asset.name}”作为${position}素材。`
        : `Use ${asset.type} “${asset.name}” as the ${position.toLowerCase()} asset.`,
    };
  });

  const summary =
    sourceAssets.length === 0
      ? isChinese
        ? "请先上传图片或视频，再用 @素材 描述你的编排方式。"
        : "Upload an image or video, then use @asset to describe the sequence."
      : isChinese
        ? `已在浏览器本地整理 ${sourceAssets.length} 个素材。DeepSeek 接入后，这份计划会交给 Agent 继续理解和执行。`
        : `${sourceAssets.length} asset${sourceAssets.length === 1 ? "" : "s"} arranged locally. Once DeepSeek is connected, this plan can be interpreted and executed by the Agent.`;

  return {
    mentionedAssetIds: mentioned.map((asset) => asset.id),
    steps,
    summary,
  };
}
