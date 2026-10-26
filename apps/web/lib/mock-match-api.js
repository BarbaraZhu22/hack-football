import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const FIRST_HALF_SECONDS = 46 * 60;
const SECOND_HALF_SECONDS = 48 * 60;
const MATCH_SECONDS = FIRST_HALF_SECONDS + SECOND_HALF_SECONDS;
const DEFAULT_LIVE_CLOCK = "78:32";
const MATCH = {
  competition: "Premier League",
  round: "Matchweek 29",
  home: { code: "MCI", name: "Manchester City", shortName: "City", color: "#6CABDD", text: "#0b2132" },
  away: { code: "ARS", name: "Arsenal", shortName: "Arsenal", color: "#EF0107", text: "#ffffff" },
  score: [0, 0],
  clock: DEFAULT_LIVE_CLOCK,
  stadium: "Etihad Stadium",
  attendance: "54,118",
  incidentId: "MCI-ARS-7829-04",
};

export const MAJOR_EVENT_TYPES = new Set([
  "goal", "penalty-goal", "own-goal", "penalty-missed", "yellow", "red", "sub", "substitution", "var",
]);
export const DECISION_EVENT_TYPES = new Set([
  "foul", "penalty-awarded", "corner-awarded", "offside", "yellow", "red", "warning",
]);

function parseCsv(text) {
  const records = [];
  let record = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") {
      record.push(value);
      value = "";
    } else if (character === "\n") {
      record.push(value.replace(/\r$/, ""));
      if (record.some((cell) => cell.length > 0)) records.push(record);
      record = [];
      value = "";
    } else value += character;
  }
  if (value.length > 0 || record.length > 0) {
    record.push(value.replace(/\r$/, ""));
    if (record.some((cell) => cell.length > 0)) records.push(record);
  }
  const [headers, ...rows] = records;
  if (!headers) return [];
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

async function readTable(name) {
  return parseCsv(await readFile(join(DATA_DIR, name), "utf8"));
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function jsonOr(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function teamSide(code) {
  if (code === MATCH.home.code) return "home";
  if (code === MATCH.away.code) return "away";
  return null;
}

function teamForPerson(personId) {
  if (personId?.startsWith(MATCH.home.code + "-")) return MATCH.home.code;
  if (personId?.startsWith(MATCH.away.code + "-")) return MATCH.away.code;
  return null;
}

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const second = seconds % 60;
  let label;
  if (seconds >= MATCH_SECONDS) label = "90+3:00";
  else if (seconds > 45 * 60 && seconds < FIRST_HALF_SECONDS) {
    label = `45+1:${String(seconds - 45 * 60).padStart(2, "0")}`;
  } else if (seconds > FIRST_HALF_SECONDS + 45 * 60) {
    const added = Math.ceil((seconds - FIRST_HALF_SECONDS - 45 * 60) / 60);
    label = `90+${added}:${String(second).padStart(2, "0")}`;
  } else label = `${Math.floor(seconds / 60)}:${String(second).padStart(2, "0")}`;
  return {
    seconds,
    minute: Math.floor(seconds / 60),
    second,
    label,
    finished: seconds >= MATCH_SECONDS,
  };
}

export function parseClock(value = DEFAULT_LIVE_CLOCK) {
  const added = /^(\d+)\+(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value);
  if (added) {
    const base = Number(added[1]);
    const extra = Number(added[2]);
    const second = Number(added[3]);
    const milliseconds = Number((added[4] || "").padEnd(3, "0")) / 1000;
    return (base + extra + (base >= 90 ? 1 : 0)) * 60 + second + milliseconds;
  }
  const match = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) throw new Error("Clock must use MM:SS or period-added-time format.");
  const milliseconds = Number((match[3] || "").padEnd(3, "0")) / 1000;
  return Number(match[1]) * 60 + Number(match[2]) + milliseconds;
}

function playerName(peopleById, id) {
  return id ? peopleById.get(id)?.name ?? null : null;
}

function isOwnGoal(row) {
  return row.event_type === "own_goal" || [row.action, row.outcome, row.detail, row.commentary]
    .some((value) => /own[\s_-]?goal/i.test(value || ""));
}

