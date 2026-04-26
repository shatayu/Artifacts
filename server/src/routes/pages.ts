import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";
import { artifactsPool } from "../db/artifacts.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_PATH = join(__dirname, "..", "..", "public", "icon.png");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HEAD_META = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Artifacts">
<meta name="theme-color" content="#faf9f5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e0e10" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="manifest" href="/manifest.webmanifest">
`;

// Shared design tokens used by both pages. Warm off-white paper / deep ink /
// mono caps for chrome / one orange accent. The palette intentionally avoids
// iOS systemBlue and iOS card insets.
const TOKENS = `
:root {
  color-scheme: light dark;
  --bg: #faf9f5;
  --surface: #ffffff;
  --ink: #131211;
  --mute: #6b665e;
  --line: #e3dfd5;
  --line-strong: #c8c2b3;
  --accent: #d8541b;
  --accent-ink: #ffffff;
  --hover: #f1ede2;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e0e10;
    --surface: #15151a;
    --ink: #ecead7;
    --mute: #8e8a7d;
    --line: #25252b;
    --line-strong: #3a3a40;
    --accent: #ee7035;
    --accent-ink: #1a1a1a;
    --hover: #1c1c22;
  }
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.mono { font-family: var(--mono); letter-spacing: 0.02em; }
.caps { text-transform: uppercase; letter-spacing: 0.08em; }
`;

const LIST_PAGE = `<!doctype html>
<html lang="en">
<head>
${HEAD_META}
<title>Artifacts</title>
<style>
${TOKENS}
body {
  padding:
    calc(env(safe-area-inset-top) + 4px)
    calc(env(safe-area-inset-right) + 16px)
    calc(env(safe-area-inset-bottom) + 32px)
    calc(env(safe-area-inset-left) + 16px);
  max-width: 720px;
  margin: 0 auto;
}
.head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 0 12px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}
.head .title {
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink);
  display: flex; align-items: baseline; gap: 12px;
}
.head .title .count { color: var(--mute); }
.iconbtn {
  appearance: none; background: transparent; border: 1px solid var(--line);
  color: var(--ink); padding: 6px; cursor: pointer;
  border-radius: 4px; line-height: 0;
  transition: background 120ms ease, border-color 120ms ease;
}
.iconbtn:hover { background: var(--hover); border-color: var(--line-strong); }
.iconbtn.spin svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.iconbtn svg { width: 16px; height: 16px; display: block; }

.list {
  display: flex; flex-direction: column; gap: 10px;
}
a.card {
  display: block;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  color: inherit; text-decoration: none;
  transition: border-color 120ms ease, transform 120ms ease, background 120ms ease;
}
a.card:hover { border-color: var(--line-strong); }
a.card:active { background: var(--hover); transform: translateY(1px); }
a.card .name { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
a.card .meta {
  display: flex; gap: 8px; align-items: center;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--mute);
  margin-top: 4px;
}
a.card .meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--mute); }
a.card .desc {
  margin-top: 10px; font-size: 14px; color: var(--mute); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

.state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 20px; color: var(--mute); text-align: center; gap: 14px;
}
.state svg { width: 28px; height: 28px; opacity: 0.6; }
.state h2 { color: var(--ink); font-size: 16px; margin: 0; font-weight: 600; }
.state p { margin: 0; font-size: 13px; }
.state .note {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--mute);
}
.state input {
  margin-top: 4px;
  padding: 10px 12px; font-size: 14px;
  border: 1px solid var(--line-strong); border-radius: 4px;
  background: var(--surface); color: var(--ink);
  width: 100%; max-width: 320px;
  font-family: var(--mono);
}
.state input:focus { outline: none; border-color: var(--accent); }
.state .primary {
  appearance: none; border: 1px solid var(--accent);
  background: var(--accent); color: var(--accent-ink);
  padding: 9px 18px; font-size: 13px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  border-radius: 4px; cursor: pointer; font-family: var(--mono);
}
.state .primary:hover { filter: brightness(0.95); }
</style>
</head>
<body>
<div class="head">
  <div class="title">
    <span>Artifacts</span>
    <span id="count" class="count"></span>
  </div>
  <button id="refresh" class="iconbtn" aria-label="Refresh">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7"></path>
      <polyline points="21 4 21 10 15 10"></polyline>
    </svg>
  </button>
