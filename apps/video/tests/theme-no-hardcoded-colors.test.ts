import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.join(process.cwd(), "src");
const THEME_CSS = "src/styles/theme.css";
const CONTENT_DIR = "src/content/";

const LEGACY_ALLOWLIST: string[] = [
  "src/components/admin/analytics/funnel-chart.tsx",
  "src/components/admin/analytics/trend-chart.tsx",
  "src/components/creation/creation-card.tsx",
  "src/components/creation/creation-empty.tsx",
  "src/components/creation/creation-filter.tsx",
  "src/components/creation/my-creations-page.tsx",
  "src/components/document-guide.tsx",
  "src/components/features-card.tsx",
  "src/components/hf/explore-home.tsx",
  "src/components/landing/cta-section.tsx",
  "src/components/landing/pricing-section.tsx",
  "src/components/landing/showcase-section.tsx",
  "src/components/layout/sidebar.tsx",
  "src/components/magicui/animated-beam.tsx",
  "src/components/magicui/animated-gradient-text.tsx",
  "src/components/magicui/bento-grid.tsx",
  "src/components/magicui/border-beam.tsx",
  "src/components/magicui/box-reveal.tsx",
  "src/components/magicui/confetti.tsx",
  "src/components/magicui/magic-card.tsx",
  "src/components/magicui/meteors.tsx",
  "src/components/magicui/pulsating-button.tsx",
  "src/components/magicui/rainbow-button.tsx",
  "src/components/magicui/ripple-button.tsx",
  "src/components/magicui/shimmer-button.tsx",
  "src/components/magicui/shiny-button.tsx",
  "src/components/magicui/sparkles-text.tsx",
  "src/components/magicui/twitter-card.tsx",
  "src/components/price/dark-pricing.tsx",
  "src/components/rightside-marketing.tsx",
  "src/components/tool/generator-panel.tsx",
  "src/components/tool/tool-landing-page.tsx",
  "src/components/tool/tool-page-layout.tsx",
  "src/components/ui/animated-gradient-text.tsx",
  "src/components/ui/background-lines.tsx",
  "src/components/ui/colorful-text.tsx",
  "src/components/ui/container-scroll-animation.tsx",
  "src/components/ui/glowing-effect.tsx",
  "src/components/ui/icons.tsx",
  "src/components/ui/meteors.tsx",
  "src/components/ui/sparkles.tsx",
  "src/components/ui/wobble-card.tsx",
  "src/components/video-generator/compact-generator.tsx",
  "src/components/video-generator/defaults.ts",
  "src/components/video-generator/types.ts",
  "src/components/video-generator/video-generator-input.tsx",
  "src/config/tool-pages/adapter.ts",
  "src/config/tool-pages/image-to-video.config.ts",
  "src/config/tool-pages/reference-to-video.config.ts",
  "src/config/tool-pages/text-to-video.config.ts",
  "src/lib/emails/magic-link-email.tsx",
  "src/lib/emails/reset-password-email.tsx",
  "src/lib/emails/welcome-email.tsx",
  "src/lib/generate-pattern.ts",
  "src/registry/magicui/shine-border.tsx",
];

const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".css"];
const HARDCODED_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function collectSourceFiles(): string[] {
  return walk(SRC_DIR)
    .map((full) => toPosix(path.relative(process.cwd(), full)))
    .filter((rel) => ALLOWED_EXTENSIONS.includes(path.extname(rel)))
    .filter((rel) => !rel.startsWith(CONTENT_DIR))
    .filter((rel) => rel !== THEME_CSS)
    .filter((rel) => !LEGACY_ALLOWLIST.includes(rel))
    .sort();
}

describe("theme hardcoded colors", () => {
  it("no hardcoded colors outside theme.css", () => {
    const offenders: string[] = [];

    for (const rel of collectSourceFiles()) {
      const contents = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      contents.split(/\r?\n/).forEach((line, index) => {
        if (HARDCODED_COLOR_RE.test(line)) {
          offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("legacy allowlist only lists existing files", () => {
    const missing = LEGACY_ALLOWLIST.filter(
      (rel) => !fs.existsSync(path.join(process.cwd(), rel)),
    );

    expect(missing).toEqual([]);
  });

  it("theme.css defines --du- variables", () => {
    const contents = fs.readFileSync(path.join(process.cwd(), THEME_CSS), "utf8");

    expect(contents).toContain("--du-");
  });
});