function normalizeEventType(row) {
  switch (row.event_type) {
    case "phase": return "phase";
    case "goal":
      if (row.outcome === "disallowed") return "goal-disallowed";
      if (isOwnGoal(row)) return "own-goal";
      return row.restart_type === "penalty" ? "penalty-goal" : "goal";
    case "own_goal": return "own-goal";
    case "penalty_attempt": return row.outcome === "saved" ? "penalty-missed" : "penalty-attempt";
    case "card_shown": return row.outcome === "red" ? "red" : "yellow";
    case "substitution": return "sub";
    case "var_review": return "var";
    case "foul_decision": return "foul";
    case "penalty_awarded": return "penalty-awarded";
    case "corner_awarded": return "corner-awarded";
    case "offside_decision": return "offside";
    case "misconduct_warning": return "warning";
    case "ball_out": return "ball-out";
    case "restart_delivery": return row.restart_type === "corner" ? "corner-delivery" : "free-kick-delivery";
    case "restart_resolution": return "restart-resolution";
    case "aerial_duel": return "aerial-duel";
    case "ball_recovery": return "ball-recovery";
    case "carry": return "carry";
    case "handball_contact": return "handball";
    default: return row.event_type;
  }
}

function phaseLabel(phase) {
  return {
    kick_off: "Kick-off",
    half_time: "Half-time",
    second_half: "Second half",
    full_time: "Full-time",
  }[phase] ?? phase;
}

function createEvent(row, peopleById) {
  const rawType = row.event_type;
  const type = normalizeEventType(row);
  const matchMilliseconds = Number(row.match_ms);
  const matchSeconds = Number(row.match_second);
  const playerId = row.player_id || null;
  const relatedPlayerId = row.related_player_id || null;
  const displayTeamCode = ["foul_decision", "penalty_awarded", "offside_decision"].includes(rawType)
    ? (row.awarded_team_code || row.team_code)
    : (row.awarded_team_code && rawType === "corner_awarded" ? row.awarded_team_code : row.team_code);
  const detail = row.decision_detail || row.detail || "";
  let label = row.decision_label || "";
  if (!label) {
    if (type === "goal") label = `${displayTeamCode} goal`;
    else if (type === "penalty-goal") label = `${displayTeamCode} penalty goal`;
    else if (type === "own-goal") label = `${displayTeamCode} own goal`;
    else if (type === "goal-disallowed") label = `${displayTeamCode} goal disallowed`;
    else if (type === "penalty-missed") label = `${displayTeamCode} penalty saved`;
    else if (type === "yellow" || type === "red") label = `${playerName(peopleById, playerId)} shown a ${type} card`;
    else if (type === "sub") label = "Substitution";
    else if (type === "var") label = "VAR review";
    else if (type === "phase") label = phaseLabel(row.phase);
    else if (type === "foul") label = "Free kick awarded";
    else if (type === "penalty-awarded") label = "Penalty awarded";
    else if (type === "corner-awarded") label = `Corner to ${displayTeamCode}`;
    else if (type === "offside") label = "Offside given";
    else if (type === "warning") label = "Verbal warning";
    else if (type === "corner-delivery") label = `${playerName(peopleById, playerId)} takes the corner`;
    else if (type === "free-kick-delivery") label = `${playerName(peopleById, playerId)} takes the ${row.restart_type.replaceAll("_", " ")}`;
    else if (type === "restart-resolution") label = `${playerName(peopleById, relatedPlayerId)} clears the delivery`;
    else if (type === "aerial-duel") label = "Corner delivery contested";
    else label = detail || row.action.replaceAll("_", " ");
  }
  const decisionType = row.decision_type || "";
  let decisionKind = type;
  if (decisionType === "free_kick_awarded") decisionKind = "foul";
  if (decisionType === "penalty_awarded") decisionKind = "penalty-awarded";
  if (decisionType === "corner_awarded") decisionKind = "corner-awarded";
  if (decisionType === "offside") decisionKind = "offside";
  if (decisionType === "card") decisionKind = row.outcome === "red" ? "red" : "yellow";
  if (decisionType === "misconduct_warning") decisionKind = "warning";
  const decisionLabel = row.decision_label || label;
  const event = {
    id: row.event_id,
    eventId: row.event_id,
    sequence: Number(row.sequence),
    chainId: row.chain_id,
    parentEventId: row.parent_event_id || null,
    type,
    rawType,
    action: row.action,
    outcome: row.outcome,
    phase: row.phase || null,
    period: Number(row.period),
    periodMilliseconds: Number(row.period_ms),
    timeMilliseconds: matchMilliseconds,
    timeSeconds: matchSeconds,
    clockSeconds: matchSeconds,
    clockLabel: row.clock_label,
    minute: Math.floor(matchSeconds / 60),
    minuteLabel: row.minute_label,
    second: matchSeconds % 60,
    team: teamSide(displayTeamCode),
    teamCode: displayTeamCode || null,
    offenderTeamCode: row.team_code || null,
    awardedTeamCode: row.awarded_team_code || null,
    playerId,
    player: playerName(peopleById, playerId),
    relatedPlayerId,
    relatedPlayer: playerName(peopleById, relatedPlayerId),
    targetPlayerId: row.target_player_id || null,
    goalkeeperId: row.goalkeeper_id || null,
    assist: rawType === "goal" ? playerName(peopleById, relatedPlayerId) : null,
    replaced: rawType === "substitution" ? playerName(peopleById, relatedPlayerId) : null,
    participantIds: jsonOr(row.participant_ids, []),
    decision: bool(row.decision),
    decisionType,
    decisionKind,
    decisionLabel,
    decisionDetail: row.decision_detail || "",
    restartType: row.restart_type || "",
    score: (["goal", "own_goal"].includes(rawType) && row.outcome !== "disallowed") || rawType === "phase" ? (row.score || "") : "",
    scoreHome: numberOrNull(row.score_home) ?? 0,
    scoreAway: numberOrNull(row.score_away) ?? 0,
    scoreDelta: numberOrNull(row.score_delta) ?? 0,
    isShot: bool(row.is_shot),
    countInStats: bool(row.count_in_stats),
    shotOnTarget: bool(row.shot_on_target),
    bigChance: bool(row.big_chance),
    xg: numberOrNull(row.xg),
    passCompleted: row.pass_completed === "" ? null : bool(row.pass_completed),
    duelWon: row.duel_won === "" ? null : bool(row.duel_won),
    countsAsFoul: bool(row.counts_as_foul),
    countsAsSave: bool(row.counts_as_save),
    incidentId: row.incident_id || "",
    timelineEvent: bool(row.is_timeline_event),
    showInCommentary: bool(row.show_in_commentary),
    commentary: row.commentary || "",
    note: row.detail || row.decision_detail || "",
    label,
    frameId: row.frame_id,
    location: {
      x: numberOrNull(row.location_x),
      y: numberOrNull(row.location_y),
      targetX: numberOrNull(row.target_x),
      targetY: numberOrNull(row.target_y),
    },
  };
  if (rawType === "phase") event.label = phaseLabel(row.phase);
  if (event.decision) event.decisionLabel = decisionLabel;
  return event;
}