</div>
<div id="root"><div class="state"><p class="note">Loading…</p></div></div>
<script>
(function () {
  const KEY_NAME = "artifacts_api_key";
  const root = document.getElementById("root");
  const countEl = document.getElementById("count");

  // Soak ?key= from URL on first visit.
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  if (urlKey) {
    localStorage.setItem(KEY_NAME, urlKey);
    params.delete("key");
    const next = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", next);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function relativeTime(ms) {
    const diff = Date.now() - ms;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
    if (diff < 30 * 86_400_000) return Math.floor(diff / 86_400_000) + "d ago";
    return new Date(ms).toLocaleDateString();
  }

  function renderMissingKey() {
    countEl.textContent = "";
    root.innerHTML =
      '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="4" y="10" width="16" height="11" rx="1"></rect>' +
          '<path d="M8 10V7a4 4 0 0 1 8 0v3"></path>' +
        '</svg>' +
        '<h2>API key required</h2>' +
        '<p class="note">Paste your key to continue</p>' +
        '<input id="keyInput" type="password" autocomplete="off" placeholder="sk_…">' +
        '<button id="keySave" class="primary">Save</button>' +
      '</div>';
    document.getElementById("keySave").onclick = function () {
      const v = document.getElementById("keyInput").value.trim();
      if (!v) return;
      localStorage.setItem(KEY_NAME, v);
      load();
    };
    document.getElementById("keyInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("keySave").click();
    });
  }

  function renderError(msg) {
    countEl.textContent = "";
    root.innerHTML =
      '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<circle cx="12" cy="12" r="9"></circle>' +
          '<path d="M12 8v4M12 16h.01"></path>' +
        '</svg>' +
        '<h2>Could not load artifacts</h2>' +
        '<p class="note">' + escapeHtml(msg) + '</p>' +
        '<button id="retryBtn" class="primary">Retry</button>' +
      '</div>';
    document.getElementById("retryBtn").onclick = load;
  }

  function renderEmpty() {
    countEl.textContent = "0";
    root.innerHTML =
      '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="3" y="6" width="18" height="14" rx="1"></rect>' +
          '<path d="M3 10h18"></path>' +
        '</svg>' +
        '<h2>No pinned artifacts</h2>' +
        '<p class="note">Star artifacts in Cowork to see them here</p>' +
      '</div>';
  }

  function renderList(items) {
    if (!items.length) return renderEmpty();
    countEl.textContent = String(items.length);
    const html = items.map(function (a) {
      const updated = a.version_ts ? relativeTime(Number(a.version_ts)) : "";
      return '<a class="card" href="/artifact/' + encodeURIComponent(a.id) + '">' +
               '<div class="name">' + escapeHtml(a.name) + '</div>' +
               '<div class="meta">' +
                 '<span>' + escapeHtml(a.id) + '</span>' +
                 (updated ? '<span class="dot"></span><span>' + escapeHtml(updated) + '</span>' : '') +
               '</div>' +
               (a.description
                 ? '<div class="desc">' + escapeHtml(a.description) + '</div>'
                 : '') +
             '</a>';
    }).join("");
    root.innerHTML = '<div class="list">' + html + '</div>';
  }

  const refreshBtn = document.getElementById("refresh");

  async function load(opts) {
    opts = opts || {};
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return renderMissingKey();
    if (!opts.silent) root.innerHTML = '<div class="state"><p class="note">Loading…</p></div>';
    refreshBtn.classList.add("spin");
    try {
      const res = await fetch("/artifacts", {
        headers: { Authorization: "Bearer " + key },
        cache: opts.fresh ? "reload" : "default",
      });
      if (res.status === 401) {
        localStorage.removeItem(KEY_NAME);
        return renderMissingKey();
      }
      if (!res.ok) {
        const text = await res.text();
        return renderError("API " + res.status + ": " + text);
      }
      const items = await res.json();
      renderList(items);
      prefetchArtifacts(items, key);
    } catch (e) {
      renderError(e && e.message ? e.message : String(e));
    } finally {
      refreshBtn.classList.remove("spin");
    }
  }

  // Fire-and-forget: warm the SW cache with every artifact's HTML so a tap
  // on a card renders instantly. Concurrent, errors swallowed (whatever
  // succeeds is a win; a failure just means that one card won't be cached).
  function prefetchArtifacts(items, key) {
    if (!("serviceWorker" in navigator)) return;
    items.forEach(function (a) {
      const url = "/artifacts/" + encodeURIComponent(a.id) + "/html?key=" + encodeURIComponent(key);
      fetch(url).catch(function () {});
    });
  }

  refreshBtn.addEventListener("click", function () { load({ silent: true, fresh: true }); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") load({ silent: true, fresh: true });
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) load({ silent: true });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  load();
})();
</script>
</body>
</html>
`;

function shellPage(name: string, id: string): string {
  return `<!doctype html>
