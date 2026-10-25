/**
 * Generate four match CSVs for MCI vs ARS (Etihad).
 *
 * Pitch (metres, centre spot origin):
 *   x  goal line to goal line  -52.5 … 52.5  (first half: home attacks +x)
 *   y  touchline to touchline -34 … 34
 *   z  height (ball only)
 *
 * Three.js Pitch.js uses width x=68, length z=105; CSV x ↔ scene z, CSV y ↔ scene x.
 *
 * Outputs: frames, events, people, officials, precedents, rules (6 CSVs).
 *
 * Usage: node apps/web/scripts/generate-match.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RULES } from "./rules-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data");

const SEED_EVENTS = 7829032;
const SEED_FRAMES = 20260929;

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

/** Overview lineup percentages → pitch metres */
function pctToPitch(px, py) {
  // Overview: away py≈8 (their goal at +x), home py≈92 (their goal at −x); home attacks +x.
  return {
    x: 52.5 - (py / 100) * 105,
    y: (px / 100) * 68 - 34,
  };
}

/** @type {Record<string, { x: number, y: number }>} key team-no */
const FORMATION_PCT = {
  [`${AWAY}-22`]: { px: 50, py: 8 },
  [`${AWAY}-4`]: { px: 13, py: 18 },
  [`${AWAY}-2`]: { px: 37, py: 18 },
  [`${AWAY}-6`]: { px: 63, py: 18 },
  [`${AWAY}-35`]: { px: 87, py: 18 },
  [`${AWAY}-8`]: { px: 24, py: 29 },
  [`${AWAY}-41`]: { px: 50, py: 29 },
  [`${AWAY}-5`]: { px: 76, py: 29 },
  [`${AWAY}-7`]: { px: 17, py: 43 },
  [`${AWAY}-9`]: { px: 50, py: 43 },
  [`${AWAY}-11`]: { px: 83, py: 43 },
  [`${HOME}-20`]: { px: 17, py: 58 },
  [`${HOME}-9`]: { px: 50, py: 58 },
  [`${HOME}-47`]: { px: 83, py: 58 },
  [`${HOME}-17`]: { px: 24, py: 72 },
  [`${HOME}-16`]: { px: 50, py: 72 },
  [`${HOME}-19`]: { px: 76, py: 72 },
  [`${HOME}-2`]: { px: 13, py: 83 },
  [`${HOME}-3`]: { px: 37, py: 83 },
  [`${HOME}-25`]: { px: 63, py: 83 },
  [`${HOME}-24`]: { px: 87, py: 83 },
  [`${HOME}-31`]: { px: 50, py: 92 },
  [`${HOME}-8`]: { px: 76, py: 72 }, // Kovacic inherits Gundogan slot when on
};

function slotFor(team, no, half, matchSec) {
  const key = `${team}-${no}`;
  let base = FORMATION_PCT[key];
  if (!base) {
    // bench default before entering
    return null;
  }
  let { x, y } = pctToPitch(base.px, base.py);
  if (half === 2) {
    x = -x;
  }
  // drift with match clock for subtle shape shift
  const attackSign = half === 1 ? (team === HOME ? 1 : -1) : team === HOME ? -1 : 1;
  x += attackSign * 3 * Math.sin(matchSec / 120);
  return { x, y };
}

