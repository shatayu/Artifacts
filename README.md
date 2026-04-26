# Artifacts

PWA + sync daemon that mirrors your pinned Claude Cowork artifacts onto any device with a browser, with live data.

## How it works

```
Mac (Cowork)                 Render                     iPhone Safari
┌──────────────┐           ┌─────────────────┐       ┌──────────────┐
│ artifacts.json│  every   │ artifacts-api   │  GET  │  PWA list    │
│ audit.jsonl   │ ──60s──▶ │  (Fastify)      │ ◀──── │  + iframe    │
│              │   POST   │   ↓ pg pools    │       │   shell that │
│ Sync daemon  │          │  artifacts (rw) │       │   loads      │
│ (launchd)    │          │  hamster   (ro) │◀──────│  /artifacts/ │
└──────────────┘          └─────────────────┘       │   :id/html   │
                                                    │  via fetch+  │
                                                    │  cowork      │
                                                    │  polyfill    │
                                                    └──────────────┘
```

- **`server/`** — Fastify API on Render. Stores artifact metadata + HTML in its own Postgres; proxies SQL queries to your existing hamster-db (read-only). Also serves the PWA shell pages and an injected `window.cowork.callMcpTool` polyfill so artifacts run as-is in the browser.
- **`sync-daemon/`** — Node process running on your Mac via launchd. Polls Claude's local files every 60s, uploads pinned artifacts to the API.
- **`ios.archived/`** — Original SwiftUI app. Kept for reference; not in active use.

## Quick start (local)

```bash
# 1. Server
cd server
cp .env.example .env   # fill in DB URLs + API_KEY
npm install
npm run migrate        # runs migrations/001_init.sql
npm run dev            # starts on http://localhost:3000

# 2. Sync daemon (one-shot)
cd ../sync-daemon
cp .env.example .env   # point API_BASE_URL at http://localhost:3000
npm install
npm run sync:once

# 3. Open the PWA in your browser
open "http://localhost:3000/?key=<YOUR_API_KEY>"
```

The `?key=` query param is read by the page's JS, saved to `localStorage`, and stripped from the URL. Subsequent visits don't need it.

## Generate an API key

```bash
openssl rand -hex 32
```

Use this same key in:
- `server/.env` → `API_KEY`
- `sync-daemon/.env` → `API_KEY`
- The first PWA visit: `https://your-host/?key=<KEY>`

## Auth

The server accepts the API key three ways (any one is sufficient):

| Source | Used by |
|--------|---------|
| `Authorization: Bearer <KEY>` header | `sync-daemon`, ad-hoc curl |
| `X-API-Key: <KEY>` header | external integrations |
| `?key=<KEY>` query param | the PWA on first visit |

After the first PWA visit, the key lives in `localStorage` and the browser sends it as a Bearer header on all `fetch` calls; the iframe carries it forward as a query param so the artifact shell can authenticate inside its own scope.

## Deploy to Render

1. Push to GitHub.
2. Render dashboard → "New" → "Blueprint" → connect this repo.
3. Render reads `render.yaml` and creates the web service + Postgres.
4. Set `API_KEY` and `HAMSTER_DB_URL` env vars on the web service in the dashboard. (`ARTIFACTS_DB_URL` is auto-injected by the Blueprint.)

## Add to Home Screen (iPhone)

1. Open Safari on the iPhone, navigate to `https://artifacts-api-x7fu.onrender.com/?key=<KEY>` (replace with your URL + key).
2. Wait for the list to load — confirms the key was stored.
3. Tap the share sheet → "Add to Home Screen" → name it "Artifacts" → Add.
4. Launch from the home-screen icon. Opens full-screen, no Safari chrome.

The icon is a placeholder (blue background + bold "A"). Regenerate it via `cd server && npx tsx scripts/gen-icon.ts` if you want to tweak; replace `server/scripts/gen-icon.ts` for a custom design.

## Install daemon as launchd LaunchAgent

```bash
cd sync-daemon
./install.sh
launchctl list | grep artifacts   # confirm it's running
tail -f ~/Library/Logs/Artifacts/sync.log
```

Stop with: `launchctl unload ~/Library/LaunchAgents/com.shatayu.artifacts-sync.plist`

## Routes

| Route | Auth | Notes |
|-------|------|-------|
| `GET  /` | none (page) | PWA list; soaks `?key=` into localStorage. |
| `GET  /artifact/:id` | none (page) | Shell page with header + full-bleed iframe. |
| `GET  /manifest.webmanifest` | none | PWA manifest. |
| `GET  /icon.png` | none | apple-touch-icon. |
| `GET  /healthz` | none | Render health check. |
| `GET  /artifacts` | required | Returns `[{id, name, description, version_ts}]` for pinned artifacts. |
| `GET  /artifacts/:id/html` | required | Raw artifact HTML, prefixed with the cowork polyfill. |
| `POST /artifacts/:id/query` | required | Body `{sql}` — runs through `sql-safety.ts`, executes on hamster-db. |
| `POST /artifacts/sync` | required | Daemon-only. Upserts pinned artifacts, soft-deletes the rest. |
