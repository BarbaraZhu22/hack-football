# Match API and mock data contract

The CSV tables under `apps/web/data` are the local mock source. The overview reads one historical snapshot, then continues through a single server-sent events (SSE) connection. The mock uses the same response shape expected from the future match API.

## Snapshot

`GET /api/match?through=78:32` returns match metadata, the calculated score and statistics, all events, tracking frames, and player-rating rows up to that absolute match clock, phase rows, timeline decisions, the momentum series, players, officials, laws, and precedents.

The initial clock is 78:32. Since the first half is 46 minutes long, the snapshot includes the full first period and the first 32:32 of the second period. The first half is 45 minutes plus one minute of added time. The second half is 45 minutes plus three minutes of added time. Full time is stored at 94:00 elapsed and displayed as 90+3:00.

## Historical precedent table

`precedents.csv` is a curated library of historical Premier League incidents for comparison during live adjudication. One row represents one real incident. `generate:precedents` rebuilds only this table, without rewriting the live match data.

Each record keeps the match facts and three decision layers separate: `on_field_decision`, `var_action`, and `final_decision` describe what happened in the match; `assessment_status`, `assessment_authority`, and `assessment_text` describe any published retrospective judgment. Assessment status is `correct`, `incorrect`, `mixed`, `contextual`, or `not_stated`; it is a coarse summary. When a source separately evaluates the referee and VAR, `assessment_text` names both layers, so do not infer that one layer shares the other’s verdict. Use `source_title` and `source_url` to inspect the evidence. `law_edition`, `law_refs`, and retrieval `tags` retain the rules context. The library contains no precomputed similarity score or live-match incident ID; retrieval and relevance scoring belong to the adjudication agent at query time.

The web mock reads this CSV and normalizes each record for the API. The Python Agent's PostgreSQL endpoint reads `precedents` with `SELECT *`; this repository currently has no CSV-to-PostgreSQL import step, so the database must be updated separately before that endpoint sees this catalog.

## Event table

`events.csv` is an action-level event log. Each event has a stable `event_id`, chronological `sequence`, period and absolute timestamps, `frame_id`, `chain_id`, optional `parent_event_id`, event/action/outcome types, participant IDs, explicit referee-decision fields, score state, statistics flags, incident ID, coordinates, and factual commentary/detail.

Every player or official in `participant_ids` is present in the linked frame. `frames.csv` also contains the event IDs recorded at that exact timestamp. The generator rejects broken links, missing actors, duplicate IDs, invalid substitution states, gaps in frame time, and incomplete corner/free-kick/penalty chains.

A referee decision is recorded only when `decision=true`. This includes explicit foul/free-kick calls, penalty awards, corners, offsides, cards, and the verbal warning. VAR review records and penalty attempts/results are separate match events and do not become referee decisions. Awarding a penalty is a decision; scoring or missing the kick is an outcome.

Set-piece chains include the preceding action and the restart sequence. Each corner records the shot, named defender's block, ball crossing the byline, corner award, named taker's delivery, aerial contest, and clearance. Each foul/free-kick chain records the challenge, whistle/award, restart delivery, and resolution. Participant IDs and parent links keep these actions connected.

## Tracking table

`frames.csv` contains one row for every elapsed second, including the full-time frame. Each frame has a stable ID, period and clock fields, ball position, possession player/team, all players with `active`, `bench`, or `subbed_off` status, the three match officials, and its related `event_ids`.

Substitutions change both players in the same frame. The outgoing player is off and the incoming player is active at that timestamp. The generator checks that each team has eleven active players and that active player and ball movement remain within configured speed limits.

## Player ratings table

`player-ratings.csv` has one row per elapsed second for each player who has entered the match. It links to the corresponding frame and carries the player's active/subbed-off status, current rating, per-second rating delta, the event IDs that changed the rating, a reason code, and a source marker. A rating starts at 6.00 on the player's first active frame and is carried forward on seconds without a rating-changing event. Goals give the scorer a large increase, assists increase the assisting player's score, and saved penalties, saves, cards, shots, passes, duels, fouls, and penalty awards apply smaller event-linked changes. Values are clamped to 4.00–10.00. These are transparent mock ratings for testing the live data contract, not official or agent judgments.

## Live stream

`GET /api/match/stream?after=4712` opens one SSE connection. It sends one simulated clock tick per second, the frame and all player-rating rows for that second, newly recorded events/decisions/phases, and updated statistics and momentum derived from the current event/frame history. The initial snapshot contains all rating rows through 78:32; subsequent seconds arrive over this same long-lived connection. It does not issue a new HTTP request every second.

Set `MOCK_MATCH_TICK_MS` to control replay speed during local testing; the default is 1000 ms.

Run `npm run generate:ratings` to rebuild only `player-ratings.csv` from the current `events.csv`, `frames.csv`, and `people.csv`. `npm run generate:match` also regenerates the ratings table with the other mock match data.

## Current runtime

The Next.js `/api/match` routes read the local CSV tables under `apps/web/data` directly. The snapshot route loads a fresh dataset for each request; the SSE route loads a dataset when each stream opens and replays it at the configured tick interval.

Set `MOCK_MATCH_TICK_MS` on the Next.js server to change replay speed. The default is 1000 ms.

The Python service still contains PostgreSQL-backed match endpoints, but the Overview routes do not currently proxy to them. `MATCH_API_URL` and `MATCH_STREAM_API_URL` are not read by the current web implementation.