function createFrame(row) {
  const matchMilliseconds = Number(row.match_ms);
  const timeSeconds = Number(row.match_second);
  const actors = jsonOr(row.actors, []).map((actor) => ({
    ...actor,
    number: numberOrNull(actor.no),
    x: Number(actor.x),
    y: Number(actor.y),
    z: Number(actor.z || 0),
  }));
  return {
    id: row.frame_id,
    frameId: row.frame_id,
    period: Number(row.period),
    periodMilliseconds: Number(row.period_ms),
    timeMilliseconds: matchMilliseconds,
    timeSeconds,
    clockSeconds: timeSeconds,
    clockLabel: row.clock_label,
    ball: {
      x: Number(row.ball_x),
      y: Number(row.ball_y),
      z: Number(row.ball_z),
      motion: row.ball_motion || "",
      interactionEventId: row.ball_interaction_event_id || null,
      fromPlayerId: row.ball_from_player_id || null,
      toPlayerId: row.ball_to_player_id || null,
    },
    possession: {
      team: teamSide(row.possession_team),
      teamCode: row.possession_team || null,
      playerId: row.possession_player_id || null,
      number: numberOrNull(row.possession_no),
    },
    eventIds: jsonOr(row.event_ids, []),
    actors,
  };
}

function flattenRatingRows(rows) {
  if (!rows.length) return [];
  if (rows[0].ratings !== undefined && rows[0].player_id === undefined) {
    const flat = [];
    for (const row of rows) {
      const entries = jsonOr(row.ratings, []);
      for (const entry of entries) {
        flat.push({
          ...entry,
          match_second: row.match_second,
          period: row.period,
          period_ms: row.period_ms,
          clock_label: row.clock_label,
          frame_id: row.frame_id,
        });
      }
    }
    return flat;
  }
  return rows;
}