<html lang="en">
<head>
${HEAD_META}
<title>${escapeHtml(name)} · Artifacts</title>
<style>
${TOKENS}
html, body { height: 100%; }
body {
  display: flex; flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  position: sticky; top: env(safe-area-inset-top); z-index: 1;
}
header .crumb {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--mute);
  display: flex; align-items: baseline; gap: 8px;
  overflow: hidden;
}
header .crumb a {
  color: var(--ink); text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 120ms ease;
}
header .crumb a:hover { border-bottom-color: var(--accent); }
header .crumb .sep { color: var(--mute); }
header .crumb .name {
  text-transform: none; letter-spacing: -0.005em; color: var(--ink);
  font-family: var(--sans); font-size: 14px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.iconbtn {
  appearance: none; background: transparent; border: 1px solid var(--line);
  color: var(--ink); padding: 6px; cursor: pointer;
  border-radius: 4px; line-height: 0;
  transition: background 120ms ease, border-color 120ms ease;
}
.iconbtn:hover { background: var(--hover); border-color: var(--line-strong); }
.iconbtn.spin svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.iconbtn svg { width: 16px; height: 16px; display: block; }
iframe {
  flex: 1; width: 100%; border: 0; background: var(--surface);
}
.err {
  padding: 60px 24px; color: var(--mute); text-align: center;
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
}
.err a { color: var(--accent); }
</style>
</head>
<body>
<header>
  <div class="crumb">
    <a href="/">Artifacts</a>
    <span class="sep">/</span>
    <span class="name">${escapeHtml(name)}</span>
  </div>
  <button id="refresh" class="iconbtn" aria-label="Refresh">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7"></path>
      <polyline points="21 4 21 10 15 10"></polyline>
    </svg>
  </button>
</header>
<iframe id="frame" allow="clipboard-write"></iframe>
<script>
(function () {
  const KEY_NAME = "artifacts_api_key";
  const ARTIFACT_ID = ${JSON.stringify(id)};
  const key = localStorage.getItem(KEY_NAME);
  const frame = document.getElementById("frame");
  const refreshBtn = document.getElementById("refresh");
  if (!key) {
    document.body.innerHTML = '<div class="err">No API key saved. <a href="/">Go back to set one.</a></div>';
    return;
  }
  function buildSrc(fresh) {
    var qs = "?key=" + encodeURIComponent(key);
    if (fresh) qs += "&fresh=" + Date.now();
    return "/artifacts/" + encodeURIComponent(ARTIFACT_ID) + "/html" + qs;
  }
  function reload() {
    refreshBtn.classList.add("spin");
    frame.src = buildSrc(true);
  }
  frame.addEventListener("load", function () {
    refreshBtn.classList.remove("spin");
  });
  refreshBtn.addEventListener("click", reload);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }
  frame.src = buildSrc(false);
})();
</script>
</body>
</html>
`;
}

const MANIFEST = JSON.stringify({
  name: "Artifacts",
  short_name: "Artifacts",
  start_url: "/",
  display: "standalone",
  background_color: "#faf9f5",
  theme_color: "#faf9f5",
  icons: [
    { src: "/icon.png", sizes: "180x180", type: "image/png" },
  ],
});

// Bump CACHE_VERSION whenever SERVICE_WORKER changes so old clients drop their
// caches on activate. Pages and artifact HTML use stale-while-revalidate;
// /artifacts/:id/query (POST) is always passed through to the network because
// the SQL results need to be live.
const CACHE_VERSION = "v1";
const SERVICE_WORKER = `
const CACHE = "artifacts-${CACHE_VERSION}";
const STATIC = ["/icon.png", "/manifest.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(STATIC); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache busters and per-session query params shouldn't fragment the cache.
function cacheKey(url) {
  var u = new URL(url);
  u.searchParams.delete("_");
  return u.toString();
}

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then(function (cache) {
    var key = cacheKey(req.url);
    return cache.match(key).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          cache.put(key, res.clone()).catch(function () {});
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    });
  });
}

