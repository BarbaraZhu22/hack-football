# Overview data

The Overview reads its mock response from `events.csv` and `frames.csv` through the local match API. Event rows carry stable IDs, actor references, chain links, decisions, score state, shot/pass/duel/foul/card/set-piece metrics, incident IDs, and factual commentary. Tracking rows link back to every event at the same time and include the complete player/official positions and on-pitch status.

`player-ratings.csv` is the new live player-rating table. It records the carried-forward player rating for every elapsed second from each player's first appearance, with rating deltas tied to event IDs. The initial 78:32 snapshot returns the full rating history through that clock; one SSE tick per second sends the next ratings together with that second's frame and events.

## Timelines and commentary

- **Events** shows the timeline-worthy goals, cards, substitutions, VAR events, penalty outcomes, fouls, offsides, and awarded corners. Half-time is the only phase divider shown. Kick-off and second-half-start phase records remain available to the API but are not rendered on this timeline.
- **Decisions** filters event rows with an explicit referee decision. Fouls/free kicks, penalty awards, corners, offsides, cards, and the recorded verbal warning have concrete labels and participants. A penalty kick's scored/saved result is an event, not a second decision. No generic “Referee call” rows or controversy verdicts are generated.
- **Live commentary** renders the commentary stored with the event chain. It does not invent play descriptions from a broad event category.
- Each of the four incident IDs (`offside`, `handball`, `tackle`, `conflict`) has connected event records with timestamps, participants, chain IDs, and corresponding frames.

## Overview statistics and motion

Possession and momentum are calculated from tracking frames. Shots, shots on target, expected goals, big chances, passes/accuracy, duels, corners, offsides, saves, fouls, and cards are calculated from explicit event attributes. The lineup pitch uses the latest frame's active players and positions; a substitution therefore changes the displayed personnel.

## Initial and live data

The first request is `GET /api/match?through=78:32`, which returns all events and frames before that clock. The client then keeps one SSE connection open to receive each following second. The mock period lengths are 46:00 (45 minutes + 1 added minute) and 48:00 (45 minutes + 3 added minutes), ending at 90+3.
