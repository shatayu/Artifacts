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
<meta name="theme-color" content="#f2f2f7">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="manifest" href="/manifest.webmanifest">
`;

const LIST_PAGE = `<!doctype html>
<html lang="en">
<head>
${HEAD_META}
<title>Artifacts</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f2f2f7;
    --card: #ffffff;
    --primary: #000;
    --secondary: #6e6e73;
    --separator: #e5e5ea;
    --accent: #007aff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #000;
      --card: #1c1c1e;
      --primary: #fff;
      --secondary: #98989f;
      --separator: #38383a;
    }
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0;
    background: var(--bg);
    color: var(--primary);
    font: -apple-system-body, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .titlebar {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin: 16px 20px 12px;
  }
  .titlebar h1 {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.37px;
    margin: 0;
  }
  .refresh {
    appearance: none; background: none; border: none;
    color: var(--accent); font-size: 22px; line-height: 1;
    padding: 8px; margin: 0; cursor: pointer;
  }
  .refresh.spin svg { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .refresh svg { width: 22px; height: 22px; display: block; }
  .list {
    background: var(--card);
    border-radius: 10px;
    margin: 0 16px 16px;
    overflow: hidden;
  }
  a.row {
    display: block;
    padding: 14px 16px;
    color: inherit;
    text-decoration: none;
    border-top: 0.5px solid var(--separator);
    position: relative;
  }
  a.row:first-child { border-top: none; }
  a.row::after {
    content: "›";
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--secondary);
    font-size: 22px;
    line-height: 1;
  }
  .name { font-size: 17px; font-weight: 600; padding-right: 24px; }
  .desc { font-size: 12px; color: var(--secondary); margin-top: 4px; padding-right: 24px;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px 20px; color: var(--secondary); text-align: center;
  }
  .state svg { width: 40px; height: 40px; margin-bottom: 12px; }
  .state h2 { color: var(--primary); font-size: 17px; margin: 0 0 6px; }
  .state p { margin: 6px 0; font-size: 13px; }
  .state input {
    margin-top: 16px;
    padding: 12px 14px;
    font-size: 15px;
    border-radius: 10px;
    border: 1px solid var(--separator);
    background: var(--card);
    color: var(--primary);
    width: 100%;
    max-width: 320px;
  }
  .state button {
    margin-top: 12px;
    padding: 12px 20px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    background: var(--accent);
    color: #fff;
  }
</style>
</head>
<body>
<div class="titlebar">
  <h1>Artifacts</h1>
  <button id="refresh" class="refresh" aria-label="Refresh">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7"></path>
      <polyline points="21 4 21 10 15 10"></polyline>
    </svg>
  </button>
</div>
<div id="root"><div class="state"><p>Loading…</p></div></div>
<script>
(function () {
  const KEY_NAME = "artifacts_api_key";
  const root = document.getElementById("root");

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

  function renderMissingKey() {
    root.innerHTML =
      '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="4" y="10" width="16" height="11" rx="2"></rect>' +
          '<path d="M8 10V7a4 4 0 0 1 8 0v3"></path>' +
        '</svg>' +
        '<h2>API key needed</h2>' +
        '<p>Paste your API key to continue.</p>' +
        '<input id="keyInput" type="password" autocomplete="off" placeholder="API key">' +
        '<button id="keySave">Save</button>' +
      '</div>';
    document.getElementById("keySave").onclick = function () {
      const v = document.getElementById("keyInput").value.trim();
      if (!v) return;
      localStorage.setItem(KEY_NAME, v);
      load();
    };
  }

  function renderError(msg) {
    root.innerHTML =
      '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>' +
        '</svg>' +
        '<h2>Couldn\\'t load artifacts</h2>' +
        '<p>' + escapeHtml(msg) + '</p>' +
        '<button id="retryBtn">Retry</button>' +
      '</div>';
    document.getElementById("retryBtn").onclick = load;
  }

  function renderEmpty() {
    root.innerHTML =
      '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<path d="M22 12h-6l-2 3h-4l-2-3H2"></path>' +
          '<path d="M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"></path>' +
        '</svg>' +
        '<h2>No pinned artifacts</h2>' +
        '<p>Star artifacts in Cowork to see them here.</p>' +
      '</div>';
  }

  function renderList(items) {
    if (!items.length) return renderEmpty();
    const html = items.map(function (a) {
      return '<a class="row" href="/artifact/' + encodeURIComponent(a.id) + '">' +
               '<div class="name">' + escapeHtml(a.name) + '</div>' +
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
    if (!opts.silent) root.innerHTML = '<div class="state"><p>Loading…</p></div>';
    refreshBtn.classList.add("spin");
    try {
      const res = await fetch("/artifacts", {
        headers: { Authorization: "Bearer " + key },
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
    } catch (e) {
      renderError(e && e.message ? e.message : String(e));
    } finally {
      refreshBtn.classList.remove("spin");
    }
  }

  refreshBtn.addEventListener("click", function () { load({ silent: true }); });

  // Refresh whenever the page comes back to the foreground (PWA app-switch,
  // back button from a detail page via bfcache, tab focus).
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") load({ silent: true });
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) load({ silent: true });
  });

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
<title>${escapeHtml(name)}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f2f2f7;
    --card: #ffffff;
    --primary: #000;
    --secondary: #6e6e73;
    --separator: #e5e5ea;
    --accent: #007aff;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #000; --card: #1c1c1e; --primary: #fff; --secondary: #98989f; --separator: #38383a; }
  }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--primary); font: -apple-system-body, system-ui, sans-serif; }
  body { display: flex; flex-direction: column; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
  header {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px;
    background: var(--card);
    border-bottom: 0.5px solid var(--separator);
    position: sticky; top: 0; z-index: 1;
  }
  header a.back {
    color: var(--accent);
    text-decoration: none;
    font-size: 17px;
    display: inline-flex; align-items: center; gap: 2px;
  }
  header .title {
    font-size: 17px; font-weight: 600;
    flex: 1; text-align: center;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  header .refresh {
    appearance: none; background: none; border: none;
    color: var(--accent); padding: 4px 8px; cursor: pointer;
    font-size: 0;
  }
  header .refresh.spin svg { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  header .refresh svg { width: 20px; height: 20px; display: block; }
  iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background: var(--bg);
  }
  .err {
    padding: 60px 24px;
    color: var(--secondary);
    text-align: center;
  }
</style>
</head>
<body>
<header>
  <a href="/" class="back">‹ Artifacts</a>
  <div class="title">${escapeHtml(name)}</div>
  <button id="refresh" class="refresh" aria-label="Refresh">
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
  function buildSrc() {
    // Cache-buster on every reload so the polyfill + new HTML are fetched fresh.
    return "/artifacts/" + encodeURIComponent(ARTIFACT_ID) + "/html?key=" +
           encodeURIComponent(key) + "&_=" + Date.now();
  }
  function reload() {
    refreshBtn.classList.add("spin");
    frame.src = buildSrc();
  }
  frame.addEventListener("load", function () {
    refreshBtn.classList.remove("spin");
  });
  refreshBtn.addEventListener("click", reload);
  frame.src = buildSrc();
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
  background_color: "#f2f2f7",
  theme_color: "#f2f2f7",
  icons: [
    { src: "/icon.png", sizes: "180x180", type: "image/png" },
  ],
});

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
          .send(`<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font:16px system-ui;padding:40px">Artifact not found. <a href="/">Back</a></p>`);
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
};
