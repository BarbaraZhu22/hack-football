# Overview data

The Overview loads `GET /api/match` (PostgreSQL via the agent only), then `GET /api/match/stream?after=<cursor>`. Event rows carry stable IDs, actor references, chain links, decisions, score state, shot/pass/duel/foul/card/set-piece metrics, incident IDs, and factual commentary.

**Backend time is authoritative:** the UI uses snapshot and tick **`clock`** / **`cursor`** only. Do not advance the clock without a tick. Lists and commentary use rows with **`timeMilliseconds <= clock.seconds * 1000`**.

The snapshot returns one **`frame`** at the cursor (not a full `frames[]` history) and **`ratings`** for that cursor second only; each SSE tick updates `clock`, that second's `frame`, events, and ratings.

## Timelines and commentary

- **Events** shows timeline-worthy goals, cards, substitutions, VAR events, penalty outcomes, fouls, offsides, and awarded corners, sorted by time and clipped to the clock. Half-time is the only phase divider shown.
- **Decisions** lists referee decisions sorted by `timeMilliseconds` (and `sequence`), clipped to the clock. Layout is chronological top-to-bottom (not spaced with `justify-between`).
- **Live commentary** shows the latest commentary lines from events not after the clock (typically the last 24 lines with `showInCommentary`).
- Pitch event overlays queue when the clock advances and new pitch-worthy events fall in the open second window.

## Overview statistics and motion

Possession and stats come from events and deduplicated per-second frame metrics through **`clock.seconds`**. Momentum uses two-minute buckets with a five-minute window and event pressure (same formula as documented in MATCH_API). The chart bar width advances with **`clock.seconds`**. The lineup pitch uses the current **`frame`** from the snapshot or latest tick.

## Initial and live data

The first request is `GET /api/match` (default live entry 78:32). The client opens SSE with `after` set to the snapshot **`cursor`**. Connection shows **Connecting** until the first **tick**; then **Live**. Period lengths: 46:00 (first half), 48:00 (second half), ending at 90+3.
