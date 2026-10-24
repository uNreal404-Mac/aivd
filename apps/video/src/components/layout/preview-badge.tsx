import { createElement } from "react";

import { isPreviewSite } from "@/config/site";

export function PreviewBadge({
  show = isPreviewSite,
  lang = "en",
}: {
  show?: boolean;
  lang?: string;
}) {
  if (!show) return null;

  return createElement(
    "span",
    {
      "data-testid": "preview-badge",
      className:
        "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300",
    },
    lang.toLowerCase().startsWith("zh") ? "预览" : "Preview",
  );
}
