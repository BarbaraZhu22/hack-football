# Football Desk — Product & Engineering Requirements

This document is the single source of truth for scope, architecture, and contribution rules for the Football Desk hackathon app. **All project documentation for this product must be written in English.**

---

## 1. Goals

Football Desk is a web workspace for a football-themed experience with

- A persistent **shell** (logo, navigation, theme switch, agent chat).
- Three **tabs**: Pitch (3D), Match (live desk data), Tactics (overlays and commands).
- A **shared agent chat** available on every tab.
- A **Three.js pitch** driven by a stable **scene command API** (not direct Three access from pages).
- A **Python agent service** in this repo; Microsoft Agent integration lives only in that service.

---

## 2. Non‑negotiable rules

### 2.1 Documentation language

- All docs, comments intended for contributors, README sections, and API contract descriptions for Football Desk **must be in English**.
- User-facing UI copy may be localized later; default product copy is English.

### 2.2 Frozen `apps/web` directory structure

**Do not rename, move, or delete the top-level folders and files listed below.** Do not introduce new sibling roots under `apps/web` (for example, no new `features/`, `modules/`, or `pages/` tree).

Allowed changes **inside** the frozen tree:

- Add or edit files within existing folders.
- Add new files under `components/pitch/`, `components/match/`, or `components/tactics/` for page-specific UI.
- Add atoms under `components/ui/` following shadcn / AI Elements patterns.
- Extend `app/globals.css` and theme tokens; add small co-located CSS only when Tailwind tokens are insufficient (see §2.3).

**Canonical layout (must remain):**

```text
apps/web/
  app/
    layout.js
    page.js
    globals.css
    (desk)/
      layout.js
      pitch/page.js
      match/page.js
      tactics/page.js
    api/
      chat/route.js
      match/route.js
  public/
    models/
      body/               # character mesh + LICENSE-*.txt, README.md
      clips/              # one .glb per action (see §2.5)
  components/
    ui/                 # Atomic UI (shadcn + chat primitives)
    theme/              # ThemeProvider
    layout/             # DeskLayout (single app shell)
    chat/               # AgentChat (shared across tabs)
    three/              # WebGL / R3F (see §2.5)
      actions/          # catalog.js, retarget.js, pose.js
    pitch/              # Pitch tab UI only
    match/              # Match tab UI only
    tactics/            # Tactics tab UI only
  lib/
    utils.js
    themes.js
    agent-client.js
    scene/
      SceneProvider.jsx
      commands.js
  components.json
  jsconfig.json
  postcss.config.mjs
  next.config.js
  package.json
```

Route URLs stay: `/pitch`, `/match`, `/tactics`. Root `/` redirects to `/pitch`.

### 2.3 CSS vs components

When adding UI or behavior:

1. **Prefer Tailwind + CSS variables** in `app/globals.css` for colors, radii, and theme skins (`html[data-theme]`).
2. **Put reusable markup in components**, not in route files. Route `page.js` files only mount the tab root component.
3. **Do not** add large inline `style={{}}` blocks or duplicate color hex values in JSX; use semantic tokens (`bg-background`, `text-primary`, etc.).
4. If a tab needs layout-only styling that does not belong in globals, add a **small module** next to the tab component (for example `components/pitch/pitch.module.css`) rather than bloating `globals.css`—but keep theme colors in globals.
5. **Three.js scene colors** inside `PitchCanvas` may use literal colors for pitch grass and ball; app chrome must use theme tokens.

### 2.4 Component ownership by folder

| Location | Owns |
|----------|------|
| `components/pitch/` | Pitch tab UI, including viewport chrome (`ViewportChrome`, minimap, co-located CSS). |
| `components/match/` | Everything UI-specific to the Match tab. |
| `components/tactics/` | Everything UI-specific to the Tactics tab. |
| `components/three/` | WebGL / R3F rendering only; subscribes to `lib/scene` state. |
| `components/chat/` | Shared agent chat (all tabs). |
| `components/layout/` | `DeskLayout` only: logo, tab links, theme switch, chat slot. |
| `components/ui/` | Atoms: buttons, cards, conversation, message, prompt-input, etc. |
| `components/theme/` | Theme provider and theme context. |
| `lib/scene/` | Scene state and command reducer; **no** Three imports. |

