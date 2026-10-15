/**
 * History canvas gallery — mocks only.
 * Never calls KIE, /api/generate, /api/upload, or a live host.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  creditCostForItem,
  displayAspect,
  displayDuration,
  displayResolution,
  filterOwnWorks,
  itemKind,
  refillPayload,
  resultUrlOf,
} from "../libs/historyGallery.ts";
import {
  WORKSPACE_CANONICAL,
  applyWorkspaceHtmlSeo,
  stripUserWorkUrls,
} from "../libs/workspaceSeo.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

const staticHtml = fs.readFileSync(path.join(root, "out/workspace.html"), "utf8");
const i18n = fs.readFileSync(path.join(root, "out/assets/js/i18n.js"), "utf8");

const mockWorks = [
  {
    id: 11,
    kind: "video",
    model: "lite",
    prompt: "a fox runs through snow",
    status: "done",
    duration_sec: 5,
    resultUrl: "https://cdn.example/own-11.mp4",
    result_url: "https://cdn.example/own-11.mp4",
    input_image_url: "https://cdn.example/start-11.jpg",
    last_image_url: null,
    created_at: "2026-10-15T01:00:00.000Z",
    guest: false,
  },
  {
    id: 12,
    kind: "image",
    model: "pro",
    storedModel: "image-pro",
    prompt: "studio product still",
    status: "done",
    duration_sec: null,
    result_url: "https://cdn.example/own-12.png",
    created_at: "2026-10-15T02:00:00.000Z",
  },
  {
    id: 13,
    kind: "video",
    model: "medium",
    prompt: "slow dolly on a hallway",
    status: "processing",
    duration_sec: 10,
    resultUrl: null,
    created_at: "2026-10-15T03:00:00.000Z",
  },
];

{
  assert(itemKind(mockWorks[0]) === "video" && itemKind(mockWorks[1]) === "image", "itemKind reads publicGeneration.kind");
  assert(itemKind({ storedModel: "image-lite" }) === "image", "itemKind falls back to storedModel");
  assert(creditCostForItem(mockWorks[0]) === 3, "video lite costs 3");
  assert(creditCostForItem(mockWorks[1]) === 2, "image pro costs 2");
  assert(creditCostForItem(mockWorks[2]) === 5, "video medium costs 5");
  assert(displayDuration(mockWorks[0]) === "5s", "video duration from duration_sec");
  assert(displayDuration(mockWorks[1]) === "—", "image duration is placeholder");
  assert(displayDuration(mockWorks[2]) === "10s", "10s duration chip");
  assert(displayAspect(mockWorks[0]) === "—", "aspect is not in the history contract");
  assert(displayResolution(mockWorks[0]) === "—", "video resolution is not in the history contract");
  assert(displayResolution(mockWorks[1]) === "2K", "image pro resolution defaults to 2K");
  assert(displayResolution({ kind: "image", model: "lite" }) === "1K", "image lite resolution is 1K");
  assert(resultUrlOf(mockWorks[0]).endsWith("own-11.mp4"), "resultUrlOf prefers result_url/resultUrl");
  assert(resultUrlOf(mockWorks[2]) === "", "processing item has no result URL");
}

{
  const videos = filterOwnWorks(mockWorks, "video");
  const images = filterOwnWorks(mockWorks, "image");
  const all = filterOwnWorks(mockWorks, "all");
  assert(all.length === 3 && videos.length === 2 && images.length === 1, "filterOwnWorks splits video/image");
  assert(images[0].id === 12 && videos.every((g) => g.kind === "video"), "filters keep only the requested kind");
  assert(filterOwnWorks(null, "all").length === 0, "filterOwnWorks treats missing lists as empty");
  assert(!all.some((g) => g.author || g.likes), "own-work mocks have no community author/likes");
}

{
  const refill = refillPayload(mockWorks[0]);
  assert(refill.kind === "video" && refill.model === "lite", "refill maps kind + model");
  assert(refill.prompt === "a fox runs through snow", "refill copies prompt");
  assert(refill.durationSec === 5 && refill.imageUrl === "https://cdn.example/start-11.jpg", "refill copies duration + start frame");
  const ten = refillPayload(mockWorks[2]);
  assert(ten.durationSec === 10, "refill maps 10s duration chip");
}

{
  assert(staticHtml.includes('class="history-grid"'), "History uses a grid/waterfall, not a flat list only");
  assert(staticHtml.includes('id="historyFilter"'), "simple video/image filter");
  assert(staticHtml.includes('data-filter="video"') && staticHtml.includes('data-filter="image"'), "filter chips for video and image");
  assert(staticHtml.includes('id="historyDetail"'), "detail modal");
  assert(staticHtml.includes('id="historyDetailPrompt"'), "detail shows prompt");
  assert(staticHtml.includes('id="historyDetailModel"'), "detail shows model");
  assert(staticHtml.includes('id="historyDetailDuration"'), "detail shows duration");
  assert(staticHtml.includes('id="historyDetailAspect"'), "detail shows aspect");
  assert(staticHtml.includes('id="historyDetailResolution"'), "detail shows resolution");
  assert(staticHtml.includes('id="historyDetailCredits"'), "detail shows credits");
  assert(staticHtml.includes('id="historyDetailCreated"'), "detail shows created time");
  assert(staticHtml.includes("function refillFromGeneration"), "regenerate fills the left panel");
  assert(staticHtml.includes("function copyHistoryPrompt"), "copy prompt helper");
  assert(staticHtml.includes("DU.downloadResult"), "download reuses DU.downloadResult");
  assert(staticHtml.includes("bindHistoryHoverPreview"), "video cards hover-preview");
  assert(staticHtml.includes("api(\"/history\")"), "works load from /api/history");
  assert(staticHtml.includes("api(\"/generations\")"), "works fall back to /api/generations");
  assert(!/api\("\/gallery"\)/.test(staticHtml.slice(staticHtml.indexOf("async function loadHistory()"), staticHtml.indexOf("function escapeHtml"))), "loadHistory does not fetch the public gallery");
  assert(!/Featured Creators|community\/generations|author avatar/i.test(staticHtml), "History is not a community feed");
  assert(staticHtml.includes('id="historyEmpty"'), "friendly empty state remains");
  assert(!/\/api\/media\?/i.test(staticHtml), "server HTML has no user-work media URLs");
  assert(!staticHtml.includes('href="/business"'), "gallery work does not revive /business");
}

{
  assert(i18n.includes('"ws.history.filter.video": "Video"'), "filter Video i18n");
  assert(i18n.includes('"ws.history.filter.image": "Image"'), "filter Image i18n");
  assert(i18n.includes('"ws.history.regen": "Regenerate"'), "regenerate i18n");
  assert(i18n.includes('"ws.history.copy": "Copy prompt"'), "copy prompt i18n");
}

{
  const poisoned = staticHtml.replace("</title>", '</title>\n<img src="/api/media?key=secret.mp4">');
  const stripped = stripUserWorkUrls(poisoned);
  assert(!stripped.includes("/api/media?key=secret.mp4"), "stripUserWorkUrls still removes work URLs");
  const hist = applyWorkspaceHtmlSeo(staticHtml, "https://dreamutopia-clone.pages.dev/workspace?tab=history");
  assert(hist.noindex === true, "?tab=history stays noindex");
  assert(hist.canonical === WORKSPACE_CANONICAL, "?tab=history canonical still /workspace");
  assert(hist.headers["x-robots-tag"] === "noindex", "?tab=history still sends X-Robots-Tag");
  assert(!hist.html.includes("?tab=history"), "canonical does not keep the history query");
}

console.log(`history-gallery ${ok.length} passed, ${fail.length} failed`);
if (fail.length) {
  for (const row of fail) console.log("  FAIL " + row);
  process.exit(1);
}