function makeRng(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const WEIGHTS = [
  ["buildup", 24],
  ["attack", 22],
  ["chance", 11],
  ["defend", 18],
  ["setpiece", 10],
  ["referee", 7],
  ["offside", 3],
  ["atmosphere", 5],
];
const WEIGHT_TOTAL = WEIGHTS.reduce((s, [, w]) => s + w, 0);

function categoryFrom(rand, roll) {
  let remaining = roll * WEIGHT_TOTAL;
  for (const [key, weight] of WEIGHTS) {
    remaining -= weight;
    if (remaining <= 0) return key;
  }
  return "buildup";
}

function sideFrom(rand) {
  return rand() < 0.58 ? HOME : AWAY;
}

/** Anchor events (match facts). */
const ANCHORS = [
  { half: 1, t_ms: 0, type: "phase", phase: "kick_off", score: "0-0", team: "", no: "", assist_no: "", replaced_no: "", note: "", incident_id: "" },
  { half: 1, t_ms: 23 * 60 * 1000, type: "goal", team: HOME, no: 47, assist_no: 17, score: "1-0", note: "", incident_id: "" },
  { half: 1, t_ms: 27 * 60 * 1000, type: "var", team: AWAY, no: 9, assist_no: "", score: "", note: "Offside · goal disallowed", incident_id: "offside" },
  { half: 1, t_ms: 41 * 60 * 1000, type: "yellow", team: AWAY, no: 5, assist_no: "", score: "", note: "Tactical foul", incident_id: "" },
  { half: 1, t_ms: HALF1_SEC * 1000, type: "phase", phase: "half_time", score: "1-0", team: "", no: "", assist_no: "", replaced_no: "", note: "", incident_id: "" },
  { half: 2, t_ms: 0, type: "phase", phase: "second_half", score: "1-0", team: "", no: "", assist_no: "", replaced_no: "", note: "", incident_id: "" },
  { half: 2, t_ms: 1 * 60 * 1000, type: "goal", team: AWAY, no: 7, assist_no: 8, score: "1-1", note: "", incident_id: "" },
  { half: 2, t_ms: (61 - 45) * 60 * 1000, type: "yellow", team: HOME, no: 16, assist_no: "", score: "", note: "Late challenge", incident_id: "" },
  { half: 2, t_ms: (66 - 45) * 60 * 1000, type: "penalty-goal", team: HOME, no: 9, assist_no: "", score: "2-1", note: "", incident_id: "" },
  { half: 2, t_ms: (70 - 45) * 60 * 1000, type: "sub", team: HOME, no: 8, assist_no: "", replaced_no: 19, score: "", note: "", incident_id: "" },
  { half: 2, t_ms: (74 - 45) * 60 * 1000, type: "penalty-missed", team: AWAY, no: 7, assist_no: "", score: "", note: "Saved by Ederson", incident_id: "handball" },
  { half: 2, t_ms: (77 - 45) * 60 * 1000, type: "red", team: HOME, no: 24, assist_no: "", score: "", note: "Serious foul play · VAR review", incident_id: "tackle" },
  { half: 2, t_ms: HALF2_SEC * 1000, type: "phase", phase: "full_time", score: "2-1", team: "", no: "", assist_no: "", replaced_no: "", note: "", incident_id: "" },
];

function absoluteMs(half, t_ms) {
  if (half === 1) return t_ms;
  return HALF1_SEC * 1000 + t_ms;
}

function isNearAnchor(half, t_ms, bufferMs = 8000) {
  const abs = absoluteMs(half, t_ms);
  for (const a of ANCHORS) {
    if (Math.abs(absoluteMs(a.half, a.t_ms) - abs) < bufferMs) return true;
  }
  return false;
}

function buildProcessEvents() {
  const rand = makeRng(SEED_EVENTS);
  /** @type {typeof ANCHORS[0][]} */
  const rows = [];

  const totalMatchSec = HALF1_SEC + HALF2_SEC;
  for (let start = 0; start < totalMatchSec; start += 600) {
    const end = Math.min(start + 600, totalMatchSec);
    const perBlock = 9 + Math.floor(rand() * 7);
    const count = Math.max(4, Math.round(perBlock * ((end - start) / 600)));
    const slots = Array.from({ length: count }, () => rand()).sort((a, b) => a - b);
    for (const slot of slots) {
      const matchSec = start + Math.floor(slot * (end - start));
      const half = matchSec < HALF1_SEC ? 1 : 2;
      const t_ms = (half === 1 ? matchSec : matchSec - HALF1_SEC) * 1000 + Math.floor(rand() * 1000);
      if (isNearAnchor(half, t_ms)) continue;
      const type = categoryFrom(rand, rand());
      const team = type === "referee" || type === "atmosphere" ? "" : sideFrom(rand);
      rows.push({
        half,
        t_ms,
        type,
        team,
        no: "",
        assist_no: "",
        replaced_no: "",
        score: "",
        note: "",
        incident_id: "",
        phase: "",
      });
    }
  }

  const all = [...ANCHORS, ...rows].sort(
    (a, b) => absoluteMs(a.half, a.t_ms) - absoluteMs(b.half, b.t_ms),
  );
  return all;
}

function matchSecFrom(half, t_ms) {
  const sec = Math.floor(t_ms / 1000);
  return half === 1 ? sec : HALF1_SEC + sec;
}

function onPitch(team, no, half, matchSec) {
  const subSec = HALF1_SEC + (70 - 45) * 60;
  const redSec = HALF1_SEC + (77 - 45) * 60;
  if (team === HOME && no === 24 && matchSec >= redSec) return false;
  const player = PEOPLE.find((p) => p.team === team && p.no === no);
  if (!player) return false;
  if (player.xi === "start") {
    if (team === HOME && no === 19 && matchSec >= subSec) return false;
    return true;
  }
  if (team === HOME && no === 8 && matchSec >= subSec) return true;
  return false;
}

function benchPosition(team, no, index) {
  const sign = team === HOME ? -1 : 1;
  const x = sign * (8 + (index % 5) * 3);
  return { x, y: 36.5 };
}

function buildFrames(events) {
  const rand = makeRng(SEED_FRAMES);
  /** @type {Record<string, {x:number,y:number}>} */
  const smooth = {};
  let ball = { x: 0, y: 0, z: 0 };
  let possTeam = HOME;
  let possNo = 16;
  let homePoss = true;

  /** @type {Array<Record<string, string|number>>} */
  const rows = [];

  const starters = PEOPLE.filter((p) => p.xi === "start");
  const bench = PEOPLE.filter((p) => p.xi === "bench");

  function eventPull(half, t_ms) {
    const abs = absoluteMs(half, t_ms);
    let best = null;
    let bestD = Infinity;
    for (const e of events) {
      const d = Math.abs(absoluteMs(e.half, e.t_ms) - abs);
      if (d < 6000 && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function writeFrame(half, sec) {
    const t_ms = sec * 1000;
    const matchSec = matchSecFrom(half, t_ms);

    if (sec % 45 === 0 && sec > 0) {
      homePoss = rand() < 0.58;
    } else if (sec % 17 === 0) {
      homePoss = rand() < 0.58;
    }
    possTeam = homePoss ? HOME : AWAY;

    const pull = eventPull(half, t_ms);
    let targetX = homePoss ? 18 : -18;
    let targetY = (rand() - 0.5) * 20;
    if (pull?.team && pull.no) {
      const slot = slotFor(pull.team, pull.no, half, matchSec);
      if (slot) {
        targetX = slot.x;
        targetY = slot.y;
      }
    } else if (pull?.team) {
      targetX = pull.team === HOME ? 25 : -25;
    }

    ball.x += (targetX - ball.x) * 0.08 + (rand() - 0.5) * 0.4;
    ball.y += (targetY - ball.y) * 0.08 + (rand() - 0.5) * 0.3;
    ball.z = Math.max(0, ball.z * 0.85 + (rand() < 0.05 ? rand() * 1.2 : 0));

    const actors = [];

    for (const p of starters) {
      if (!onPitch(p.team, p.no, half, matchSec)) {
        if (p.team === HOME && p.no === 19 && matchSec >= HALF1_SEC + (70 - 45) * 60) {
          // benched after 70'
          const bi = bench.findIndex((b) => b.team === HOME && b.no === 19);
          const pos = benchPosition(HOME, 19, bi >= 0 ? bi : 0);
          actors.push({ team: HOME, no: 19, x: pos.x, y: pos.y });
        }
        if (p.team === HOME && p.no === 24 && matchSec >= HALF1_SEC + (77 - 45) * 60) {
          actors.push({ team: HOME, no: 24, x: -14, y: 36.5 });
        }
        continue;
      }
      let slot = slotFor(p.team, p.no, half, matchSec);
      if (p.team === HOME && p.no === 8 && matchSec >= HALF1_SEC + (70 - 45) * 60) {
        slot = slotFor(HOME, 19, half, matchSec);
      }
      if (!slot) continue;
      const k = `${p.team}-${p.no}`;
      const prev = smooth[k] ?? slot;
      const nx = prev.x + (slot.x - prev.x) * 0.15 + (rand() - 0.5) * 0.35;
      const ny = prev.y + (slot.y - prev.y) * 0.15 + (rand() - 0.5) * 0.35;
      smooth[k] = { x: nx, y: ny };
      actors.push({ team: p.team, no: p.no, x: nx, y: ny });
    }

    let benchIdx = 0;
    for (const p of bench) {
      if (onPitch(p.team, p.no, half, matchSec)) continue;
      const pos = benchPosition(p.team, p.no, benchIdx++);
      actors.push({ team: p.team, no: p.no, x: pos.x, y: pos.y });
    }

    const attacking = half === 1 ? (homePoss ? HOME : AWAY) : homePoss ? HOME : AWAY;
    const offsideX = attacking === HOME ? ball.x - 8 : ball.x + 8;
    const arX = Math.max(-48, Math.min(48, offsideX));
    actors.push({ role: "main", x: ball.x - 4, y: ball.y * 0.3 });
    actors.push({ role: "ar1", x: arX, y: -34 });
    actors.push({ role: "ar2", x: arX, y: 34 });

    let minD = Infinity;
    for (const a of actors) {
      if (!a.team || a.team !== possTeam) continue;
      const d = (a.x - ball.x) ** 2 + (a.y - ball.y) ** 2;
      if (d < minD) {
        minD = d;
        possNo = a.no;
      }
    }

    const contested = rand() < 0.04;
    rows.push({
      half,
      t_ms,
      ball_x: r2(ball.x),
      ball_y: r2(ball.y),
      ball_z: r2(ball.z),
      possession_team: contested ? "" : possTeam,
      possession_no: contested ? "" : possNo,
      actors: JSON.stringify(
        actors.map((a) =>
          a.role
            ? { role: a.role, x: r2(a.x), y: r2(a.y) }
            : { team: a.team, no: a.no, x: r2(a.x), y: r2(a.y) },
        ),
      ),
    });
  }

  for (let sec = 0; sec < HALF1_SEC; sec += 1) writeFrame(1, sec);
  for (let sec = 0; sec < HALF2_SEC; sec += 1) writeFrame(2, sec);

  return rows;
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

/** @param {unknown} value */
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

  const events = buildProcessEvents();
  const frames = buildFrames(events);

  const peopleRows = [
    ...PEOPLE.map((p) => ({
      team: p.team,
      no: p.no,
      name: p.name,
      pos: p.pos,
      xi: p.xi,
      role: "",
    })),
    ...COACHES.map((c) => ({
      team: c.team,
      no: "",
      name: c.name,
      pos: "",
      xi: "",
      role: c.role,
    })),
  ];

  const officialRows = OFFICIALS.map((o) => ({
    role: o.role,
    name: o.name,
    history: JSON.stringify(o.history),
  }));

  const eventRows = events.map((e) => ({
    half: e.half,
    t_ms: e.t_ms,
    type: e.type,
    team: e.team ?? "",
    no: e.no ?? "",
    assist_no: e.assist_no ?? "",
    replaced_no: e.replaced_no ?? "",
    score: e.score ?? "",
    note: e.note ?? "",
    incident_id: e.incident_id ?? "",
    phase: e.phase ?? "",
  }));

  writeFileSync(
    join(OUT_DIR, "frames.csv"),
    toCsv(
      ["half", "t_ms", "ball_x", "ball_y", "ball_z", "possession_team", "possession_no", "actors"],
      frames,
    ),
  );
  writeFileSync(
    join(OUT_DIR, "events.csv"),
    toCsv(
      [
        "half",
        "t_ms",
        "type",
        "team",
        "no",
        "assist_no",
        "replaced_no",
        "score",
        "note",
        "incident_id",
        "phase",
      ],
      eventRows,
    ),
  );
  writeFileSync(
    join(OUT_DIR, "people.csv"),
    toCsv(["team", "no", "name", "pos", "xi", "role"], peopleRows),
  );
  writeFileSync(
    join(OUT_DIR, "officials.csv"),
    toCsv(["role", "name", "history"], officialRows),
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
    `Wrote ${frames.length} frames, ${eventRows.length} events, ${ruleRows.length} rules, ${precedentRows.length} precedents to ${OUT_DIR}`,
  );
}

main();
