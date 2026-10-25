/**
 * Generate match CSVs for MCI vs ARS (Etihad).
 *
 * Pitch (metres, centre spot origin):
 *   x  goal line to goal line  -52.5 … 52.5  (first half: home attacks +x)
 *   y  touchline to touchline -34 … 34
 *   z  height (ball only)
 *
 * Three.js Pitch.js uses width x=68, length z=105; CSV x ↔ scene z, CSV y ↔ scene x.
 *
 * Outputs: frames, events, people, player running targets, player ratings, officials, precedents, rules (8 CSVs).
 *
 * Usage: node apps/web/scripts/generate-match.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RULES } from "./rules-catalog.mjs";
import { buildMatchTables } from "./match-tables.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data");

const HALF1_SEC = 46 * 60; // 2760
const HALF2_SEC = 48 * 60; // 2880

const HOME = "MCI";
const AWAY = "ARS";

/** @typedef {{ team: string, no: number, name: string, pos: string, xi: 'start'|'bench' }} Player */

/** @type {Player[]} */
const PEOPLE = [
  // Manchester City
  { team: HOME, no: 31, name: "Ederson", pos: "GK", xi: "start" },
  { team: HOME, no: 2, name: "Walker", pos: "RB", xi: "start" },
  { team: HOME, no: 3, name: "Dias", pos: "CB", xi: "start" },
  { team: HOME, no: 25, name: "Akanji", pos: "CB", xi: "start" },
  { team: HOME, no: 24, name: "Gvardiol", pos: "LB", xi: "start" },
  { team: HOME, no: 17, name: "De Bruyne", pos: "CM", xi: "start" },
  { team: HOME, no: 16, name: "Rodri", pos: "CDM", xi: "start" },
  { team: HOME, no: 19, name: "Gundogan", pos: "CM", xi: "start" },
  { team: HOME, no: 20, name: "B. Silva", pos: "LW", xi: "start" },
  { team: HOME, no: 9, name: "Haaland", pos: "ST", xi: "start" },
  { team: HOME, no: 47, name: "Foden", pos: "RW", xi: "start" },
  { team: HOME, no: 8, name: "Kovacic", pos: "CM", xi: "bench" },
  { team: HOME, no: 33, name: "Carson", pos: "GK", xi: "bench" },
  { team: HOME, no: 5, name: "Stones", pos: "CB", xi: "bench" },
  { team: HOME, no: 6, name: "Aké", pos: "CB", xi: "bench" },
  { team: HOME, no: 82, name: "Lewis", pos: "FB", xi: "bench" },
  { team: HOME, no: 21, name: "Doku", pos: "W", xi: "bench" },
  { team: HOME, no: 11, name: "Jeremy", pos: "W", xi: "bench" },
  { team: HOME, no: 52, name: "Bob", pos: "MF", xi: "bench" },
  // Arsenal
  { team: AWAY, no: 22, name: "Raya", pos: "GK", xi: "start" },
  { team: AWAY, no: 4, name: "White", pos: "RB", xi: "start" },
  { team: AWAY, no: 2, name: "Saliba", pos: "CB", xi: "start" },
  { team: AWAY, no: 6, name: "Gabriel", pos: "CB", xi: "start" },
  { team: AWAY, no: 35, name: "Zinchenko", pos: "LB", xi: "start" },
  { team: AWAY, no: 8, name: "Odegaard", pos: "CM", xi: "start" },
  { team: AWAY, no: 41, name: "Rice", pos: "CDM", xi: "start" },
  { team: AWAY, no: 5, name: "Partey", pos: "CM", xi: "start" },
  { team: AWAY, no: 7, name: "Saka", pos: "RW", xi: "start" },
  { team: AWAY, no: 9, name: "Jesus", pos: "ST", xi: "start" },
  { team: AWAY, no: 11, name: "Martinelli", pos: "LW", xi: "start" },
  { team: AWAY, no: 1, name: "Ramsdale", pos: "GK", xi: "bench" },
  { team: AWAY, no: 15, name: "Kiwior", pos: "CB", xi: "bench" },
  { team: AWAY, no: 18, name: "Tomiyasu", pos: "FB", xi: "bench" },
  { team: AWAY, no: 20, name: "Jorginho", pos: "CM", xi: "bench" },
  { team: AWAY, no: 29, name: "Havertz", pos: "ST", xi: "bench" },
  { team: AWAY, no: 19, name: "Trossard", pos: "W", xi: "bench" },
  { team: AWAY, no: 24, name: "Nelson", pos: "W", xi: "bench" },
  { team: AWAY, no: 25, name: "Elneny", pos: "MF", xi: "bench" },
];

