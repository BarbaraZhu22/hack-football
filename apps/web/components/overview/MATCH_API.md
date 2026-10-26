# Match API and data contract

The overview reads one historical snapshot, then continues through a single server-sent events (SSE) connection. Next.js routes proxy to the Python agent, which reads PostgreSQL. When the agent is down or returns a server error, the same routes read the CSV tables under `apps/web/data` and replay locally.

## Time authority (SSOT)

The snapshot and each SSE tick expose **`cursor`** (integer elapsed seconds) and **`clock`** (display object with `seconds`, `label`, `finished`). The client must treat these as the live match time. Do not infer time from local constants or from optional frame labels.

All snapshot fields are aligned to **`cursor`**: events through `match_ms <= cursor * 1000`, stats/momentum from deduplicated per-second frame metrics, **`frame`** from the shared frame picker at `cursor`, and **`ratings`** from the single `player_ratings` row for that second only.

If **`frame`** is `null`, **`clock`** and **`cursor`** are still valid; the UI shows the backend clock without inventing a tracking frame.

## Snapshot

`GET /api/match` (optional `?through=78:32`; default live entry from server config) returns match metadata, score, statistics, all events through the cursor, a single **`frame`**, player ratings for the cursor second only, phases, timeline decisions, momentum, players, officials, laws, and precedents. The response does **not** include a `frames[]` array. Successful agent responses include `dataSource.backend: "postgresql"`. CSV fallback uses `"local-csv"`.

The default live entry is 78:32 (`cursor` 4712). Period lengths: first half 46:00, second half 48:00, full time at 94:00 displayed as 90+3:00.

## Historical precedent table

`precedents.csv` is a curated library of historical Premier League incidents for comparison during live adjudication. One row represents one real incident.

Each record keeps the match facts and three decision layers separate: `on_field_decision`, `var_action`, and `final_decision` describe what happened in the match; `assessment_status`, `assessment_authority`, and `assessment_text` describe any published retrospective judgment. Assessment status is `correct`, `incorrect`, `mixed`, `contextual`, or `not_stated`; it is a coarse summary. When a source separately evaluates the referee and VAR, `assessment_text` names both layers, so do not infer that one layer shares the other’s verdict. Use `source_title` and `source_url` to inspect the evidence. `law_edition`, `law_refs`, and retrieval `tags` retain the rules context. The library contains no precomputed similarity score or live-match incident ID; retrieval and relevance scoring belong to the adjudication agent at query time.

`GET /api/match/precedents?type=serious_foul_play` returns filtered precedents for the incident panel. The agent reads PostgreSQL; CSV fallback uses the same query shape on `precedents.csv`.

## Event table

`events.csv` is an action-level event log. Each event has a stable `event_id`, chronological `sequence`, period and absolute timestamps, `frame_id`, `chain_id`, optional `parent_event_id`, event/action/outcome types, participant IDs, explicit referee-decision fields, score state, statistics flags, incident ID, coordinates, and factual commentary/detail.

Every player or official in `participant_ids` is present in the linked frame. `frames.csv` also contains the event IDs recorded at that exact timestamp. A referee decision is recorded only when `decision=true`. VAR review records and penalty attempts/results are separate match events and do not become referee decisions.

## Tracking table

`frames.csv` contains one row per elapsed second (plus dense sub-second samples around incidents). Each frame has a stable ID, period and clock fields, ball position, possession player/team, all players with `active`, `bench`, or `subbed_off` status, the three match officials, and its related `event_ids`.

`GET /api/match/tracking?from=77:36.990&through=77:42.010` returns frames in that millisecond window for pitch replay. The agent filters on `match_ms`; CSV fallback uses the same clock parameters on local frames.

## Player ratings table

`player-ratings.csv` has one row per elapsed second with a JSON array of all player ratings for that second. Ratings link to the corresponding frame and carry per-player status, rating, delta, event IDs, reason, and source.

## Live stream

`GET /api/match/stream?after=4712` opens one SSE connection (`after` must match the snapshot **`cursor`**). It sends one clock tick per second, the frame and all player-rating rows for that second, newly recorded events/decisions/phases, and updated statistics and momentum derived from the current event/frame history.

When the agent serves the stream, ticks come from PostgreSQL. CSV fallback replays `apps/web/data` at `MOCK_MATCH_TICK_MS` (default 1000 ms).

## Runtime

| Route | Primary | Fallback |
|-------|---------|----------|
| `/api/match` | FastAPI → PostgreSQL | Local CSV snapshot |
| `/api/match/stream` | FastAPI SSE | Local CSV replay |
| `/api/match/precedents` | FastAPI → PostgreSQL | Local `precedents.csv` |
| `/api/match/tracking` | FastAPI → PostgreSQL | Local `frames.csv` |

Set `AGENT_URL` on the Next.js server and `DATABASE_URL` on the agent. Client-side requests always use the Next.js `/api/match*` routes.
