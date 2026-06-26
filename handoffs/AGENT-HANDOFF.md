# Social Engine Phase A — Agent Handoff
**Last updated:** 2026-06-06
**Written by:** Mick / ClaudeClaw
**Status: CLEARED FOR INTERNAL BETA**

---

## What this project is

Master AI Social (Social-Engine-Phase-A) is the US-focused Electron desktop social media manager. It is the shared core app that two downstream projects extend:

- `Social-Engine-Hermes` — adds an MCP server so Hermes Agent can drive it autonomously
- `Social-Engine-BLK-INK` — adds the BLK INK real estate lead-gen workflow (not yet built out)

Stack: Electron 33 + React 18 + Vite + TypeScript + TypeORM + better-sqlite3.

---

## What Mick verified on 2026-06-06

Ran full independent verification (not rubber-stamped from Philaretos' output):

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ Clean |
| `npm test` | ✅ 182 passed, 5 skipped (SQLite schema tests — expected skip in non-Electron env) |
| `npm run build:notsc` | ✅ Linux Electron package built |
| `xvfb-run -a node scripts/omobono-electron-smoke.cjs` | ✅ All checks pass |

Omobono smoke test output:
```json
{
  "hasOmobono": true,
  "hasApprovalQueue": true,
  "hasCapCut": true,
  "hasAdapters": true,
  "directCreateStatus": 200,
  "directCreateHasPersisted": true,
  "latestPackageStatus": "needs_approval",
  "errors": []
}
```

---

## What was built (Phase A scope — complete)

1. **Omobono Social Engine workflow** — trend research → platform strategy → content variants → CapCut package → approval plan. Route: `/mas/omobono`.
2. **Campaign package persistence** — `CampaignPackageModel` entity via TypeORM. All 5 statuses work: `needs_approval`, `approved`, `scheduled`, `published`, `rejected`.
3. **Approval queue UI** — `OmobonoPage.tsx` shows queue, approve button, mark-published button.
4. **Publishing feedback loop** — `recordPublicationFeedback()` captures platform, externalPostId, publishedAt, notes, analyticsStatus (starts as `pending_capture`).
5. **Trend intelligence** — Google Trends RSS + 5 platform fetchers (TikTok, Instagram, YouTube, X, Rumble) via Google News RSS. No API keys required.
6. **Deterministic fallback copy** — works without any AI provider configured (`provider: 'omobono_fallback'`).
7. **White-label adapter boundary** — agent registry pattern; Hermes is the default adapter, others can be registered without changing workflow code.

---

## Known limitations / future work

- **CapCut manifest is in-memory only** — no real `.capcut` project file is written to disk. Windows desktop import validation was explicitly excluded by Dale. Scenes and manifest are planning artifacts only for now.
- **`synchronize: true` in DataSource** — auto-migrates on startup. Fine for Phase A desktop app. Switch to explicit migrations before any schema-critical Phase B work.
- **Analytics capture is `pending_capture`** — the feedback loop records the flag but no analytics polling/capture is implemented yet.
- **No Windows build verified** — all builds run on Linux (WSL). Windows Electron build not tested.

---

## Social-Engine-Hermes (MCP bridge) — also cleared

Repo: `/home/dalebrown138/projects/Social-Engine-Hermes`

- 21 tests pass, TypeScript clean, build clean.
- Exposes 15 MCP tools: 5 publish, 4 content (includes `list_agent_adapters` + `create_campaign_package`), 4 engagement, 2 analytics.
- MCP server runs at `http://localhost:4242/mcp` (configurable).
- Auth: `x-api-key` header; health endpoint exempt.
- **Bug fixed on 2026-06-06 (commit `aede05a`):** `saveSettings()` had a recursive infinite loop when the config file was missing. Fixed by inlining the file read with try/catch.

---

## Next recommended actions for any agent picking this up

1. **Internal beta** — Dale should run the Windows Electron build and smoke-test the Omobono UI manually on his machine.
2. **BLK INK downstream** — `Social-Engine-BLK-INK` exists as a scaffold. It needs the BLK INK real estate lead-gen workflow added on top of this Phase A core. See `AGENT-HANDOFF.md` in that repo when it exists.
3. **Analytics capture** — build a polling/webhook mechanism to fill in the `pending_capture` analytics records.
4. **Platform OAuth** — no real social platform accounts are connected yet. Phase B needs the OAuth flow tested against live Facebook/Instagram/YouTube credentials.

---

## Key file map

```
electron/main/workflow/workflowService.ts     — Omobono campaign package assembly
electron/main/workflow/types.ts               — All workflow types/interfaces
electron/main/research/platformTrendFetcher.ts — Google News RSS trend fetcher
electron/main/mas/runtime.ts                  — Composition root (wires all services)
electron/db/models/mas/campaignPackage.ts     — TypeORM entity
src/views/mas/OmobonoPage.tsx                 — UI
scripts/omobono-electron-smoke.cjs            — Smoke test
```
