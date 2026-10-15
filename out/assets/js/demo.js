/**
 * Frontend-only demo mode. Never calls /api/generate, /api/upload,
 * /api/upload-ticket, or KIE. Real generation stays gated by GENERATION_ENABLED.
 */
(function (root) {
  var STORAGE_FLAG = "du_demo";
  var HISTORY_KEY = "du_demo_history";
  var BADGE_LABEL = "演示样片 / Demo sample";
  var BLOCKED_API = ["/api/generate", "/api/upload", "/api/upload-ticket"];

  /**
   * Sample clips for the partner walkthrough.
   * Video src files were generated from existing workspace Look stills
   * (g1.webp, feature-cinematic.webp, g3.webp). They are placeholders —
   * replace with real 1080p product clips when those land in out/assets/demo/.
   *
   * TODO: out/assets/demo/sample-general.mp4 ← replace with a 1080p product clip
   * TODO: out/assets/demo/sample-cinematic.mp4 ← replace with a 1080p product clip
   * TODO: out/assets/demo/sample-vertical.mp4 ← replace with a 1080p 9:16 clip
   */
  var DEMO_SAMPLES = [
    {
      id: "look-general",
      kind: "video",
      poster: "/assets/images/g1.webp",
      src: "/assets/demo/sample-general.mp4",
      look: "General",
    },
    {
      id: "look-cinematic",
      kind: "video",
      poster: "/assets/images/feature-cinematic.webp",
      src: "/assets/demo/sample-cinematic.mp4",
      look: "Cinematic",
    },
    {
      id: "look-vertical",
      kind: "video",
      poster: "/assets/images/g3.webp",
      src: "/assets/demo/sample-vertical.mp4",
      look: "Vertical",
    },
    {
      id: "still-g1",
      kind: "image",
      poster: "/assets/images/g1.webp",
      src: "/assets/images/g1.webp",
      look: "General",
    },
    {
      id: "still-g5",
      kind: "image",
      poster: "/assets/images/g5.webp",
      src: "/assets/images/g5.webp",
      look: "Cinematic",
    },
  ];

  var sampleCursor = { video: 0, image: 0 };
  var guardInstalled = false;

  function brandName() {
    if (root && root.DU && root.DU.BRAND_NAME) return String(root.DU.BRAND_NAME);
    return "DreamUtopia";
  }

  function t(key, fallback) {
    if (root && root.DU && typeof root.DU.t === "function") {
      var v = root.DU.t(key, fallback);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function readSearch(loc) {
    if (loc && typeof loc.search === "string") return loc.search;
    if (typeof location !== "undefined") return location.search || "";
    return "";
  }

  function readPath(loc) {
    if (loc && typeof loc.pathname === "string") return loc.pathname;
    if (typeof location !== "undefined") return location.pathname || "";
    return "";
  }

  function storageOf(store) {
    if (store) return store;
    try {
      if (typeof sessionStorage !== "undefined") return sessionStorage;
    } catch (e) {}
    return null;
  }

  function isDemoMode(loc, store) {
    var q = new URLSearchParams(readSearch(loc));
    var demo = q.get("demo");
    var bag = storageOf(store);
    if (demo === "0" || demo === "false") {
      try {
        if (bag) bag.removeItem(STORAGE_FLAG);
      } catch (e) {}
      return false;
    }
    if (demo === "1" || demo === "true") {
      try {
        if (bag) bag.setItem(STORAGE_FLAG, "1");
      } catch (e) {}
      return true;
    }
    var path = readPath(loc).replace(/\/+$/, "") || "/";
    if (path === "/demo") return true;
    try {
      return !!(bag && bag.getItem(STORAGE_FLAG) === "1");
    } catch (e) {
      return false;
    }
  }

  function blockedUrl(url) {
    var s = String(url || "");
    var i;
    for (i = 0; i < BLOCKED_API.length; i++) {
      if (s.indexOf(BLOCKED_API[i]) !== -1) return true;
    }
    if (/kie\.ai/i.test(s)) return true;
    return false;
  }

  function blockedPath(path) {
    var p = String(path || "").split("?")[0];
    if (p.charAt(0) !== "/") p = "/" + p;
    if (p.indexOf("/api/") !== 0) p = "/api" + (p.charAt(0) === "/" ? p : "/" + p);
    return blockedUrl(p);
  }

  function samplesFor(kind) {
    var want = kind === "image" ? "image" : "video";
    return DEMO_SAMPLES.filter(function (row) {
      return row.kind === want;
    });
  }

  function pickSample(kind) {
    var list = samplesFor(kind);
    if (!list.length) list = DEMO_SAMPLES;
    var key = kind === "image" ? "image" : "video";
    var i = sampleCursor[key] % list.length;
    sampleCursor[key] = i + 1;
    return list[i];
  }

  function loadHistory(store) {
    var bag = store;
    if (!bag) {
      try {
        bag = typeof localStorage !== "undefined" ? localStorage : null;
      } catch (e) {
        bag = null;
      }
    }
    if (!bag) return [];
    try {
      var raw = bag.getItem(HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(items, store) {
    var bag = store;
    if (!bag) {
      try {
        bag = typeof localStorage !== "undefined" ? localStorage : null;
      } catch (e) {
        bag = null;
      }
    }
    if (!bag) return;
    try {
      bag.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
    } catch (e) {}
  }

  function pushHistory(item, store) {
    var list = loadHistory(store);
    list.unshift(item);
    saveHistory(list, store);
    return list;
  }

  function defaultWait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function runGenerate(opts) {
    opts = opts || {};
    var wait = typeof opts.wait === "function" ? opts.wait : defaultWait;
    var onProgress = typeof opts.onProgress === "function" ? opts.onProgress : function () {};
    var kind = opts.kind === "image" ? "image" : "video";
    var sample = pickSample(kind);
    var steps = [
      { status: "waiting", ms: 700 },
      { status: "generating", ms: 1400 },
      { status: "success", ms: 500 },
    ];

    function step(i) {
      if (i >= steps.length) {
        var item = {
          id: "demo_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e4).toString(36),
          kind: sample.kind,
          model: opts.model || "lite",
          prompt: String(opts.prompt || ""),
          status: "done",
          duration_sec: kind === "video" ? (Number(opts.durationSec) === 10 ? 10 : 5) : null,
          resultUrl: sample.src,
          result_url: sample.src,
          input_image_url: opts.localImageUrl || "",
          last_image_url: opts.localLastImageUrl || "",
          created_at: new Date().toISOString(),
          demo: true,
          guest: true,
        };
        if (opts.persist !== false) pushHistory(item, opts.store);
        return item;
      }
      onProgress(steps[i].status);
      return wait(steps[i].ms).then(function () {
        return step(i + 1);
      });
    }

    return Promise.resolve().then(function () {
      return step(0);
    });
  }

  function badgeHtml() {
    return '<span class="demo-sample-badge" data-demo-badge="1">' + BADGE_LABEL + "</span>";
  }

  function visibleCopy() {
    var name = brandName();
    return [
      t("demo.try", "Try demo"),
      t("demo.banner", "Demo mode — sample clips only. Uploads stay in this browser."),
      t("demo.foot", "Sample walkthrough. Nothing is billed."),
      t("demo.welcome", "Walk through upload, generate, view, and download with sample clips."),
      t("demo.in", "You are in demo"),
      BADGE_LABEL,
      name,
    ];
  }

  function keepDemoQuery(loc) {
    if (typeof history === "undefined" || !history.replaceState) return;
    try {
      var url = new URL(loc && loc.href ? loc.href : location.href);
      if (url.searchParams.get("demo") === "1") return;
      url.searchParams.set("demo", "1");
      history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString() + url.hash);
    } catch (e) {}
  }

  function installNetworkGuard() {
    if (guardInstalled) return;
    guardInstalled = true;
    if (typeof root === "undefined" || typeof root.fetch !== "function") return;
    var origFetch = root.fetch;
    root.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (isDemoMode() && blockedUrl(url)) {
        return Promise.reject(new Error("demo mode must not call " + url));
      }
      return origFetch.apply(this, arguments);
    };
    if (root.DU && typeof root.DU.api === "function" && !root.DU.api.__demoWrapped) {
      var origApi = root.DU.api;
      root.DU.api = function (path, options) {
        if (isDemoMode() && blockedPath(path)) {
          return Promise.reject(new Error("demo mode must not call /api" + path));
        }
        return origApi.apply(this, arguments);
      };
      root.DU.api.__demoWrapped = true;
    }
    if (root.DU && typeof root.DU.uploadImage === "function" && !root.DU.uploadImage.__demoWrapped) {
      var origUpload = root.DU.uploadImage;
      root.DU.uploadImage = function () {
        if (isDemoMode()) {
          var err = new Error("demo mode keeps the image in this browser");
          err.code = "demo_local_only";
          return Promise.reject(err);
        }
        return origUpload.apply(this, arguments);
      };
      root.DU.uploadImage.__demoWrapped = true;
    }
  }

  function applyChrome(doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc || !isDemoMode()) return;
    installNetworkGuard();
    keepDemoQuery();
    if (doc.body) doc.body.classList.add("demo-mode");
    var notes = doc.querySelectorAll("[data-gen-closed-note]");
    var footCopy = t("demo.foot", "Sample walkthrough. Nothing is billed.");
    for (var i = 0; i < notes.length; i++) {
      notes[i].hidden = true;
      notes[i].textContent = footCopy;
    }
    var banner = doc.getElementById("demoBanner");
    if (banner) {
      banner.hidden = false;
      banner.classList.add("show");
    }
    var tryBtns = doc.querySelectorAll("[data-demo-enter]");
    for (var j = 0; j < tryBtns.length; j++) {
      tryBtns[j].hidden = true;
    }
    var welcomeP = doc.querySelector("#welcomeBanner p");
    if (welcomeP) welcomeP.textContent = t("demo.welcome", "Walk through upload, generate, view, and download with sample clips.");
    var welcomeH = doc.querySelector("#welcomeBanner h2");
    if (welcomeH) welcomeH.textContent = t("demo.in", "You are in demo");
    var foot = doc.getElementById("genFoot");
    if (foot) {
      foot.hidden = false;
      foot.textContent = footCopy;
    }
    var hint = doc.getElementById("urlHint");
    if (hint) hint.textContent = t("demo.upload", "The image stays in this browser. It is never sent to the server.");
  }

  var api = {
    STORAGE_FLAG: STORAGE_FLAG,
    HISTORY_KEY: HISTORY_KEY,
    BADGE_LABEL: BADGE_LABEL,
    BLOCKED_API: BLOCKED_API,
    DEMO_SAMPLES: DEMO_SAMPLES,
    brandName: brandName,
    isDemoMode: isDemoMode,
    blockedUrl: blockedUrl,
    blockedPath: blockedPath,
    pickSample: pickSample,
    samplesFor: samplesFor,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    pushHistory: pushHistory,
    runGenerate: runGenerate,
    badgeHtml: badgeHtml,
    visibleCopy: visibleCopy,
    applyChrome: applyChrome,
    installNetworkGuard: installNetworkGuard,
    keepDemoQuery: keepDemoQuery,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) root.DU_DEMO = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
