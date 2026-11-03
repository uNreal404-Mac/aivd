import React from "react";
import { calculateModelCredits, getAvailableModels } from "@/config/credits";
import styles from "./model-credit-table.module.css";

export function ModelCreditTable({ lang, modelId }: { lang: string; modelId?: string }) {
  const zh = lang === "zh";
  const models = getAvailableModels().filter((model) => !modelId || model.id === modelId);
  if (!models.length) return null;

  return (
    <section className={styles.section} aria-labelledby="model-credit-heading">
      <h2 id="model-credit-heading">{zh ? "生成一段视频要多少积分？" : "Credits per video"}</h2>
      <p>{zh ? "选择模型，按时长和分辨率查找一段视频的积分用量。" : "Choose a model and match your duration and resolution to the cost of one clip."}</p>
      {models.map((model, index) => {
        const qualities = model.qualities?.length ? model.qualities : [undefined];
        return (
          <details key={model.id} open={index === 0} className={styles.model}>
            <summary>{model.name}</summary>
            <table>
              <caption className="sr-only">{model.name} · {zh ? "每段视频的积分" : "credits for one clip"}</caption>
              <thead><tr>
                <th scope="col">{zh ? "时长" : "Duration"}</th>
                {qualities.map((q) => <th scope="col" key={q ?? "default"}>{q?.toLowerCase() ?? (zh ? "默认画质" : "Default")}</th>)}
              </tr></thead>
              <tbody>{model.durations.map((duration) => <tr key={duration}>
                <th scope="row">{duration} {zh ? "秒" : "s"}</th>
                {qualities.map((quality) => <td key={quality ?? "default"}>{calculateModelCredits(model.id, { duration, quality })}</td>)}
              </tr>)}</tbody>
            </table>
          </details>
        );
      })}
    </section>
  );
}
