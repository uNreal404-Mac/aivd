// 用无头 Chrome（CDP）测量页面的设计数值并截图。
// 用法：node measure.mjs <输出目录> <名字>=<网址> ...
// 需要：Node 22（自带 WebSocket）、本机 Chrome、环境变量 HTTPS_PROXY（可选）。
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [outDir, ...pairs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const W = 1440, H = 900, PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'aivd-audit-'))}`,
  '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
  '--hide-scrollbars', '--lang=zh-CN',
];
if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`);
const chrome = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.on('exit', (code) => console.error('chrome exited', code));
chrome.stderr.on('data', (d) => { if (!String(d).includes('CVDisplayLink')) process.stderr.write('[chrome] ' + String(d).slice(0, 300)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(path, method = 'GET') {
  for (let i = 0; i < 150; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json(); } catch { await sleep(200); }
  }
  throw new Error('chrome not reachable');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  return new Promise((r) => { ws.onopen = () => r({ send, close: () => ws.close() }); });
}

// 在页面里执行的测量脚本
const MEASURE = `(() => {
  const H = innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const all = [...document.querySelectorAll('body *')].filter(vis);
  const fold = all.filter((el) => el.getBoundingClientRect().top < H);
  const tally = (els, fn, weightFn = () => 1) => { const m = {}; for (const el of els) { const k = fn(el); if (k == null || k === '') continue; m[k] = (m[k] || 0) + weightFn(el); } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
  const textEls = all.filter((el) => ownText(el).length > 0);
  const foldText = fold.filter((el) => ownText(el).length > 0);
  const cs = (el) => getComputedStyle(el);
  const typeOf = (el) => { const s = cs(el); return s.fontSize + ' / ' + s.fontWeight + ' / lh ' + s.lineHeight + ' / ls ' + s.letterSpacing; };
  const heading = (sel) => [...document.querySelectorAll(sel)].filter(vis).slice(0, 4).map((el) => { const s = cs(el); return { text: el.innerText.trim().slice(0, 40), size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, ls: s.letterSpacing, family: s.fontFamily.slice(0, 60), color: s.color, top: Math.round(el.getBoundingClientRect().top) }; });
  const buttons = [...document.querySelectorAll('button, a')].filter(vis).filter((el) => { const s = cs(el); return s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderStyle !== 'none' && s.borderWidth !== '0px'; }).filter((el) => el.getBoundingClientRect().top < H).slice(0, 10).map((el) => { const s = cs(el); const r = el.getBoundingClientRect(); return { text: el.innerText.trim().slice(0, 20), h: Math.round(r.height), padX: s.paddingLeft, radius: s.borderRadius, bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 50), color: s.color, size: s.fontSize, weight: s.fontWeight, border: s.borderWidth + ' ' + s.borderColor }; });
  const nav = document.querySelector('header, nav'); const navR = nav ? nav.getBoundingClientRect() : null;
  const media = [...document.querySelectorAll('video, img')].filter(vis);
  const foldMedia = media.filter((el) => el.getBoundingClientRect().top < H);
  const mediaArea = foldMedia.reduce((a, el) => { const r = el.getBoundingClientRect(); const h = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)); const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)); return a + w * h; }, 0);
  const videos = [...document.querySelectorAll('video')].filter(vis);
  const radii = tally(all.filter((el) => { const s = cs(el); return s.borderRadius !== '0px' && (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderStyle !== 'none' || el.tagName === 'IMG' || el.tagName === 'VIDEO'); }), (el) => cs(el).borderRadius);
  const gradients = all.filter((el) => cs(el).backgroundImage.includes('gradient')).length;
  const textGradients = all.filter((el) => cs(el).backgroundClip === 'text' || cs(el).webkitBackgroundClip === 'text').length;
  const shadows = tally(all, (el) => { const s = cs(el).boxShadow; return s === 'none' ? null : s.slice(0, 80); });
  const blurs = all.filter((el) => { const s = cs(el); return (s.backdropFilter && s.backdropFilter !== 'none') || (s.filter && s.filter.includes('blur')); }).length;
  const animated = all.filter((el) => { const s = cs(el); return s.animationName && s.animationName !== 'none'; }).length;
  const wideWrappers = tally(all.filter((el) => { const s = cs(el); return s.maxWidth !== 'none' && el.getBoundingClientRect().width > 900; }), (el) => cs(el).maxWidth);
  const foldChars = foldText.reduce((a, el) => a + ownText(el).length, 0);
  const sections = [...document.querySelectorAll('main > *, section')].filter(vis).slice(0, 14).map((el) => { const s = cs(el); const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), top: Math.round(r.top + scrollY), h: Math.round(r.height), padTop: s.paddingTop, padBottom: s.paddingBottom, marginTop: s.marginTop }; });
  return {
    url: location.href, title: document.title,
    pageHeight: document.documentElement.scrollHeight,
    bodyBg: cs(document.body).backgroundColor, htmlBg: cs(document.documentElement).backgroundColor,
    bodyFont: cs(document.body).fontFamily,
    fontsLoaded: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))].slice(0, 12),
    families: tally(textEls, (el) => cs(el).fontFamily.split(',')[0].replace(/"/g, '').trim(), (el) => ownText(el).length).slice(0, 6),
    typeScale: tally(textEls, typeOf, (el) => ownText(el).length).slice(0, 14),
    distinctFontSizes: new Set(textEls.map((el) => cs(el).fontSize)).size,
    distinctFontWeights: tally(textEls, (el) => cs(el).fontWeight, (el) => ownText(el).length),
    textColors: tally(textEls, (el) => cs(el).color, (el) => ownText(el).length).slice(0, 10),
    distinctTextColors: new Set(textEls.map((el) => cs(el).color)).size,
    bgColors: tally(all, (el) => { const c = cs(el).backgroundColor; return c === 'rgba(0, 0, 0, 0)' ? null : c; }, (el) => { const r = el.getBoundingClientRect(); return Math.round(r.width * r.height / 1000); }).slice(0, 10),
    distinctBgColors: new Set(all.map((el) => cs(el).backgroundColor)).size,
    borderColors: tally(all.filter((el) => cs(el).borderTopStyle !== 'none' && cs(el).borderTopWidth !== '0px'), (el) => cs(el).borderTopWidth + ' ' + cs(el).borderTopColor).slice(0, 6),
    radii: radii.slice(0, 10), distinctRadii: radii.length,
    shadows: shadows.slice(0, 5), distinctShadows: shadows.length,
    gradients, textGradients, blurs, animated,
    wideWrappers: wideWrappers.slice(0, 5),
    nav: navR ? { h: Math.round(navR.height), bg: cs(nav).backgroundColor, blur: cs(nav).backdropFilter, links: nav.querySelectorAll('a').length } : null,
    h1: heading('h1'), h2: heading('h2'), h3: heading('h3').slice(0, 3),
    foldButtons: buttons,
    fold: { elements: fold.length, chars: foldChars, mediaCount: foldMedia.length, mediaAreaPct: Math.round(mediaArea / (innerWidth * H) * 100), clickable: fold.filter((el) => el.matches('a,button')).length },
    media: { total: media.length, videos: videos.length, videosPlaying: videos.filter((v) => !v.paused).length, videoAutoplayAttr: videos.filter((v) => v.autoplay).length },
    sections,
  };
})()`;

const results = {};
for (const pair of pairs) {
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq), url = pair.slice(eq + 1);
  await getJSON('/json/version');
  const target = await getJSON('/json/new?about:blank', 'PUT');
  const c = await connect(target.webSocketDebuggerUrl);
  await c.send('Page.enable'); await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  console.error(`[${name}] 打开 ${url}`);
  await c.send('Page.navigate', { url });
  await sleep(9000);
  const ev = (expr) => c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  // 首屏截图
  const shot1 = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${name}-fold.png`), Buffer.from(shot1.data, 'base64'));
  const m = (await ev(MEASURE)).result.value;
  // 慢慢滚到底触发懒加载，再截整页（最高 7000px）
  await ev(`(async () => { for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 9000); y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 350)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 1500)); })()`);
  const fullH = Math.min((await ev('document.documentElement.scrollHeight')).result.value, 7000);
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: fullH, deviceScaleFactor: 1, mobile: false });
  await sleep(2500);
  const shot2 = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  writeFileSync(join(outDir, `${name}-full.jpg`), Buffer.from(shot2.data, 'base64'));
  results[name] = m;
  c.close();
}
writeFileSync(join(outDir, 'measurements.json'), JSON.stringify(results, null, 2));
chrome.kill();
console.error('完成');
process.exit(0);