const COACHES = [
  { team: HOME, role: "head_coach", name: "Pep Guardiola" },
  { team: AWAY, role: "head_coach", name: "Mikel Arteta" },
];

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  return lines.join("\n") + "\n";
}

function jsonCell(value) {
  return JSON.stringify(value);
}

const PRECEDENT_SOURCE = "Simulated · league benchmark";

const PRECEDENTS = [
  {
    id: "prec-pl-tackle-01",
    incident_type: "tackle",
    match_incident_id: "MCI-ARS-7829-04",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 24,
    fixture: "BHA 1-1 NEW",
    minute: "84'",
    law_refs: ["Law 12.2", "VAR Protocol §3"],
    tags: ["STUDS EXPOSED", "CONTACT ABOVE ANKLE"],
    facts: "Blind-side lunge with studs leading; contact above the ankle, no clean ball contact.",
    on_field: "yellow",
    var_review: "overturn",
    final_outcome: "red",
    similarity: 0.91,
    note: "Overturned to red on VAR.",
  },
  {
    id: "prec-pl-tackle-02",
    incident_type: "tackle",
    match_incident_id: "MCI-ARS-7829-04",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 19,
    fixture: "AVL 0-2 TOT",
    minute: "37'",
    law_refs: ["Law 12.1", "Law 12.2"],
    tags: ["SLIDING TACKLE"],
    facts: "Side-on slide; glancing contact, ball played first.",
    on_field: "yellow",
    var_review: "upheld",
    final_outcome: "yellow",
    similarity: 0.78,
    note: "On-field yellow upheld; no VAR intervention.",
  },
  {
    id: "prec-pl-tackle-03",
    incident_type: "tackle",
    match_incident_id: "MCI-ARS-7829-04",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 8,
    fixture: "EVE 3-0 CRY",
    minute: "52'",
    law_refs: ["Law 12.2"],
    tags: ["EXCESSIVE FORCE", "NO CLEAN BALL CONTACT"],
    facts: "High boot, studs to shin. Straight red; no ball contact.",
    on_field: "red",
    var_review: "none",
    final_outcome: "red",
    similarity: 0.72,
    note: "Straight red; no ball contact.",
  },
  {
    id: "prec-pl-offside-01",
    incident_type: "offside",
    match_incident_id: "MCI-ARS-7829-02",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 11,
    fixture: "LIV 2-1 AVL",
    minute: "63'",
    law_refs: ["Law 11", "VAR Protocol · offside"],
    tags: ["MARGINAL LINE"],
    facts: "Receiver marginally beyond the second-last defender at the moment of the pass.",
    on_field: "goal",
    var_review: "overturn",
    final_outcome: "no_goal",
    similarity: 0.88,
    note: "Goal disallowed after VAR line review.",
  },
  {
    id: "prec-pl-offside-02",
    incident_type: "offside",
    match_incident_id: "MCI-ARS-7829-02",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 21,
    fixture: "WHU 1-2 CHE",
    minute: "71'",
    law_refs: ["Law 11"],
    tags: ["MARGINAL LINE"],
    facts: "Assistant flagged tight offside; on-field decision stood after review.",
    on_field: "no_goal",
    var_review: "upheld",
    final_outcome: "no_goal",
    similarity: 0.81,
    note: "Tight call; VAR confirmed the flag.",
  },
  {
    id: "prec-pl-handball-01",
    incident_type: "handball",
    match_incident_id: "MCI-ARS-7829-05",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 26,
    fixture: "NEW 2-2 MUN",
    minute: "58'",
    law_refs: ["Law 12 · handball", "Law 14"],
    tags: ["ARM EXTENDED"],
    facts: "Ball struck the defender's upper arm in an unnatural position inside the box.",
    on_field: "no_penalty",
    var_review: "overturn",
    final_outcome: "penalty",
    similarity: 0.86,
    note: "Penalty awarded on VAR review.",
  },
  {
    id: "prec-pl-handball-02",
    incident_type: "handball",
    match_incident_id: "MCI-ARS-7829-05",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 14,
    fixture: "FUL 0-1 BHA",
    minute: "33'",
    law_refs: ["Law 12 · handball"],
    tags: ["SUPPORTING ARM"],
    facts: "Ball hit the forearm at close range; arm tucked in a natural silhouette.",
    on_field: "no_penalty",
    var_review: "upheld",
    final_outcome: "no_penalty",
    similarity: 0.74,
    note: "No penalty; arm position deemed natural.",
  },
  {
    id: "prec-pl-handball-03",
    incident_type: "handball",
    match_incident_id: "MCI-ARS-7829-05",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 17,
    fixture: "BOU 1-3 LIV",
    minute: "79'",
    law_refs: ["Law 14"],
    tags: [],
    facts: "Penalty awarded; saved by the goalkeeper.",
    on_field: "penalty",
    var_review: "none",
    final_outcome: "no_goal",
    similarity: 0.69,
    note: "Penalty saved; no retake.",
  },
  {
    id: "prec-pl-conflict-01",
    incident_type: "conflict",
    match_incident_id: "MCI-ARS-7829-06",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 22,
    fixture: "TOT 1-1 CRY",
    minute: "90+2'",
    law_refs: ["Law 12.3", "Law 12"],
    tags: [],
    facts: "Mass confrontation after the whistle; pushing between both squads.",
    on_field: "yellow",
    var_review: "check",
    final_outcome: "yellow",
    similarity: 0.83,
    note: "Multiple yellows; no further red cards.",
  },
  {
    id: "prec-pl-conflict-02",
    incident_type: "conflict",
    match_incident_id: "MCI-ARS-7829-06",
    competition: "Premier League",
    season: "2024-25",
    matchweek: 6,
    fixture: "NFO 0-1 CHE",
    minute: "88'",
    law_refs: ["Law 12.3"],
    tags: [],
    facts: "Post-whistle shove; single player cautioned, others warned.",
    on_field: "yellow",
    var_review: "none",
    final_outcome: "yellow",
    similarity: 0.77,
    note: "Referee restored control with one caution.",
  },
];

