# Artifacts

iOS app that mirrors your pinned Claude Cowork artifacts onto your iPhone, with live data.

## How it works

```
Mac (Cowork)                 Render                     iPhone
┌──────────────┐           ┌─────────────────┐       ┌──────────────┐
│ artifacts.json│  every   │ artifacts-api   │  GET  │  Artifacts   │
│ audit.jsonl   │ ──60s──▶ │  (Fastify)      │ ◀──── │   (SwiftUI)  │
│              │   POST   │   ↓ pg pools    │       │   ↓ WKWebView│
│ Sync daemon  │          │  artifacts (rw) │       │              │
│ (launchd)    │          │  hamster   (ro) │◀──────│ POST /query  │
└──────────────┘          └─────────────────┘       └──────────────┘
```

- **`server/`** — Fastify API on Render. Stores artifact metadata + HTML in its own Postgres; proxies SQL queries to your existing hamster-db (read-only).
- **`sync-daemon/`** — Node process running on your Mac via launchd. Polls Claude's local files every 60s, uploads pinned artifacts to the API.
- **`ios/Artifacts/`** — SwiftUI app. Lists pinned artifacts, opens each in a `WKWebView` with a JS bridge so the artifact's existing `window.cowork.callMcpTool` calls turn into authenticated HTTPS calls to the API.

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

# 3. iOS
open ios/Artifacts/Artifacts.xcodeproj
# Set Config-Local.xcconfig API_BASE_URL=http://localhost:3000
# Cmd+R to run on simulator
```

## Generate an API key

```bash
openssl rand -hex 32
```

Use this same key in:
- `server/.env` → `API_KEY`
- `sync-daemon/.env` → `API_KEY`
- `ios/Artifacts/Config-Local.xcconfig` → `API_KEY`

## Deploy to Render

1. Push this repo to GitHub
2. In Render dashboard, click "New" → "Blueprint" → connect this repo
3. Render reads `render.yaml` and creates the web service + Postgres
4. Set `API_KEY` and `HAMSTER_DB_URL` env vars on the web service (Render injects `ARTIFACTS_DB_URL` automatically from the Blueprint)

See `docs/deploy.md` for details (TODO).

## iOS — first time (Xcode walkthrough)

You're new to Swift/Xcode, so here's the click-by-click for getting the app on your iPhone the first time:

1. **Create the Xcode project**
   - Open Xcode
   - File → New → Project
   - Choose **iOS** → **App** → Next
   - Product Name: `Artifacts`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Save it inside `~/Desktop/Projects/Artifacts/ios/`
   - Uncheck "Create Git repository" (we already have one at the root)

2. **Add the Swift source files** (already in `ios/Artifacts/`)
   - In Xcode, right-click the `Artifacts` group in the file navigator → "Add Files to Artifacts…"
   - Select the `Models/`, `Networking/`, `Views/`, `WebView/` folders and `Config-Local.xcconfig`
   - Check "Copy items if needed" → Add

3. **Wire up the xcconfig**
   - Click the project (top of file navigator) → Info tab → Configurations
   - Set both Debug and Release to use `Config-Local` (or `Config-Prod` for prod)

4. **Run on simulator first** (Cmd+R)
5. **Run on your phone:**
   - Plug in your iPhone, unlock it, "Trust this computer"
   - In Xcode, select your iPhone from the device dropdown (top bar)
   - Project → Signing & Capabilities → "Automatically manage signing" → choose your Apple ID
   - Cmd+R to build and install
   - On your iPhone: Settings → General → VPN & Device Management → trust your developer profile
   - Open the Artifacts app

## Install daemon as launchd LaunchAgent

```bash
cd sync-daemon
./install.sh
launchctl list | grep artifacts   # confirm it's running
tail -f ~/Library/Logs/Artifacts/sync.log
```

Stop with: `launchctl unload ~/Library/LaunchAgents/com.shatayu.artifacts-sync.plist`