function createPlayerRating(row) {
  const matchSecond = Number(row.match_second);
  return {
    id: row.rating_id,
    frameId: row.frame_id,
    timeMilliseconds: matchSecond * 1000,
    timeSeconds: matchSecond,
    matchSecond,
    period: Number(row.period),
    periodMilliseconds: Number(row.period_ms),
    clockLabel: row.clock_label,
    playerId: row.player_id,
    teamCode: row.team_code,
    playerName: row.player_name,
    playerStatus: row.player_status,
    rating: numberOrNull(row.rating),
    ratingDelta: numberOrNull(row.rating_delta) ?? 0,
    eventIds: jsonOr(row.event_ids, []),
    changeReason: row.change_reason || "",
    source: row.source || "",
  };
}

function normalizePeople(rows) {
  return rows.map((row) => ({
    personId:
      row.person_id ||
      (row.team && row.no ? `${row.team}-${row.no}` : row.role === "head_coach" ? `${row.team}-coach` : null),
    team: teamSide(row.team),
    teamCode: row.team,
    number: numberOrNull(row.no),
    name: row.name,
    position: row.pos || "",
    squadRole: row.xi || "",
    role: row.role || "",
  }));
}

function normalizeOfficials(rows) {
  return rows.map((row) => ({
    officialId: row.official_id || `OFFICIAL-${row.role}`,
    role: row.role,
    name: row.name,
    history: jsonOr(row.history, []),
  }));
}

function normalizeRules(rows) {
  return rows.map((row) => ({ ...row, incident_types: jsonOr(row.incident_types, []) }));
}

function normalizePrecedents(rows) {
  return rows.map((row) => {
    const cleanRow = Object.fromEntries(
      Object.entries(row).filter(([key]) => !["similarity", "match_incident_id"].includes(key)),
    );
    const lawRefs = jsonOr(row.law_refs, []);
    const tags = jsonOr(row.tags, []);
    return {
      ...cleanRow,
      matchweek: numberOrNull(row.matchweek),
      law_refs: lawRefs,
      tags,
      caseId: row.id || "",
      incidentType: row.incident_type || "",
      incidentSubtype: row.incident_subtype || "",
      lawEdition: row.law_edition || "",
      lawRefs,
      onFieldDecision: row.on_field_decision || "",
      varAction: row.var_action || "",
      finalDecision: row.final_decision || "",
      assessment: {
        status: row.assessment_status || "not_stated",
        authority: row.assessment_authority || "",
        summary: row.assessment_text || "",
      },
      source: {
        title: row.source_title || "",
        url: row.source_url || "",
      },
    };
  });
}

export function decisionFromEvent(event) {
  const teamCode = event.awardedTeamCode || event.teamCode;
  const lawReference = {
    free_kick_awarded: "Law 12",
    penalty_awarded: "Law 14",
    corner_awarded: "Law 17",
    offside: "Law 11",
    card: "Law 12",
    misconduct_warning: "Law 12",
  }[event.decisionType] || "";
  const incidentType = {
    offside: "questionable",
    handball: "questionable",
    tackle: "controversial",
    conflict: "controversial",
  }[event.incidentId] || "correct";
  return {
    id: `decision-${event.id}`,
    eventId: event.id,
    minute: event.minute,
    minuteLabel: event.minuteLabel,
    second: event.second,
    type: incidentType,
    decisionKind: event.decisionKind,
    label: event.decisionLabel || event.label,
    detail: event.decisionDetail || event.note,
    team: teamSide(teamCode),
    teamCode,
    player: event.player,
    playerId: event.playerId,
    relatedPlayer: event.relatedPlayer,
    incidentId: event.incidentId,
    meta: lawReference,
  };
}

export function scoreAt(events) {
  const latest = events.at(-1);
  if (!latest) return [0, 0];
  return [latest.scoreHome, latest.scoreAway];
}

