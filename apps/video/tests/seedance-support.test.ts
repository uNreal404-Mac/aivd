import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getAvailableModels } from "@/config/credits";
import { buildAlternates } from "@/lib/seo";
import { fallbackModel, seedanceGuides, supportFaq, supportMetadata, type SeedanceVersion } from "@/lib/seedance-support";

describe("Seedance support pages", () => {
  it.each(["2.0", "2.5"] as SeedanceVersion[])("labels version %s without promising generation access", (version) => {
    const data = supportMetadata(version, "en");
    expect(data.title).toEqual({ absolute: `Seedance ${version} Support Status | aidv.ai` });
    expect(data.alternates).toEqual(buildAlternates("/" + seedanceGuides[version].slug, "en"));
    expect(supportMetadata(version, "zh").title).toEqual({ absolute: `Seedance ${version} 支持状态 | aidv.ai` });
    const faq = supportFaq(version, "en");
    expect(faq).toHaveLength(8);
    expect(faq.flat().join(" ")).toContain("independent of ByteDance");
    expect(faq.flat().join(" ")).toContain("16 credits");
    expect(supportFaq(version, "zh").flat().join(" ")).toContain("不是 ByteDance");
  });

  it("lists both localized forms of each guide exactly once in the indexable sitemap", async () => {
    const entries = await sitemap();
    const paths = entries.map(({ url }) => new URL(url).pathname);
    for (const { slug } of Object.values(seedanceGuides)) {
      for (const prefix of ["", "/zh"]) {
        expect(paths.filter((path) => path === prefix + "/" + slug)).toHaveLength(1);
      }
    }
  });

  it("hands off to a configured text-to-video model", () => {
    const ids = getAvailableModels({ mode: "text-to-video" }).map((model) => model.id);
    expect(ids).toContain(fallbackModel);
    expect(ids).not.toContain("seedance-2.0");
    expect(ids).not.toContain("seedance-2.5");
  });
});
