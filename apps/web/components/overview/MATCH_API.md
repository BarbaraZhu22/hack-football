# Match API and data contract

The overview reads one historical snapshot, then continues through a single server-sent events (SSE) connection. Next.js routes **proxy only** to the Python agent (PostgreSQL). There is **no CSV fallback** and no local match data under `apps/web/data`.

## Time authority (SSOT)

The snapshot and each SSE tick expose **`cursor`** (integer elapsed seconds) and **`clock`** (display object with `seconds`, `label`, `finished`). The client must treat these as the live match time. Do not infer time from local constants, client timers, or optional frame labels.

All snapshot fields are aligned to **`cursor`**: events through `match_ms <= cursor * 1000`, stats/momentum from deduplicated per-second frame metrics, **`frame`** from the shared frame picker at `cursor`, and **`ratings`** from the single `player_ratings` row for that second only.

The Overview UI filters lists with **`timeMilliseconds <= clock.seconds * 1000`**. The header clock advances only when an SSE **`tick`** arrives (not on `EventSource` `open`). **`connection === "live"`** is set on the first tick, not when the stream opens.

If **`frame`** is `null`, **`clock`** and **`cursor`** are still valid; the UI shows the backend clock without inventing a tracking frame.

## Snapshot

`GET /api/match` (optional `?through=78:32`; default live entry from server config) returns match metadata, score, statistics, all events through the cursor, a single **`frame`**, player ratings for the cursor second only, phases, timeline decisions (with `timeMilliseconds` and `sequence`), momentum, players, officials, laws, and precedents. The response does **not** include a `frames[]` array. Successful agent responses include `dataSource.backend: "postgresql"`.

The default live entry is 78:32 (`cursor` 4712). Period lengths: first half 46:00, second half 48:00, full time at 94:00 displayed as 90+3:00.

## Momentum

**Momentum** is a array of floats per two-minute bucket through the cursor. The agent computes it with the same formula as the historical mock: 120s buckets, 300s rolling window, possession and final-third edge from deduplicated frame metrics, event pressure from shots/xG/goals/penalties/corners, then light smoothing.

## Historical precedents

PostgreSQL `precedents` rows power live adjudication comparisons. `GET /api/match/precedents?type=serious_foul_play` returns filtered precedents for the incident panel.

## Events and frames (PostgreSQL)

Events and frames live in PostgreSQL (`events`, `frames`, `player_ratings`, etc.). Referee decisions are events with `decision=true`; VAR and penalty outcomes remain separate events.

## Tracking window

`GET /api/match/tracking?from=77:36.990&through=77:42.010` returns frames in that millisecond window for pitch replay. The agent filters on `match_ms`.

## Live stream

`GET /api/match/stream?after=4712` opens one SSE connection (`after` must match the snapshot **`cursor`**). The server emits `ready`, then one **`tick`** per elapsed second (interval `MATCH_TICK_MS` on the agent, default 1000 ms). Each tick includes `clock`, `frame`, ratings for that second, new events/decisions/phases, and updated **stats** / **momentum** derived from events and deduplicated frame metrics through that second.

## Runtime

| Route | Backend |
|-------|---------|
| `/api/match` | FastAPI → PostgreSQL |
| `/api/match/stream` | FastAPI SSE |
| `/api/match/precedents` | FastAPI → PostgreSQL |
| `/api/match/tracking` | FastAPI → PostgreSQL |

Set `AGENT_URL` on the Next.js server and `DATABASE_URL` on the agent. Client-side requests always use the Next.js `/api/match*` routes.