function sideAggregate(events, frames, side) {
  const code = side === "home" ? MATCH.home.code : MATCH.away.code;
  const onSide = (event) => event.offenderTeamCode === code || event.teamCode === code;
  const shots = events.filter((event) => event.isShot && event.countInStats && onSide(event));
  const passes = events.filter((event) => event.rawType === "pass" && event.teamCode === code);
  const completedPasses = passes.filter((event) => event.passCompleted);
  const duels = events.filter((event) => event.duelWon && event.teamCode === code);
  const framesWithPossession = frames.filter((frame) => frame.possession.teamCode);
  const possessionCount = framesWithPossession.filter((frame) => frame.possession.teamCode === code).length;
  const possessionTotal = framesWithPossession.length || 1;
  const fouls = events.filter((event) => event.countsAsFoul && (teamForPerson(event.playerId) === code || event.offenderTeamCode === code));
  const saves = events.filter((event) => event.countsAsSave && event.teamCode === code);
  const cards = events.filter((event) => event.rawType === "card_shown" && event.teamCode === code && event.outcome === "yellow");
  return {
    possession: Math.round((possessionCount / possessionTotal) * 100),
    shots: shots.length,
    shotsOnTarget: shots.filter((event) => event.shotOnTarget).length,
    bigChances: shots.filter((event) => event.bigChance).length,
    expectedGoals: Math.round(shots.reduce((sum, event) => sum + (event.xg || 0), 0) * 100) / 100,
    passes: passes.length,
    passAccuracy: passes.length ? Math.round((completedPasses.length / passes.length) * 100) : 0,
    duelsWon: duels.length,
    corners: events.filter((event) => event.rawType === "corner_awarded" && event.teamCode === code).length,
    offsides: events.filter((event) => event.rawType === "offside_decision" && event.offenderTeamCode === code).length,
    saves: saves.length,
    fouls: fouls.length,
    yellowCards: cards.length,
  };
}

export function deriveStats(events, frames) {
  const home = sideAggregate(events, frames, "home");
  const away = sideAggregate(events, frames, "away");
  return [
    { label: "Possession", home: home.possession, away: away.possession, unit: "%" },
    { label: "Shots", home: home.shots, away: away.shots },
    { label: "Shots on target", home: home.shotsOnTarget, away: away.shotsOnTarget },
    { label: "Big chances", home: home.bigChances, away: away.bigChances },
    { label: "Expected goals", home: home.expectedGoals, away: away.expectedGoals },
    { label: "Passes", home: home.passes, away: away.passes },
    { label: "Pass accuracy", home: home.passAccuracy, away: away.passAccuracy, unit: "%" },
    { label: "Duels won", home: home.duelsWon, away: away.duelsWon },
    { label: "Corners", home: home.corners, away: away.corners },
    { label: "Offsides", home: home.offsides, away: away.offsides },
    { label: "Saves", home: home.saves, away: away.saves },
    { label: "Fouls", home: home.fouls, away: away.fouls },
    { label: "Yellow cards", home: home.yellowCards, away: away.yellowCards },
  ];
}

const MOMENTUM_BUCKET_SECONDS = 120;
const MOMENTUM_WINDOW_SECONDS = 300;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function momentumEventPressure(event) {
  if (event.isShot && event.countInStats) {
    return 0.35
      + clamp(Number(event.xg) || 0, 0, 1) * 1.6
      + (event.shotOnTarget ? 0.35 : 0)
      + (event.scoreDelta > 0 ? 0.4 : 0);
  }
  if (event.scoreDelta > 0) return 0.75;
  if (event.rawType === "penalty_awarded") return 0.7;
  if (event.rawType === "corner_awarded") return 0.2;
  return 0;
}

function createPrefix(rows, lastSecond, fields) {
  const prefix = [Object.fromEntries(fields.map((field) => [field, 0]))];
  for (let second = 0; second <= lastSecond; second += 1) {
    const prior = prefix[prefix.length - 1];
    const row = rows[second];
    const next = {};
    for (const field of fields) next[field] = prior[field] + (row?.[field] || 0);
    prefix.push(next);
  }
  return prefix;
}

