# Overview data

The Overview reads its mock response from `events.csv` and `frames.csv` through the local match API. Event rows carry stable IDs, actor references, chain links, decisions, score state, shot/pass/duel/foul/card/set-piece metrics, incident IDs, and factual commentary. Tracking rows link back to every event at the same time and include the complete player/official positions and on-pitch status.

`player-ratings.csv` stores one row per `match_second` with a `ratings` JSON array (all active players that second). The API expands it to the same flat rating objects as before. The initial 78:32 snapshot returns history through that clock; each SSE tick adds that second's frame, events, and ratings.

## Timelines and commentary

- **Events** shows the timeline-worthy goals, cards, substitutions, VAR events, penalty outcomes, fouls, offsides, and awarded corners. Half-time is the only phase divider shown. Kick-off and second-half-start phase records remain available to the API but are not rendered on this timeline.
- **Decisions** filters event rows with an explicit referee decision. Fouls/free kicks, penalty awards, corners, offsides, cards, and the recorded verbal warning have concrete labels and participants. A penalty kick's scored/saved result is an event, not a second decision. No generic “Referee call” rows or controversy verdicts are generated.
- **Live commentary** renders the commentary stored with the event chain. It does not invent play descriptions from a broad event category.
- Each of the four incident IDs (`offside`, `handball`, `tackle`, `conflict`) has connected event records with timestamps, participants, chain IDs, and corresponding frames.

## Overview statistics and motion

Possession is calculated from tracking frames. Match stats are recalculated from the events and frames available at the current clock. Momentum is recalculated on every live tick in two-minute buckets using a trailing five-minute window: possession share (20%), attacking final-third control (25%, with the attacking direction switched at half-time), and shot/goal/penalty/corner pressure (55%, with shots weighted by xG and whether they are on target). The bucket values are smoothed across adjacent buckets and bounded from -1 (away pressure) to +1 (home pressure). The chart places each bucket at its match-time position and advances its live edge with the clock. The lineup pitch uses the latest frame's active players and positions; a substitution therefore changes the displayed personnel.

## Initial and live data

The first request is `GET /api/match?through=78:32`, which returns all events and frames before that clock. The client then keeps one SSE connection open to receive each following second. The mock period lengths are 46:00 (45 minutes + 1 added minute) and 48:00 (45 minutes + 3 added minutes), ending at 90+3.
