const appOrigin = "https://dreamutopia-clone.pages.dev";
const assets = new Set(/* @assetPaths */ []);
const movies = new Map(/* @movieManifest */ []);

function parseBytes(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const count = Math.min(Number(match[2]), size);
    return count > 0 ? { first: size - count, last: size - 1 } : null;
  }
  const first = Number(match[1]);
  const last = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return first <= last && first < size ? { first, last } : null;
}

async function serveMovie(request, env, movie) {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=0, must-revalidate, no-transform",
    "CDN-Cache-Control": "no-store",
    "Content-Type": "video/mp4",
    "ETag": movie.etag,
    "X-Content-Type-Options": "nosniff",
    "X-Cutroom-Media": "range-v1",
  });
  const rangeValue = request.headers.get("range");
  const validator = request.headers.get("if-range");
  const partial = rangeValue !== null && (!validator || validator === movie.etag);
  const selected = partial ? parseBytes(rangeValue, movie.size) : { first: 0, last: movie.size - 1 };
  if (!selected) {
    headers.set("Content-Range", "bytes */" + movie.size);
    headers.set("Content-Length", "0");
    return new Response(null, { status: 416, headers });
  }
  const { first, last } = selected;
  const length = last - first + 1;
  headers.set("Content-Length", String(length));
  if (partial) headers.set("Content-Range", `bytes ${first}-${last}/${movie.size}`);
  const init = { status: partial ? 206 : 200, headers };
  if (request.method === "HEAD") return new Response(null, init);

  // Pages' asset binding can ignore Range. Read the uncompressed original from
  // a separate lookup path and give workerd fixed-size bytes for the response.
  const source = new URL(movie.source, request.url);
  const file = await env.ASSETS.fetch(new Request(source, { headers: { "Accept-Encoding": "identity" } }));
  const bytes = file.status === 200 ? await file.arrayBuffer() : null;
  if (!bytes || bytes.byteLength !== movie.size) {
    return new Response("Media source unavailable", { status: 502, headers: {
      "Cache-Control": "no-store", "X-Cutroom-Media": "range-v1",
    } });
  }
  return new Response(new Uint8Array(bytes, first, length), init);
}

function pageLocale(path) {
  if (path === "/" || path === "/en" || path === "/en/") return "english";
  if (path === "/zh" || path === "/zh/") return "chinese";
}

async function fetchApp(request) {
  const target = new URL(request.url);
  const upstream = new URL(appOrigin);
  upstream.pathname = target.pathname;
  upstream.search = target.search;
  // Set the upstream host explicitly; the Pages project handles the original APP binding.
  const proxied = new Request(upstream, request);
  proxied.headers.delete("host");
  const response = await fetch(proxied, { redirect: "manual" });
  const location = response.headers.get("location");
  if (location) {
    const redirect = new URL(location, upstream);
    if (redirect.origin === appOrigin) {
      const headers = new Headers(response.headers);
      headers.set("location", target.origin + redirect.pathname + redirect.search + redirect.hash);
      return new Response(response.body, { status: response.status, headers });
    }
  }
  return response;
}

function anonymousWorkbenchDocument(request, url) {
  if (request.method !== "GET" || url.search) return null;
  const match = /^\/(?:(zh|en)\/)?text-to-video\/?$/.exec(url.pathname);
  if (!match) return null;
  const headers = request.headers;
  if (headers.has("authorization") || headers.has("proxy-authorization") ||
      headers.has("cf-access-jwt-assertion") || headers.has("cf-access-authenticated-user-email") ||
      headers.has("x-api-key") || headers.has("rsc") || headers.has("next-action") ||
      headers.has("next-router-state-tree") || headers.has("next-router-prefetch") ||
      headers.has("range") || /prefetch/i.test((headers.get("purpose") || "") + (headers.get("sec-purpose") || ""))) return null;
  // Only a locale preference can accompany an anonymous snapshot. Unknown cookies
  // can identify a session even if their names do not follow Better Auth conventions.
  const cookies = (headers.get("cookie") || "").split(";").map(c => c.trim()).filter(Boolean);
  if (cookies.some(c => !/^NEXT_LOCALE=(en|zh)$/.test(c))) return null;
  const dest = headers.get("sec-fetch-dest");
  if (dest ? dest !== "document" : !/\btext\/html\b/i.test(headers.get("accept") || "")) return null;
  return match[1] === "zh" ? "chinese" : "english";
}

async function forward(request, env, locale) {
  const send = () => env.APP ? env.APP.fetch(request) : fetchApp(request);
  if (!locale) return send();
  let original;
  let originalError;
  try {
    original = await send();
    if (original.status < 500 || original.status > 599) return original;
  } catch (error) {
    originalError = error;
  }
  try {
    const path = new URL("/workbench-docs/" + locale + ".snapshot", request.url);
    const snapshot = await env.ASSETS.fetch(new Request(path));
    if (snapshot.status === 200) {
      if (original?.body) original.body.cancel().catch(() => {});
      return new Response(snapshot.body, { headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store", "Vary": "Authorization, Cookie, Accept, Sec-Fetch-Dest, RSC",
        "X-Premiere-Workbench-Fallback": "1", "X-Robots-Tag": "noindex, nofollow",
        "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }});
    }
  } catch {}
  if (original) return original;
  throw originalError;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const read = request.method === "GET" || request.method === "HEAD";
    const movie = movies.get(url.pathname);
    if (read && movie) return serveMovie(request, env, movie);
    const locale = pageLocale(url.pathname);
    const rsc = request.headers.get("rsc") === "1" || url.searchParams.has("_rsc");
    let from = "";
    try {
      from = new URL(request.headers.get("referer") || "").pathname;
    } catch {}
    // Next falls back to document navigation for non-Flight responses. Keep the
    // old workbench build and the static design preview from sharing a Flight tree.
    if (read && rsc && (locale || !from || pageLocale(from))) {
      return new Response(null, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Vary": "RSC" } });
    }
    if (read && locale) {
      const path = new URL("/screening-home/" + locale + ".snapshot", url);
      const body = await env.ASSETS.fetch(new Request(path, { method: request.method }));
      if (!body.ok) return body;
      return new Response(body.body, { status: 200, headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Vary": "RSC",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "DENY"
      } });
    }
    let asset = url.pathname;
    try {
      asset = decodeURIComponent(asset);
    } catch {}
    if (read && assets.has(asset)) return env.ASSETS.fetch(request);
    return forward(request, env, anonymousWorkbenchDocument(request, url));
  }
};