export function deriveMomentum(events, frames) {
  if (!frames.length) return [];

  const lastSecond = Math.max(...frames.map((frame) => frame.timeSeconds));
  const frameRows = Array.from({ length: lastSecond + 1 }, () => ({
    possessionHome: 0,
    possessionAway: 0,
    finalThirdHome: 0,
    finalThirdAway: 0,
  }));
  for (const frame of frames) {
    const second = frame.timeSeconds;
    const teamCode = frame.possession.teamCode;
    if (!teamCode || second < 0 || second > lastSecond) continue;

    const row = frameRows[second];
    const homeAttacksPositiveX = frame.period === 1;
    const homeProgress = clamp((homeAttacksPositiveX ? frame.ball.x : -frame.ball.x) / 52.5, -1, 1);
    const attackingProgress = teamCode === MATCH.home.code ? homeProgress : -homeProgress;
    const finalThirdControl = clamp((attackingProgress - 1 / 3) / (2 / 3), 0, 1);

    if (teamCode === MATCH.home.code) {
      row.possessionHome += 1;
      row.finalThirdHome += finalThirdControl;
    } else if (teamCode === MATCH.away.code) {
      row.possessionAway += 1;
      row.finalThirdAway += finalThirdControl;
    }
  }

  const eventRows = Array.from({ length: lastSecond + 1 }, () => ({ pressureHome: 0, pressureAway: 0 }));
  for (const event of events) {
    const second = Math.floor(event.timeMilliseconds / 1000);
    if (second < 0 || second > lastSecond) continue;
    const pressure = momentumEventPressure(event);
    if (!pressure) continue;

    const teamCode = event.teamCode || event.offenderTeamCode;
    if (teamCode === MATCH.home.code) eventRows[second].pressureHome += pressure;
    else if (teamCode === MATCH.away.code) eventRows[second].pressureAway += pressure;
  }

  const frameFields = ["possessionHome", "possessionAway", "finalThirdHome", "finalThirdAway"];
  const eventFields = ["pressureHome", "pressureAway"];
  const framePrefix = createPrefix(frameRows, lastSecond, frameFields);
  const eventPrefix = createPrefix(eventRows, lastSecond, eventFields);
  const buckets = Math.floor(lastSecond / MOMENTUM_BUCKET_SECONDS) + 1;
  const rawValues = [];

  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const end = Math.min((bucket + 1) * MOMENTUM_BUCKET_SECONDS, lastSecond + 1);
    const start = Math.max(0, end - MOMENTUM_WINDOW_SECONDS);
    const frameStart = framePrefix[start];
    const frameEnd = framePrefix[end];
    const eventStart = eventPrefix[start];
    const eventEnd = eventPrefix[end];

    const possessionHome = frameEnd.possessionHome - frameStart.possessionHome;
    const possessionAway = frameEnd.possessionAway - frameStart.possessionAway;
    const frameCount = possessionHome + possessionAway;
    const finalThirdHome = frameEnd.finalThirdHome - frameStart.finalThirdHome;
    const finalThirdAway = frameEnd.finalThirdAway - frameStart.finalThirdAway;
    const pressureHome = eventEnd.pressureHome - eventStart.pressureHome;
    const pressureAway = eventEnd.pressureAway - eventStart.pressureAway;

    const possessionEdge = frameCount ? (possessionHome - possessionAway) / frameCount : 0;
    const territoryEdge = frameCount ? (finalThirdHome - finalThirdAway) / frameCount : 0;
    const pressureEdge = (pressureHome - pressureAway) / (pressureHome + pressureAway + 2);
    rawValues.push(clamp(0.2 * possessionEdge + 0.25 * territoryEdge + 0.55 * pressureEdge, -1, 1));
  }

  return rawValues.map((value, index) => {
    const previous = rawValues[index - 1] ?? value;
    const twoBack = rawValues[index - 2] ?? previous;
    const smoothed = clamp(value * 0.6 + previous * 0.28 + twoBack * 0.12, -1, 1);
    return Math.round(smoothed * 100) / 100;
  });
}

