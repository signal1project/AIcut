# AICut — Agent Handoff

**Updated:** 2026-06-26 (Mick / ClaudeClaw)
**Status:** Editor working, packaged, committed. GUI redesigned to CapCut quality. Agent bridge + onboarding live. Two items wait on Dale.

---

## What AICut Is
AI-powered desktop video editor (CapCut-style) on an Electron 33 + React 18 + Vite + TypeScript + Zustand + Tailwind 4 + fluent-ffmpeg stack. Forked from Social-Engine-Phase-A.

- **Repo:** `C:\home\dalebrown138\projects\Social-Engine-AICut` (Windows-native shared folder; WSL view `/mnt/c/home/dalebrown138/projects/`). NOT in WSL `~/`.
- **MCP wrapper repo:** `C:\home\dalebrown138\projects\Social-Engine-AICut-Hermes`
- **Commits:** AICut `4a2a0e0`, `b122c68` (package script). AICut-Hermes `472c07f`.

## How to Run
```powershell
# Dev (Vite + Electron, hot reload):
cd C:\home\dalebrown138\projects\Social-Engine-AICut
npm run dev            # use `dev`, NOT dev:mac — adds chcp 65001 UTF-8 fix

# Packaged app (runnable exe, no installer):
npm run package:win    # → release\AICut-win32-x64\AICut.exe
```
Desktop shortcut `AICut.lnk` already points at the packaged exe.
**Browser preview for fast UI iteration:** dev server serves on http://localhost:5173 (renders without Electron; IPC-dependent features no-op via the safe `src/lib/ipc.ts` stub).

## One-Time Setup Gotchas
- After `npm install`, run **`npm run rebuild`** once (electron-rebuild better-sqlite3 for Electron's ABI) or the onboarding DB fails to init in dev. `npm run package:win` / `build` handle this via postinstall.
- Native modules built for **Windows node** — the repo must stay on the Windows path, not WSL `~/`.

## What's Done This Session
1. **Relocated** WSL → Windows shared folder (was violating the 6/19 canonical-path rule).
2. **Blank screen FIXED** — root cause was `WindowControlButtons` calling `window.ipcRenderer.invoke` unguarded; with no preload the whole tree threw → ErrorBoundary blanked it. Fix: `src/lib/ipc.ts` safe accessor (real bridge in Electron, no-op stub in browser). Editor now renders in both.
3. **CapCut GUI redesign** — graphite palette + blue accent (`src/index.css`), left tool-rail (Media/Audio/Text/Effects/AI/Accounts), gradient-clip timeline w/ video thumbnails + audio waveform, polished toolbar/preview/properties.
4. **Agent bridge** — headless REST API on `127.0.0.1:4255` (bearer auth, loopback). `electron/main/aicuts/agentApi.ts` (probe/thumbnail/auto-edit/captions/export, explicit paths). Started by `startAgentBridge()` in `electron/main/index.ts`. Discovery file `%APPDATA%\aicuts\aicut-bridge.json` (url+token+pid). Tested: authed 200, unauthed 401.
5. **MCP wrapper** — `Social-Engine-AICut-Hermes/index.mjs` (stdio MCP, 6 tools). Verified end-to-end with `test-client.mjs`.
6. **Social onboarding** — `src/views/onboarding/ConnectAccounts.tsx`, OAuth-only modal for 8 platforms, reachable via the "Accounts" tool-rail button. Backend `startOnboardingBackend()` in index.ts = DB init + `registerMasIpc` only (guarded, NOT the full publish runtime). DB at `%APPDATA%\aicuts\database.sqlite`.
7. **Desktop icon + packaging** — `launch-aicut.vbs`, `AICut.lnk`; `npm run package:win` (electron-packager, signing-free) → working `AICut.exe`.

## Architecture Quick Map
```
Renderer (React)  ──IPC──>  Electron main (electron/main/)
  src/views/editor/*           aicuts/  (ffmpegOps, autoEdit, agentApi)
  src/views/onboarding/        mas/ipc  (OAuth onboarding)
  src/store/editorStore.ts     server/  (Express, startApiServer)
  src/lib/ipc.ts (safe IPC)    index.ts (startAgentBridge + startOnboardingBackend)

Agents ──HTTP+token──> :4255 REST bridge ──> aicuts ops
MCP clients ──stdio──> AICut-Hermes/index.mjs ──> :4255
```

## OPEN — Waits on Dale (not unfinished code)
1. **Live social connections** — register an OAuth app per platform (Meta/X/LinkedIn/etc.) and paste each client ID into the Accounts modal. Only Dale can (requires logging into each dev portal). The flow + token storage is built.
2. **electron-builder NSIS installer** (optional) — `npm run build` fails on Windows: winCodeSign 7z extraction needs symlink privilege (admin/Developer Mode). Workaround already in place = `npm run package:win`. For a true installer, Dale enables Developer Mode or runs the build elevated.
3. **Omobono bridge — DROPPED per Dale (2026-06-26).** Dale will have Omobono discover/use the REST bridge itself (discovery file has url+token). Do NOT edit `~/.hermes/profiles/omobono/` — that's the HermesClaw sphere. Reference snippet lives in `Social-Engine-AICut-Hermes/README.md`.

## Remaining Build-Out (future, not blocking)
- Export smoke test (needs a real video file): import → timeline → export MP4.
- Auto-Edit runtime auth (Claude via OAuth per Dale's no-API-keys rule).
- Whisper captions (nodejs-whisper or HTTP API).
- Undo/redo (store scaffolding exists, not wired).
```
```
