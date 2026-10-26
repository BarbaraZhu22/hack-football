# Overview data

The Overview loads `GET /api/match` (remote PostgreSQL via the agent, or CSV fallback), then `GET /api/match/stream?after=<cursor>`. Event rows carry stable IDs, actor references, chain links, decisions, score state, shot/pass/duel/foul/card/set-piece metrics, incident IDs, and factual commentary.

**Backend time is authoritative:** the UI uses snapshot and tick **`clock`** / **`cursor`** only. The snapshot returns one **`frame`** at the cursor (not a full `frames[]` history) and **`ratings`** for that cursor second only; each SSE tick adds that second's frame, events, and ratings.

## Timelines and commentary

- **Events** shows the timeline-worthy goals, cards, substitutions, VAR events, penalty outcomes, fouls, offsides, and awarded corners. Half-time is the only phase divider shown. Kick-off and second-half-start phase records remain available to the API but are not rendered on this timeline.
- **Decisions** filters event rows with an explicit referee decision. Fouls/free kicks, penalty awards, corners, offsides, cards, and the recorded verbal warning have concrete labels and participants. A penalty kick's scored/saved result is an event, not a second decision. No generic “Referee call” rows or controversy verdicts are generated.
- **Live commentary** renders the commentary stored with the event chain. It does not invent play descriptions from a broad event category.
- Each of the four incident IDs (`offside`, `handball`, `tackle`, `conflict`) has connected event records with timestamps, participants, chain IDs, and corresponding frames.

## Overview statistics and motion

Possession is calculated from per-second tracking samples (deduplicated from frame rows through the cursor). Match stats are recalculated from the events and frames available at the current clock. On CSV fallback, momentum uses the documented two-minute bucket / five-minute window formula with event pressure; on PostgreSQL the agent uses its built-in momentum series. The chart advances its live edge with **`clock.seconds`**. The lineup pitch uses the current **`frame`** from the snapshot or latest tick; a substitution changes displayed personnel when the tick frame updates.

## Initial and live data

The first request is `GET /api/match` (default live entry 78:32). The client opens SSE with `after` set to the snapshot **`cursor`**. Mock period lengths are 46:00 (first half) and 48:00 (second half), ending at 90+3.
