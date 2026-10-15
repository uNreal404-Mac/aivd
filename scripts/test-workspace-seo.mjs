/**
 * /workspace HTML indexing + layout SEO — mocks only.
 * Never calls KIE, /api/generate, or /api/upload.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_CANONICAL,
  WORKSPACE_FUNCTION_ROUTES,
  WORKSPACE_H1,
  WORKSPACE_TITLE,
  WORKSPACE_DESCRIPTION,
  applyWorkspaceHtmlSeo,
  isWorkspacePath,
  stripUserWorkUrls,
  workspaceRequestIsParameterized,
} from "../libs/workspaceSeo.ts";
import { onRequest as workspaceMw } from "../functions/_middleware.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

const staticHtml = fs.readFileSync(path.join(root, "out/workspace.html"), "utf8");

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
  assert(isWorkspacePath("/workspace") && isWorkspacePath("/workspace/"), "/workspace path matches");
  assert(isWorkspacePath("/workspace.html"), "/workspace.html path matches");
  assert(!isWorkspacePath("/") && !isWorkspacePath("/pricing") && !isWorkspacePath("/business"), "other paths are not workspace");
  assert(!workspaceRequestIsParameterized("https://dreamutopia-clone.pages.dev/workspace"), "bare /workspace is not parameterized");
  assert(!workspaceRequestIsParameterized("https://dreamutopia-clone.pages.dev/workspace/"), "trailing slash is not parameterized");
  assert(workspaceRequestIsParameterized("https://dreamutopia-clone.pages.dev/workspace?tab=history"), "?tab=history is parameterized");
  assert(workspaceRequestIsParameterized("https://dreamutopia-clone.pages.dev/workspace?mode=image"), "?mode=image is parameterized");
  assert(workspaceRequestIsParameterized("https://dreamutopia-clone.pages.dev/workspace?pack=starter"), "any query is parameterized");
}

{
  assert(staticHtml.includes(`<title>${WORKSPACE_TITLE}</title>`), "static title is the SEO title");
  assert(staticHtml.includes(`content="${WORKSPACE_DESCRIPTION}"`), "static description matches");
  assert(staticHtml.includes(`<h1 class="ws-h1" id="wsH1"`) && staticHtml.includes(WORKSPACE_H1), "static H1 is Create AI Videos from Images");
  assert(staticHtml.includes(`property="og:title" content="${WORKSPACE_TITLE}"`), "og:title synced");
  assert(staticHtml.includes(`name="twitter:title" content="${WORKSPACE_TITLE}"`), "twitter:title synced");
  assert(staticHtml.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), "static canonical is /workspace");
  assert(!/name=["']robots["']/i.test(staticHtml), "static HTML has no robots noindex");
  assert(!/\/api\/media\?/i.test(staticHtml), "static HTML has no /api/media user-work URLs");
  assert(!staticHtml.includes("href=\"/business\""), "workspace does not fall back to /business");
  assert(staticHtml.includes('id="audioRow"') && staticHtml.includes('id="durationRow"') && staticHtml.includes('id="aspectRow"') && staticHtml.includes('id="resolutionRow"'), "chip selectors present");
  assert(staticHtml.includes('id="uploadArea"') && staticHtml.includes('id="lastUploadArea"'), "start/end frame cards present");
  assert(staticHtml.includes('id="composerDock"') && staticHtml.includes('id="genSticky"') && staticHtml.includes('class="ws-stage"'), "left panel + right history stage");
  assert(staticHtml.includes('id="presetCard"') && staticHtml.includes('id="genCost"'), "preset card and Generate credit cost");
  assert(staticHtml.includes("DU.alertDialog"), "logged-out Generate opens login, not /business");
  assert(staticHtml.includes("generationIsClosed") && staticHtml.includes('DU.t("gen.closed"'), "closed Generate stays 暂未开放");
  assert(staticHtml.includes('data-i18n="ws.tab.history"') && staticHtml.includes(">History<"), "right canvas History tab");
  assert(!/Seedance|Higgsfield|Genjutsu|Katana/i.test(staticHtml), "no competitor copy in workspace HTML");
}

{
  const clean = applyWorkspaceHtmlSeo(staticHtml, "https://dreamutopia-clone.pages.dev/workspace");
  assert(clean.noindex === false, "bare /workspace is indexable");
  assert(!/name=["']robots["'][^>]*noindex/i.test(clean.html), "indexable HTML has no noindex meta");
  assert(!clean.headers["x-robots-tag"], "indexable response has no X-Robots-Tag");
  assert(clean.html.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), "indexable canonical is self /workspace");
}

{
  const hist = applyWorkspaceHtmlSeo(staticHtml, "https://dreamutopia-clone.pages.dev/workspace?tab=history");
  assert(hist.noindex === true, "?tab=history is noindex");
  assert(/<meta name="robots" content="noindex">/i.test(hist.html), "?tab=history HTML has robots noindex");
  assert(hist.headers["x-robots-tag"] === "noindex", "?tab=history sends X-Robots-Tag: noindex");
  assert(hist.html.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), "?tab=history canonical points back to /workspace");
  assert(!hist.html.includes("?tab=history"), "?tab=history canonical is not self-referencing the query URL");
}

{
  const dirty = staticHtml.replace(
    '<video id="genResultVideo" controls playsinline></video>',
    '<video id="genResultVideo" src="/api/media?key=44_out_secret.mp4" controls playsinline></video>'
  );
  const stripped = stripUserWorkUrls(dirty);
  const applied = applyWorkspaceHtmlSeo(dirty, "https://dreamutopia-clone.pages.dev/workspace");
  assert(!stripped.includes("/api/media"), "stripUserWorkUrls removes /api/media URLs");
  assert(!applied.html.includes("/api/media"), "server HTML rewrite strips user work URLs");
  assert(applied.html.includes('id="historyList"'), "history list stays a client-side empty shell");
}

{
  const req = new Request("https://dreamutopia-clone.pages.dev/workspace");
  const res = await workspaceMw(pagesCtx(req, staticHtml));
  const body = await res.text();
  assert(res.status === 200, "middleware GET /workspace is 200");
  assert(!/name=["']robots["'][^>]*noindex/i.test(body), "middleware bare /workspace HTML is indexable");
  assert(!res.headers.get("x-robots-tag"), "middleware bare /workspace has no X-Robots-Tag");
  assert(body.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), "middleware canonical is /workspace");
}

{
  const req = new Request("https://dreamutopia-clone.pages.dev/workspace?tab=history");
  const res = await workspaceMw(pagesCtx(req, staticHtml));
  const body = await res.text();
  assert(res.status === 200, "middleware GET ?tab=history is 200");
  assert(/<meta name="robots" content="noindex">/i.test(body), "middleware injects robots noindex for query URLs");
  assert(res.headers.get("x-robots-tag") === "noindex", "middleware sets X-Robots-Tag for query URLs");
  assert(body.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), "middleware query URL canonical is /workspace");
}

{
  const aliases = ["/workspace", "/workspace/", "/workspace.html"];
  for (const pathname of aliases) {
    const bare = new Request(`https://dreamutopia-clone.pages.dev${pathname}`);
    const bareRes = await workspaceMw(pagesCtx(bare, staticHtml));
    const bareHtml = await bareRes.text();
    assert(bareRes.status === 200, `middleware GET ${pathname} is 200`);
    assert(!/name=["']robots["'][^>]*noindex/i.test(bareHtml), `bare ${pathname} HTML is indexable`);
    assert(!bareRes.headers.get("x-robots-tag"), `bare ${pathname} has no X-Robots-Tag`);
    assert(bareHtml.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), `bare ${pathname} canonical is /workspace`);

    const hist = new Request(`https://dreamutopia-clone.pages.dev${pathname}?tab=history`);
    const histRes = await workspaceMw(pagesCtx(hist, staticHtml));
    const histHtml = await histRes.text();
    assert(histRes.status === 200, `middleware GET ${pathname}?tab=history is 200`);
    assert(/<meta name="robots" content="noindex">/i.test(histHtml), `${pathname}?tab=history HTML has robots noindex`);
    assert(histRes.headers.get("x-robots-tag") === "noindex", `${pathname}?tab=history sends X-Robots-Tag: noindex`);
    assert(histHtml.includes(`rel="canonical" href="${WORKSPACE_CANONICAL}"`), `${pathname}?tab=history canonical is /workspace`);
    assert(!histHtml.includes("?tab=history"), `${pathname}?tab=history canonical does not keep the query`);
  }

  const headReq = new Request("https://dreamutopia-clone.pages.dev/workspace.html?tab=history", { method: "HEAD" });
  const headRes = await workspaceMw(pagesCtx(headReq, staticHtml));
  assert(headRes.status === 200, "middleware HEAD /workspace.html?tab=history is 200");
  assert(headRes.headers.get("x-robots-tag") === "noindex", "HEAD alias still sends X-Robots-Tag: noindex");
  assert((await headRes.text()) === "", "HEAD alias has an empty body");
}

{
  const routes = JSON.parse(fs.readFileSync(path.join(root, "out/_routes.json"), "utf8"));
  const include = Array.isArray(routes.include) ? routes.include : [];
  for (const route of WORKSPACE_FUNCTION_ROUTES) {
    assert(include.includes(route), `_routes.json include has ${route} so Functions middleware runs`);
  }
  const mw = fs.readFileSync(path.join(root, "functions/_middleware.ts"), "utf8");
  const seo = fs.readFileSync(path.join(root, "libs/workspaceSeo.ts"), "utf8");
  assert(mw.includes("rewriteWorkspaceHtmlResponse"), "middleware uses HTMLRewriter rewrite helper");
  assert(seo.includes("HTMLRewriter"), "workspace SEO rewrite uses HTMLRewriter on Pages");
  assert(seo.includes("x-robots-tag"), "rewrite helper sets X-Robots-Tag");
}

{
  const req = new Request("https://dreamutopia-clone.pages.dev/pricing");
  let called = false;
  const passthrough = new Response("pricing-ok", { headers: { "content-type": "text/html" } });
  const res = await workspaceMw({
    ...pagesCtx(req, "unused"),
    next: async () => {
      called = true;
      return passthrough;
    },
  });
  assert(called && (await res.text()) === "pricing-ok", "middleware does not rewrite non-workspace HTML");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nWorkspace SEO checks passed (${ok.length})`);
