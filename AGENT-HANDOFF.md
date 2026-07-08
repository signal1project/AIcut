# AICut — Agent Handoff

**Updated:** 2026-07-07 (Mick / ClaudeClaw) — v0.6
**Status:** ✅ 235 tests pass · tsc clean · vite build clean · v0.6 pushed to `main` (`f6c625b`)
**Read this FIRST before touching the repo.**

---

## What AICut Is

AI-powered desktop video editor + social media automation suite (CapCut competitor with a
Buffer/Opus-Clip feature set bolted on), leaning real-estate. Fully local-first: FFmpeg,
SQLite, and Windows SAPI TTS run on the user's machine; AI provider keys are optional and
most features degrade gracefully without them.

- **Stack:** Electron 33 + React 18 + Vite + TypeScript + Zustand + Tailwind + TypeORM
  (better-sqlite3) + fluent-ffmpeg + express (embedded APIs) + vitest.
- **Repo:** `C:\home\dalebrown138\projects\Social-Engine-AICut` (Windows-native shared
  folder — NOT WSL `~/`). GitHub: `signal1project/AIcut`, branch `main`.
- **Local branch quirk:** work happens on `push-v4-2`; push with
  `git push origin push-v4-2:main` (fast-forward).
- **MCP wrapper repo (Hermes team's):** `Social-Engine-AICut-Hermes` (sibling folder).
- **Naming rule (Dale, 2026-07-07):** "AICut" = this repo ONLY. The archived
  `_archive\BLK-INK-Scraper` is reference-only; never build there.

## How to Run / Verify

```powershell
cd C:\home\dalebrown138\projects\Social-Engine-AICut
npm run dev          # dev app (use `dev`, NOT dev:mac — has chcp 65001 fix)
npm test             # vitest — 235 pass, 10 skip (Electron-ABI, see below)
npx tsc --noEmit     # typecheck
npx vite build       # renderer + main + preload bundles
npm run build:ext    # Chrome extension → dist-ext/
npm run package:win  # → release\AICut-win32-x64\AICut.exe
```

**Gotchas**
- After fresh `npm install`, run `npm run rebuild` (better-sqlite3 → Electron ABI).
- DB tests (`masSchema`, `listingStore`) auto-skip under plain Node — that ABI mismatch is
  expected, not a failure. Follow the `describe.skipIf(!nativeLoads)` pattern for new
  DB-touching tests.
- Windows paths only; repo must stay on the Windows filesystem.

## Runtime Topology (three embedded servers, all loopback)

| Server | Port | Auth | Purpose |
|---|---|---|---|
| MAS API | ephemeral | rotating bearer token | Everything under `/api/*` — publish, content, analytics, engagement, research, listings, clips, insights. Renderer gets url+token via IPC `mas:api-info`. **Discovery file (with token): `%APPDATA%\aicuts\api-port.json`** — local agents use this. |
| Listing capture server | **7474** (`AICUT_CAPTURE_PORT`) | none (loopback+CORS) | Chrome-extension listing capture ONLY (`/api/listings/*` minus ad/video generation). Port inherited from retired BLK INK Scraper. |
| Agent bridge | **4255** (`AICUT_BRIDGE_PORT`) | bearer | Video-editor ops for MCP agents (`/api/aicut/*`). Discovery: `%APPDATA%\aicuts\aicut-bridge.json`. |

Generated artifacts: `%APPDATA%\aicuts\{listing-reels, clips, bio-page}\`. DB:
`%APPDATA%\aicuts\database.sqlite` (TypeORM `synchronize:true` — new entities in
`electron/db/index.ts` entities array auto-create tables).

## Feature Map (v0.6) — module → API → UI

| Feature | Backend module | API | UI |
|---|---|---|---|
| Video editor (timeline/speed/fades/export) | `electron/main/aicuts/` | bridge :4255 | `/editor` |
| AI Auto-Edit + Auto-Captions | `aicuts/autoEdit.ts` | IPC | editor AI panel |
| **Auto-Clip** (long video → captioned vertical shorts) | `electron/main/clips/` | `POST /api/clips/auto` | editor AI panel card |
| Publish / schedule (8 platforms, webview + OAuth) | `publishEngine/`, `adapters/`, `scheduling/` | `POST /api/publish` | `/mas/publish`, `/mas/scheduler` |
| AI content (posts, **A/B variants**, **carousels**, images) | `content/` | `POST /api/content/{generate,carousel,image}` | `/mas/content` |
| **Brand Kit** (voice rules injected into every brief) | `settings/settings.ts` | IPC `mas:settings:{get,set}-brand-kit` | `/mas/brand` |
| Idea Scraper + trending research | `research/` | `GET /api/research/{scrape,trending}` | `/mas/research` |
| **Listing Scraper** (Chrome ext + paste-URL capture) | `listings/` | `POST /api/listings/capture`, `/capture-url` | `/mas/listings` + `chrome-extension/` |
| **Generate Listing Ad** (compliance-gated copy) | `listings/adService.ts` | `POST /api/listings/:id/generate-ad` | Listings page button |
| **Listing Video Generator** (photos → narrated reel) | `listings/videoService.ts` | `POST /api/listings/:id/generate-video` | "Create Reel" button |
| Fair Housing / RESPA guard | `listings/complianceGuard.ts` | runs at capture + on all listing-ad output | shield badges |
| **Best-time-to-post / calendar / evergreen recycle** | `insights/` | `GET /api/insights/{best-times,calendar}`, `POST /recycle` | Scheduler page |
| **Competitor benchmarks** (manual snapshots) | `insights/router.ts` + settings | `/api/insights/competitors` CRUD | Analytics page |
| **Bio page generator** (static HTML export) | `insights/bioPage.ts` | `POST /api/insights/bio-page` | Brand page |
| Inbox (comments + AI reply drafts) | `engagement/` | `/api/engagement/*` | `/mas/engagement` |
| Analytics snapshots | `analytics/` | `/api/analytics/*` | `/mas/analytics` |
| Bulk CSV scheduling | client-side | (uses `/api/publish`) | Scheduler page |
| Omobono workflow packages | `workflow/`, `capcut/` | `/api/workflow/*` | `/mas/pipeline`, `/mas/omobono` |

**Composition root:** `electron/main/mas/runtime.ts` — every service is wired there and
mounted as a `FeatureRoute`. Add new features as sibling modules
(`service + router + index + __tests__`) and register in runtime.

## What Needs Keys vs. What Works Keyless

- **Keyless:** editor, listing capture (ext + URL), compliance guard, template listing ads,
  listing reels **with narration** (Windows SAPI), auto-clip with pasted SRT/VTT
  (heuristic picking), best-times, calendar, recycle, CSV import, bio page, competitors,
  brand kit storage, Idea Scraper.
- **AI provider (Settings/onboarding — OpenRouter OAuth or Ollama local both keyless-ish):**
  AI post generation, A/B variants, carousels, AI-quality listing ads, AI clip picking,
  AI auto-edit/captions.
- **OpenAI key specifically:** Whisper transcription (auto-clip without a transcript),
  image generation.
- **Per-platform OAuth apps (Dale registers at dev portals):** API publishing, analytics
  capture, engagement ingest. Webview login (`adapters/webviewBridge.ts`) works without.

## Legal / Non-Negotiables

- **Fair Housing Act + RESPA guard** (`listings/complianceGuard.ts`) runs on captured
  listing descriptions and ALL generated listing-ad copy. Blocked copy is returned but
  flagged `complianceOk:false` — UI marks it "blocked — do not publish". NEVER remove or
  bypass this gate; extend patterns instead (tests in `__tests__/complianceGuard.test.ts`).
- Ad/video generation endpoints live ONLY on the authed MAS API — never expose them on the
  open :7474 capture server (unauthenticated AI-credit burn).

## Docs Index

- `docs/USER-GUIDE.md` — end-user onboarding, step by step (keep updated with features).
- `OMOBONO-HANDOFF.md` — agent-integration surface for the Hermes team.
- `HANDOFF.md` — older session notes (historical).
- Mick's session memory: `C:\ClaudeClaw\.memory\{active-tasks,decisions-log}.md`.

## Open Items / Roadmap

1. **"Publish Reel" shortcut** — generated reel → Scheduler prefilled (next natural step).
2. Whisper local fallback (whisper.cpp) so auto-clip transcription is fully keyless.
3. Remove Background + Voice Studio (ElevenLabs) — editor AI panel stubs.
4. Platform OAuth app registration — Dale, per dev portal (Meta/X/LinkedIn/etc.).
5. NSIS installer needs admin/Developer Mode (winCodeSign symlink issue); `package:win`
   works today.
6. DM inbox — vendor-gated on messaging scopes for the platform OAuth apps.
7. Undo/redo in the editor (store scaffolding exists, not wired).

## How to Work With Dale

Direct, systems-thinker, automation-first. Verify in the running app before claiming done
(launch `npm run dev`, hit the API with the token from `api-port.json`, probe outputs with
ffprobe). Commit messages: what shipped + what was verified. Push = `push-v4-2:main`.
Flag anything legally sensitive (compliance, platform ToS) before building it.
