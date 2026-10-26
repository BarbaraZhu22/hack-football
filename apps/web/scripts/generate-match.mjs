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
import { PRECEDENTS, PRECEDENT_HEADERS } from "./precedents-catalog.mjs";
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

  if (process.argv.includes("--events-frames-only")) {
    writeFileSync(join(OUT_DIR, "frames.csv"), toCsv(tables.frameHeaders, frames));
    writeFileSync(join(OUT_DIR, "events.csv"), toCsv(tables.eventHeaders, events));
    console.log(`Wrote ${frames.length} frames and ${events.length} events to ${OUT_DIR}`);
    return;
  }

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
      person_id: `${c.team}-coach`,
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
    ...p,
    law_refs: jsonCell(p.law_refs),
    tags: jsonCell(p.tags),
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
    toCsv(PRECEDENT_HEADERS, precedentRows),
  );

  console.log(
    `Wrote ${frames.length} frames, ${events.length} events, ${movementTargets.length} player running targets, ${playerRatings.length} player ratings, ${ruleRows.length} rules, ${precedentRows.length} precedents to ${OUT_DIR}`,
  );
}

main();