function networkAndUpdate(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      caches.open(CACHE).then(function (c) {
        c.put(cacheKey(req.url), res.clone()).catch(function () {});
      });
    }
    return res;
  });
}

function shouldBypassCache(req) {
  if (req.cache === "reload" || req.cache === "no-cache") return true;
  return new URL(req.url).searchParams.has("fresh");
}

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;

  var p = url.pathname;
  var isPage = p === "/" || p.indexOf("/artifact/") === 0;
  var isList = p === "/artifacts";
  var isHtml = /^\\/artifacts\\/[^/]+\\/html$/.test(p);
  var isStatic = STATIC.indexOf(p) !== -1;

  if (!(isPage || isList || isHtml || isStatic)) return;

  if (shouldBypassCache(e.request)) {
    e.respondWith(networkAndUpdate(e.request));
  } else {
    e.respondWith(staleWhileRevalidate(e.request));
  }
});
`;

export const pagesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (_req, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return LIST_PAGE;
  });

  fastify.get<{ Params: { id: string } }>(
    "/artifact/:id",
    async (req, reply) => {
      const { rows } = await artifactsPool.query<{ name: string }>(
        `SELECT name FROM artifacts WHERE id = $1 AND is_starred = TRUE`,
        [req.params.id],
      );
      if (rows.length === 0) {
        reply.header("Content-Type", "text/html; charset=utf-8");
        return reply
          .code(404)
          .send(`<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font:14px ui-monospace,Menlo,monospace;padding:60px 24px;text-align:center;letter-spacing:.08em;text-transform:uppercase;color:#6b665e">Artifact not found · <a href="/" style="color:#d8541b">back</a></p>`);
      }
      reply.header("Content-Type", "text/html; charset=utf-8");
      return shellPage(rows[0]!.name, req.params.id);
    },
  );

  fastify.get("/manifest.webmanifest", async (_req, reply) => {
    reply.header("Content-Type", "application/manifest+json");
    return MANIFEST;
  });

  fastify.get("/icon.png", async (_req, reply) => {
    try {
      const buf = readFileSync(ICON_PATH);
      reply.header("Content-Type", "image/png");
      reply.header("Cache-Control", "public, max-age=86400");
      return reply.send(buf);
    } catch {
      return reply.code(404).send({ error: "icon not generated" });
    }
  });

  fastify.get("/sw.js", async (_req, reply) => {
    reply.header("Content-Type", "application/javascript; charset=utf-8");
    reply.header("Cache-Control", "no-cache");
    reply.header("Service-Worker-Allowed", "/");
    return SERVICE_WORKER;
  });
};