**Principle:** Except for **`three/`** and **`chat/`**, tab-specific components live under that tab’s folder. Shared shell pieces live in **`layout/`**; shared atoms in **`ui/`**.

### 2.5 Character actions and assets (`components/three/`)

Backend (or simulation) supplies an **action name** (for example `run`, `slide`, `carry`). Only [`components/three/actions/catalog.js`](apps/web/components/three/actions/catalog.js) maps that name to playback:

| Catalog entry | Meaning |
|---------------|---------|
| `{ kind: "clip", url: "..." }` | Load the `.glb` from `public/models/clips/` (URL `/models/clips/...`) and play it via `actions/retarget.js`. |
| `{ kind: "pose", pose: "..." }` | No clip yet; apply procedural pose via `actions/pose.js`. |

Rules:

- **Canonical asset root:** `public/models/` only. Next.js serves these at `/models/...`; Three.js loaders and [`actions/catalog.js`](apps/web/components/three/actions/catalog.js) use those URLs. Do **not** duplicate meshes under `components/three/`. There is no `/api/models` route.
- **One clip file per action** under `public/models/clips/`. Do not put JavaScript inside `public/models/`.
- **Character body mesh** lives under `public/models/body/` (include `LICENSE-CHARACTERS.txt`, `LICENSE-ANIMATIONS.txt`, and `README.md` for provenance).
- **Adding an action** = one catalog row + optional new clip file in `public/models/clips/`. Do not add a new React component per action.
- **`kit.js`** stays at `components/three/kit.js` (jersey colours, not actions).
- Viewport chrome lives under `components/pitch/` (DOM overlay, not part of the WebGL action pipeline).

---

## 3. Shell & navigation

- **One shell component:** `DeskLayout.jsx` (logo, three tab links, skin dropdown, main content slot, agent chat).
- **Desktop:** main content left, chat right (~360px).
- **Mobile:** chat in a bottom collapsible panel.
- **Tabs:** Pitch, Match, Tactics — implemented as App Router routes, not client-only fake tabs.

---

## 4. Themes (skins)

Three skins, switched via `html[data-theme]` and persisted in `localStorage` key `football-theme`:

| Id | Description |
|----|-------------|
| `miami` | Default — pink primary, blue accent |
| `pitch` | Dark — black/near-black background, grass green primary |
| `classic` | Light — white background, red primary |

Implementation: CSS variables in `globals.css`; labels and ids in `lib/themes.js`. Skin switch UI lives in `DeskLayout` only.

---

## 5. Agent & backend

### 5.1 Call chain

Browser → Next.js `POST /api/chat` → FastAPI (`AGENT_URL`, server-side only) → Microsoft agent adapter.

The Match overview loads its initial data from `GET /api/match` and live updates from `GET /api/match/stream` (Server-Sent Events). The routes use the CSV mock by default and proxy to configured match-data endpoints when `MATCH_API_URL` and `MATCH_STREAM_API_URL` are set.

### 5.2 Contract

Shared contract: [`contracts/agent.json`](contracts/agent.json).

