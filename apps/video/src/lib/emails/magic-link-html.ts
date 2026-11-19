/**
 * The sign-in / activation email, as plain HTML (no JSX rendering on the
 * Worker). The language follows the page the visitor signed in from: the
 * magic link's callbackURL starts with /zh for the Chinese site.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** True when the link sends the visitor back to a /zh page. */
export function isChineseLink(url: string): boolean {
  try {
    const callback = new URL(url).searchParams.get("callbackURL") ?? "";
    const path = callback.startsWith("http") ? new URL(callback).pathname : callback;
    return path === "/zh" || path.startsWith("/zh/");
  } catch {
    return false;
  }
}

export function buildMagicLinkEmail({
  url,
  siteName,
  name,
  verified,
  zh,
  minutes = 5,
}: {
  url: string;
  siteName: string;
  name?: string | null;
  verified: boolean;
  zh: boolean;
  minutes?: number;
}): { subject: string; html: string; text: string } {
  const who = name?.trim();
  const copy = zh
    ? {
        subject: verified ? `登录 ${siteName}` : `激活你的 ${siteName} 账户`,
        hello: who ? `${who}，你好` : "你好",
        body: verified ? "点击下面的按钮登录。" : "点击下面的按钮激活账户，激活后即可开始生成。",
        action: verified ? "登录" : "激活账户",
        expires: `链接 ${minutes} 分钟内有效，只能使用一次。`,
        ignore: "如果不是你本人操作，忽略这封邮件即可。",
        fallback: "按钮打不开的话，复制这个链接到浏览器：",
      }
    : {
        subject: verified ? `Sign in to ${siteName}` : `Activate your ${siteName} account`,
        hello: who ? `Hi ${who},` : "Hi there,",
        body: verified ? "Use the button below to sign in." : "Use the button below to activate your account and start creating.",
        action: verified ? "Sign in" : "Activate account",
        expires: `The link works for ${minutes} minutes and only once.`,
        ignore: "If this was not you, you can ignore this email.",
        fallback: "If the button does not open, paste this link into your browser:",
      };

  const e = escapeHtml;
  const href = e(url);
  const html = `<!DOCTYPE html>
<html lang="${zh ? "zh-CN" : "en"}">
<body style="margin:0;padding:0;background:#f4f5f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#000000;padding:20px 28px">
          <span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:#66fcf1;vertical-align:middle"></span>
          <span style="margin-left:10px;color:#ffffff;font-size:18px;font-weight:700;vertical-align:middle">${e(siteName)}</span>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 12px;font-size:16px;font-weight:600">${e(copy.hello)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46">${e(copy.body)}</p>
          <a href="${href}" style="display:inline-block;padding:12px 28px;background:#66fcf1;color:#000000;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none">${e(copy.action)}</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a">${e(copy.expires)} ${e(copy.ignore)}</p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa">${e(copy.fallback)}<br><span style="word-break:break-all">${href}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `${copy.hello}\n\n${copy.body}\n${copy.action}: ${url}\n\n${copy.expires} ${copy.ignore}\n\n${siteName}`;
  return { subject: copy.subject, html, text };
}