const OFFICIALS = [
  {
    role: "main",
    name: "Michael Oliver",
    history: [
      { competition: "Premier League", fixture: "LIV 2-1 CHE", role: "main", yellow: 4, red: 0, pens: 1 },
      { competition: "Premier League", fixture: "TOT 0-0 ARS", role: "main", yellow: 6, red: 1, pens: 0 },
      { competition: "FA Cup", fixture: "MUN 3-2 NEW", role: "main", yellow: 3, red: 0, pens: 2 },
    ],
  },
  {
    role: "ar1",
    name: "Stuart Burt",
    history: [
      { competition: "Premier League", fixture: "WHU 1-1 BHA", role: "ar1", yellow: 0, red: 0, pens: 0 },
      { competition: "Premier League", fixture: "AVL 2-0 BOU", role: "ar1", yellow: 0, red: 0, pens: 0 },
    ],
  },
  {
    role: "ar2",
    name: "Simon Long",
    history: [
      { competition: "Premier League", fixture: "FUL 0-2 CRY", role: "ar2", yellow: 0, red: 0, pens: 0 },
      { competition: "Premier League", fixture: "EVE 1-1 NFO", role: "ar2", yellow: 0, red: 0, pens: 0 },
    ],
  },
];

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const tables = buildMatchTables({ people: PEOPLE, home: HOME, away: AWAY, half1Seconds: HALF1_SEC, half2Seconds: HALF2_SEC });
  const events = tables.events;
  const frames = tables.frames;
  const movementTargets = tables.movementTargets;
  const playerRatings = tables.playerRatings;

  const peopleRows = [
    ...PEOPLE.map((p) => ({
      person_id: `${p.team}-${p.no}`,
      team: p.team,
      no: p.no,
      name: p.name,
      pos: p.pos,
      xi: p.xi,
      role: "",
    })),
    ...COACHES.map((c) => ({
      person_id: "",
      team: c.team,
      no: "",
      name: c.name,
      pos: "",
      xi: "",
      role: c.role,
    })),
  ];

  const officialRows = OFFICIALS.map((o) => ({
    official_id: `OFFICIAL-${o.role}`,
    role: o.role,
    name: o.name,
    history: JSON.stringify(o.history),
  }));

  writeFileSync(join(OUT_DIR, "frames.csv"), toCsv(tables.frameHeaders, frames));
  writeFileSync(join(OUT_DIR, "events.csv"), toCsv(tables.eventHeaders, events));
  writeFileSync(join(OUT_DIR, "player-running-targets.csv"), toCsv(tables.movementTargetHeaders, movementTargets));
  writeFileSync(join(OUT_DIR, "player-ratings.csv"), toCsv(tables.playerRatingHeaders, playerRatings));
  writeFileSync(
    join(OUT_DIR, "people.csv"),
    toCsv(["person_id", "team", "no", "name", "pos", "xi", "role"], peopleRows),
  );
  writeFileSync(
    join(OUT_DIR, "officials.csv"),
    toCsv(["official_id", "role", "name", "history"], officialRows),
  );

  const ruleRows = RULES.map((r) => ({
    ref: r.ref,
    parent_ref: r.parent_ref,
    issuer: r.issuer,
    category: r.category,
    title: r.title,
    body: r.body,
    url: r.url,
    edition: r.edition,
    tone: r.tone,
    incident_types: jsonCell(r.incident_types),
  }));

  const precedentRows = PRECEDENTS.map((p) => ({
    id: p.id,
    incident_type: p.incident_type,
    match_incident_id: p.match_incident_id,
    competition: p.competition,
    season: p.season,
    matchweek: p.matchweek,
    fixture: p.fixture,
    minute: p.minute,
    law_refs: jsonCell(p.law_refs),
    tags: jsonCell(p.tags),
    facts: p.facts,
    on_field: p.on_field,
    var_review: p.var_review,
    final_outcome: p.final_outcome,
    similarity: p.similarity,
    note: p.note,
    source: PRECEDENT_SOURCE,
  }));

  writeFileSync(
    join(OUT_DIR, "rules.csv"),
    toCsv(
      [
        "ref",
        "parent_ref",
        "issuer",
        "category",
        "title",
        "body",
        "url",
        "edition",
        "tone",
        "incident_types",
      ],
      ruleRows,
    ),
  );
  writeFileSync(
    join(OUT_DIR, "precedents.csv"),
    toCsv(
      [
        "id",
        "incident_type",
        "match_incident_id",
        "competition",
        "season",
        "matchweek",
        "fixture",
        "minute",
        "law_refs",
        "tags",
        "facts",
        "on_field",
        "var_review",
        "final_outcome",
        "similarity",
        "note",
        "source",
      ],
      precedentRows,
    ),
  );

  console.log(
    `Wrote ${frames.length} frames, ${events.length} events, ${movementTargets.length} player running targets, ${playerRatings.length} player ratings, ${ruleRows.length} rules, ${precedentRows.length} precedents to ${OUT_DIR}`,
  );
}

main();