**Chat request:**

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": { "tab": "pitch" }
}
```

**Chat response:**

```json
{
  "message": { "role": "assistant", "content": "..." },
  "actions": []
}
```

- **`context.tab`:** `pitch` | `match` | `tactics`.
- **`actions`:** scene commands (see §6); applied in the client via `useScene().run(actions)`.

### 5.3 Microsoft Agent

- Only [`apps/agent/providers/microsoft.py`](apps/agent/providers/microsoft.py) may import or call Microsoft Agent SDK / Foundry.
- Web app uses [`lib/agent-client.js`](apps/web/lib/agent-client.js); no SDK in the browser.
- Placeholder responses are acceptable until credentials and SDK are wired.

---

## 6. Scene command API

State and commands: `lib/scene/SceneProvider.jsx` + `lib/scene/commands.js`.

Supported action types (extending the list requires updating `contracts/agent.json` and `commands.js` together):

| Type | Purpose |
|------|---------|
| `camera.set` | `position`, `lookAt` |
| `players.set` | Array of `{ id, team, position }` |
| `ball.set` | Ball position |
| `arrow.add` / `arrow.clear` | Tactics arrows |
| `highlight` | Player or zone highlight |
| `reset` | Restore initial scene |

**Rules:**

- Pages and chat call `useScene().run(actions)` only.
- `PitchCanvas` reads scene state; it does not export Three.js objects.
- Scene state survives leaving the Pitch tab; returning to Pitch replays from store.

---

## 7. Tab responsibilities

### Pitch

- Host 3D pitch via dynamic import of `PitchCanvas` (no SSR on canvas).
- Show pitch-specific chrome (title, stats) in `components/pitch/`.

### Match

- Load its initial snapshot via `/api/match` and live updates via `/api/match/stream`.
- Match-specific cards and lists in `components/match/`.

### Tactics

- Tactics controls and copy in `components/tactics/`.
- May dispatch scene commands (arrows, highlights); agent may send the same commands.

---

## 8. Atomic UI stack

- **shadcn-style** components in `components/ui/` (New York style, CSS variables).
- **Chat appearance:** `conversation`, `message`, `prompt-input` in `components/ui/`.
- **Do not** use Vercel AI SDK `useChat` for transport; use `agent-client.js` + FastAPI.

When adding a new atom, place it under `components/ui/` and compose it from tab or layout components.

---

## 9. Environment & run

| Variable | Where | Purpose |
|----------|--------|---------|
| `AGENT_URL` | Next.js server | Base URL for FastAPI chat (default `http://127.0.0.1:8088`) |
| `MATCH_API_URL` | Next.js server | Full URL for the match snapshot API; omit to use the local CSV mock |
| `MATCH_STREAM_API_URL` | Next.js server | Full URL for the match SSE endpoint; configure with `MATCH_API_URL` for real live data |
| `MOCK_MATCH_TICK_MS` | Next.js server | Local mock replay interval in milliseconds (default `1000`) |
| `FOUNDRY_PROJECT_ENDPOINT` | `apps/agent` (local `.env` or Container App env) | Foundry **Project endpoint** from the portal (`.../api/projects/...`) |
| `FOUNDRY_API_KEY` | `apps/agent` (optional but recommended on Container Apps) | Project **API key** from the same portal page; when set, no browser/`az login` |
| `FOUNDRY_MODEL` | `apps/agent` | Deployment name (e.g. `DeepSeek-V4.1-Flash`) |

```bash
# Agent
cd apps/agent && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8088

# Web
cd apps/web && npm run dev
```

---

## 10. Definition of done (incremental work)

For any feature PR:

1. Respects frozen `apps/web` tree (§2.2).
2. Tab UI lives under the correct tab folder (§2.4).
3. Styling uses theme tokens / Tailwind; no ad-hoc palette in JSX (§2.3).
4. Agent or scene changes update `contracts/agent.json` when the wire format changes.
5. Docs and code comments for the change are in English (§2.1).
6. `npm run build` in `apps/web` succeeds.

---

## 11. Related artifacts

- Architecture plan (implementation checklist): `.cursor/plans/football_desk_architecture_*.plan.md` (reference only; do not treat as runtime config).
- Agent integration notes (separate doc): [`agent-framework.md`](agent-framework.md) — Microsoft Agent Framework; wire Python adapter when ready.
