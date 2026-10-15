/**
 * /partners noindex + status card — mocks only.
 * Never calls KIE, /api/generate, or /api/upload.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PARTNERS_FUNCTION_ROUTES,
  PARTNERS_STATUS,
  isPartnersPath,
  partnersSeoFlags,
  rewritePartnersHtmlResponse,
} from "../libs/partners.ts";
import { onRequest as pagesMw } from "../functions/_middleware.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

const staticHtml = fs.readFileSync(path.join(root, "out/partners.html"), "utf8");

function pagesCtx(request, nextHtml, nextStatus = 200) {
  return {
    env: {},
    request,
    waitUntil() {},
    params: {},
    data: {},
    functionPath: "",
    next: async () =>
      new Response(nextHtml, {
        status: nextStatus,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  };
}

{
  assert(isPartnersPath("/partners") && isPartnersPath("/partners/"), "/partners path matches");
  assert(isPartnersPath("/partners.html"), "/partners.html path matches");
  assert(!isPartnersPath("/") && !isPartnersPath("/workspace") && !isPartnersPath("/examples"), "other paths are not partners");
}

{
  const flags = partnersSeoFlags();
  assert(flags.noindex === true, "partners is always noindex");
  assert(flags.headers["x-robots-tag"] === "noindex", "partners flags include X-Robots-Tag: noindex");
}

{
  assert(PARTNERS_STATUS.features.some((item) => item.id === "demo" && item.status === "live"), "demo mode is live on main");
  assert(PARTNERS_STATUS.features.some((item) => item.id === "examples" && item.status === "soon"), "public samples stay 即将上线");
  assert(PARTNERS_STATUS.features.some((item) => item.id === "workspace" && item.status === "live"), "generation page is live");
  assert(PARTNERS_STATUS.features.some((item) => item.id === "gallery" && item.status === "live"), "user gallery is live");
  assert(PARTNERS_STATUS.steps.length === 3, "exactly three remaining steps");
  assert(
    PARTNERS_STATUS.steps.every((step) => step.status === "pending" && step.owner === "老三"),
    "all remaining steps are pending and owned by 老三"
  );
  assert(
    PARTNERS_STATUS.steps.map((step) => step.title).join("|") ===
      "选定域名并换牌子|开通美元收款|批准生成预算并打开生成",
    "three generic payment steps"
  );
}

{
  assert(/<meta name="robots" content="noindex">/i.test(staticHtml), "static /partners HTML has robots noindex");
  assert(staticHtml.includes('href="/workspace?demo=1"'), "demo link is present");
  assert(staticHtml.includes("选定域名并换牌子"), "step 1 rendered in HTML");
  assert(staticHtml.includes("开通美元收款"), "step 2 rendered in HTML");
  assert(staticHtml.includes("批准生成预算并打开生成"), "step 3 rendered in HTML");
  for (const item of PARTNERS_STATUS.features) {
    assert(staticHtml.includes(item.title), `feature ${item.id} title rendered`);
    assert(staticHtml.includes(item.href), `feature ${item.id} path rendered`);
  }
  for (const step of PARTNERS_STATUS.steps) {
    assert(staticHtml.includes(step.title), `step ${step.id} rendered from config`);
  }
  const leaked = ["miko.video", "popovid.com", "Miko", "Popovid", "Stripe", "KIE", "clone", "暂未开放"];
  assert(
    leaked.every((needle) => !staticHtml.includes(needle)),
    "partners HTML omits domain candidates, Stripe/KIE, clone, 暂未开放"
  );
}

{
  const aliases = ["/partners", "/partners/", "/partners.html"];
  for (const pathname of aliases) {
    const req = new Request(`https://dreamutopia-clone.pages.dev${pathname}`);
    const res = await pagesMw(pagesCtx(req, staticHtml));
    const body = await res.text();
    assert(res.status === 200, `middleware GET ${pathname} is 200`);
    assert(/<meta name="robots" content="noindex">/i.test(body), `${pathname} HTML has robots noindex`);
    assert(res.headers.get("x-robots-tag") === "noindex", `${pathname} sends X-Robots-Tag: noindex`);
  }

  const headReq = new Request("https://dreamutopia-clone.pages.dev/partners", { method: "HEAD" });
  const headRes = await pagesMw(pagesCtx(headReq, staticHtml));
  assert(headRes.status === 200, "middleware HEAD /partners is 200");
  assert(headRes.headers.get("x-robots-tag") === "noindex", "HEAD /partners sends X-Robots-Tag: noindex");
  assert((await headRes.text()) === "", "HEAD /partners has an empty body");

  const redirectReq = new Request("https://dreamutopia-clone.pages.dev/partners.html");
  const redirectRes = await pagesMw({
    ...pagesCtx(redirectReq, "unused"),
    next: async () => new Response(null, { status: 308, headers: { Location: "/partners" } }),
  });
  assert(redirectRes.status === 308, "pretty-URL alias can 308 to /partners");
  assert(redirectRes.headers.get("location") === "/partners", "308 Location is preserved");
  assert(redirectRes.headers.get("x-robots-tag") === "noindex", "308 alias still sends X-Robots-Tag: noindex");
}

{
  const bare = "<html><head><title>x</title></head><body>ok</body></html>";
  const rewritten = await rewritePartnersHtmlResponse(
    new Response(bare, { headers: { "content-type": "text/html" } })
  );
  const html = await rewritten.text();
  assert(/<meta name="robots" content="noindex">/i.test(html), "rewrite injects robots noindex when missing");
  assert(rewritten.headers.get("x-robots-tag") === "noindex", "rewrite sets X-Robots-Tag");
}

{
  const routes = JSON.parse(fs.readFileSync(path.join(root, "out/_routes.json"), "utf8"));
  const include = Array.isArray(routes.include) ? routes.include : [];
  for (const route of PARTNERS_FUNCTION_ROUTES) {
    assert(include.includes(route), `_routes.json include has ${route} so Functions middleware runs`);
  }
  assert(!include.includes("/partners/*"), "_routes.json has no /partners/* splat");
  assert(include.includes("/workspace") && include.includes("/workspace.html"), "workspace includes stay intact");
}

{
  const req = new Request("https://dreamutopia-clone.pages.dev/pricing");
  let called = false;
  const passthrough = new Response("pricing-ok", { headers: { "content-type": "text/html" } });
  const res = await pagesMw({
    ...pagesCtx(req, "unused"),
    next: async () => {
      called = true;
      return passthrough;
    },
  });
  assert(called && (await res.text()) === "pricing-ok", "middleware still passes through non-partners HTML");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nPartners checks passed (${ok.length})`);