export async function loadMockMatchDataset() {
  const [eventRows, frameRows, ratingRows, peopleRows, officialRows, ruleRows, precedentRows] = await Promise.all([
    readTable("events.csv"),
    readTable("frames.csv"),
    readTable("player-ratings.csv"),
    readTable("people.csv"),
    readTable("officials.csv"),
    readTable("rules.csv"),
    readTable("precedents.csv"),
  ]);
  const people = normalizePeople(peopleRows);
  const peopleById = new Map(people.filter((person) => person.personId).map((person) => [person.personId, person]));
  const events = eventRows.map((row) => createEvent(row, peopleById));
  const frames = frameRows
    .filter((row) => !row.frame_id.startsWith("frame-incident-"))
    .map(createFrame);
  const ratings = flattenRatingRows(ratingRows).map(createPlayerRating);
  return {
    match: MATCH,
    events: events.filter((event) => event.type !== "phase"),
    phases: events.filter((event) => event.type === "phase"),
    frames,
    ratings,
    people,
    officials: normalizeOfficials(officialRows),
    rules: normalizeRules(ruleRows),
    precedents: normalizePrecedents(precedentRows),
  };
}

export async function loadMockPrecedentsDataset() {
  return normalizePrecedents(await readTable("precedents.csv"));
}

export async function loadMockTrackingDataset() {
  const [frameRows, peopleRows] = await Promise.all([
    readTable("frames.csv"),
    readTable("people.csv"),
  ]);
  return {
    match: MATCH,
    frames: frameRows.map(createFrame),
    people: normalizePeople(peopleRows),
  };
}

export function frameAtCursor(frames, cursorSeconds) {
  const second = cursorSeconds;
  const secondMs = second * 1000;
  let candidates = frames.filter(
    (frame) =>
      frame.timeMilliseconds <= secondMs &&
      (second === 0 || frame.timeMilliseconds > (second - 1) * 1000),
  );
  if (!candidates.length) {
    candidates = frames.filter((frame) => Math.floor(frame.timeSeconds) === second);
  }
  if (!candidates.length) return null;
  return candidates.reduce((best, frame) =>
    frame.timeMilliseconds > best.timeMilliseconds ? frame : best,
  );
}

function dedupeFramesForMetrics(frames) {
  const bySecond = new Map();
  for (const frame of frames) {
    const second = Math.floor(frame.timeSeconds);
    const existing = bySecond.get(second);
    if (!existing || frame.timeMilliseconds > existing.timeMilliseconds) {
      bySecond.set(second, frame);
    }
  }
  return [...bySecond.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, frame]) => frame);
}

function lightMetricFrame(row) {
  const teamCode = row.possession?.teamCode || "";
  return {
    timeMilliseconds: row.timeMilliseconds,
    timeSeconds: row.timeSeconds,
    period: row.period,
    possession: { teamCode },
    ball: { x: row.ball?.x ?? 0 },
  };
}

export function createMockTrackingWindow(dataset, fromSeconds, throughSeconds) {
  const frames = dataset.frames.filter(
    (frame) => fromSeconds <= frame.clockSeconds && frame.clockSeconds <= throughSeconds,
  );
  return {
    match: dataset.match,
    frames,
    people: dataset.people,
  };
}

export function createMockSnapshot(dataset, throughSeconds = parseClock(DEFAULT_LIVE_CLOCK)) {
  const withinWindow = (item) => item.timeMilliseconds <= throughSeconds * 1000;
  const events = dataset.events.filter(withinWindow);
  const phases = dataset.phases.filter(withinWindow);
  const framesInWindow = dataset.frames.filter(withinWindow);
  const metricFrames = dedupeFramesForMetrics(framesInWindow).map(lightMetricFrame);
  const frame = frameAtCursor(framesInWindow, throughSeconds);
  const ratings = dataset.ratings.filter(
    (rating) => Math.floor(rating.matchSecond) === throughSeconds,
  );
  const allEvents = [...events, ...phases].sort((left, right) => left.timeMilliseconds - right.timeMilliseconds || left.sequence - right.sequence);
  const timelineEvents = events.filter(
    (event) => (event.timelineEvent || event.type === "sub") && MAJOR_EVENT_TYPES.has(event.type),
  );
  const decisions = events.filter((event) => event.decision).map(decisionFromEvent);
  const score = scoreAt(allEvents);
  return {
    match: { ...dataset.match, score },
    stats: deriveStats(events, metricFrames),
    clock: formatClock(throughSeconds),
    cursor: throughSeconds,
    events,
    timelineEvents,
    decisions,
    momentum: deriveMomentum(events, metricFrames),
    phases,
    frame,
    ratings,
    people: dataset.people,
    officials: dataset.officials,
    rules: dataset.rules,
    precedents: dataset.precedents,
    dataSource: { ok: true, backend: "local-csv" },
  };
}
