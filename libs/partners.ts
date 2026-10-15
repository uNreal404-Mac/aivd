/** Partner progress card — status lives here so the page is easy to update. */

export const PARTNERS_PATH = "/partners";
export const PARTNERS_FUNCTION_ROUTES = ["/partners", "/partners/", "/partners.html"] as const;

const ROBOTS_NOINDEX = "noindex";

export const STATUS_LABEL = {
  live: "已上线",
  soon: "即将上线",
  pending: "待办",
} as const;

export type FeatureStatus = keyof Pick<typeof STATUS_LABEL, "live" | "soon">;
export type StepStatus = keyof Pick<typeof STATUS_LABEL, "pending">;

export const PARTNERS_STATUS = {
  features: [
    {
      id: "workspace",
      title: "生成页",
      detail: "上传照片，选择模型、时长和画幅，并可查看历史。",
      href: "/workspace",
      status: "live" as FeatureStatus,
    },
    {
      id: "gallery",
      title: "作品库",
      detail: "预览、下载、重新生成自己的片子。",
      href: "/workspace?tab=history",
      status: "live" as FeatureStatus,
    },
    {
      id: "examples",
      title: "公开样片",
      detail: "给客户浏览的样片页。",
      href: "/examples",
      status: "soon" as FeatureStatus,
    },
    {
      id: "demo",
      title: "演示模式",
      detail: "按真实流程走一遍，结果会标「演示样片」。",
      href: "/workspace?demo=1",
      status: "live" as FeatureStatus,
    },
  ],
  steps: [
    { id: "domain", title: "选定域名并换牌子", status: "pending" as StepStatus, owner: "老三" },
    { id: "payout", title: "开通美元收款", status: "pending" as StepStatus, owner: "老三" },
    { id: "budget", title: "批准生成预算并打开生成", status: "pending" as StepStatus, owner: "老三" },
  ],
} as const;

export function isPartnersPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === PARTNERS_PATH || path === `${PARTNERS_PATH}.html`;
}

export function partnersSeoFlags(): { noindex: boolean; headers: Record<string, string> } {
  return {
    noindex: true,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": ROBOTS_NOINDEX,
    },
  };
}

function upsertMetaName(html: string, name: string, content: string): string {
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, "i");
  const tag = `<meta name="${name}" content="${content}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/title>/i, `</title>\n${tag}`);
}

export function applyPartnersHtmlSeo(html: string): { html: string; noindex: boolean; headers: Record<string, string> } {
  const { noindex, headers } = partnersSeoFlags();
  return { html: upsertMetaName(html, "robots", ROBOTS_NOINDEX), noindex, headers };
}

export async function rewritePartnersHtmlResponse(response: Response): Promise<Response> {
  const { headers: seoHeaders } = partnersSeoFlags();
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(seoHeaders)) headers.set(key, value);
  const html = await response.text();
  const applied = applyPartnersHtmlSeo(html);
  return new Response(applied.html, { status: response.status, headers });
}
