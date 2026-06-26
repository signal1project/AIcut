# Master AI Social

US-focused AI social media manager for desktop — **Publish · Engage · Create** across Facebook, Instagram, Twitter/X, Threads, Pinterest, YouTube, TikTok, and LinkedIn.

Forked from the open-source [AiToEarn](https://github.com/yikart/AiToEarn) Electron app, rebuilt US-only with a cleaner architecture. This is the standalone product and the shared core for two downstream apps:

- **Hermes_Social** — adds an MCP server so [Hermes Agent](https://github.com/nousresearch/hermes-agent) can drive it autonomously.
- **BLKINK_Social** — adds the BLK INK real estate lead-gen workflow.

## Stack

- Electron 33 + React 18 + Vite + TypeScript
- TypeORM + better-sqlite3 (local-first)
- Ant Design (UI), Zustand (state)
- p-queue + node-schedule (queue/scheduling), electron-updater (auto-update)
- fluent-ffmpeg + ffmpeg installer (media transcode)
- AI: pluggable OpenAI / Claude / Groq (configured in Settings)

## What was changed from upstream

- Removed all Chinese platforms (Kwai, Douyin, Xhs, WeChat Channels) — browser-automation based
- Removed China API endpoints and npm mirrors
- US platform libs (official APIs) staged at `electron/main/plat/libs/` for porting into the adapter layer
- Credentials move to `electron.safeStorage` (no plaintext, no keytar)

## Monorepo packages

Shared code published to GitHub Packages and consumed by the downstream apps:

| Package | Purpose |
|---------|---------|
| `@mas/types` | Zod schemas, interfaces, platform constants |
| `@mas/server` | Platform adapters, OAuth, AI abstraction, publish pipeline |
| `@mas/ui` | Shared React components + Zustand stores |

## Develop

```bash
npm install
npm run rebuild   # compile better-sqlite3 native addon for Electron
npm run dev
```

> Requires Node 20+. On newer Node, native modules (better-sqlite3, sharp) are rebuilt against Electron's ABI via `npm run rebuild`.

## Status

Under active build — see `tasks/todo.md` in the workspace for progress.
