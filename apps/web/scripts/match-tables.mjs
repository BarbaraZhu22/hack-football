import { buildSimulation, sampleFrame } from "../lib/incident-simulation.js";
import { buildOffsideSimulation, sampleOffsideFrame } from "../lib/offside-simulation.js";
import {
  INCIDENT_TRACKING,
  INCIDENT_TRACKING_SAMPLE_STEP,
  incidentActorMatchPoint,
  incidentBallMatchPoint,
  matchSecondAtSimulationTime,
  roundPitchCoordinate,
  simulationMatchMilliseconds,
  simulationTimeAtMatchSecond,
} from "../lib/incident-coordinate-map.js";

const LIVE_CUTOFF_SECONDS = 78 * 60 + 32;
const HOME_FORMATION = {
  GK: 31, RB: 2, CB: [3, 25], LB: 24, CM: [17, 19], CDM: 16, LW: 20, ST: 9, RW: 47,
};
const AWAY_FORMATION = {
  GK: 22, RB: 4, CB: [2, 6], LB: 35, CM: [8, 5], CDM: 41, LW: 11, ST: 9, RW: 7,
};
const OFFICIALS = ["OFFICIAL-main", "OFFICIAL-ar1", "OFFICIAL-ar2"];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round2 = (value) => Math.round(value * 100) / 100;
const playerId = (team, number) => `${team}-${number}`;
const frameId = (seconds) => `frame-${String(seconds).padStart(5, "0")}`;

function teamForPlayerId(id) {
  return id?.startsWith("MCI-") ? "MCI" : id?.startsWith("ARS-") ? "ARS" : null;
}

function officialMinute(period, periodSeconds, half1Seconds) {
  if (period === 1) {
    if (periodSeconds <= 45 * 60) return String(Math.floor(periodSeconds / 60));
    return `45+${Math.ceil((periodSeconds - 45 * 60) / 60)}`;
  }
  if (periodSeconds <= 45 * 60) return String(Math.floor((half1Seconds + periodSeconds) / 60));
  return `90+${Math.ceil((periodSeconds - 45 * 60) / 60)}`;
}

function periodForMatchSecond(matchSecond, half1Seconds) {
  return matchSecond < half1Seconds ? 1 : 2;
}

function periodSecondForMatchSecond(matchSecond, period, half1Seconds) {
  return period === 1 ? matchSecond : matchSecond - half1Seconds;
}

function globalSecond(period, periodSecond, half1Seconds) {
  return period === 1 ? periodSecond : half1Seconds + periodSecond;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function formatElapsedClock(seconds, half1Seconds, half2Seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const second = safe % 60;
  if (safe > 45 * 60 && safe < half1Seconds) {
    return `45+1:${String(safe - 45 * 60).padStart(2, "0")}`;
  }
  const secondHalfExtraStart = half1Seconds + 45 * 60;
  if (safe > secondHalfExtraStart) {
    const added = Math.ceil((safe - secondHalfExtraStart) / 60);
    return `90+${added}:${String(second % 60).padStart(2, "0")}`;
  }
  const minute = Math.floor(safe / 60);
  const isFinished = safe >= half1Seconds + half2Seconds;
  if (isFinished) return "90+3:00";
  return `${minute}:${String(second).padStart(2, "0")}`;
}

function makeEventFactory({ home, away, half1Seconds, half2Seconds, peopleById }) {
  const events = [];
  let sequence = 0;
  const add = (spec) => {
    const period = Number(spec.period);
    const periodSecond = Number(spec.periodSecond);
    if (![1, 2].includes(period) || !Number.isInteger(periodSecond)) {
      throw new Error(`Invalid event time: ${JSON.stringify(spec)}`);
    }
    const periodLength = period === 1 ? half1Seconds : half2Seconds;
    if (periodSecond < 0 || periodSecond > periodLength) {
      throw new Error(`Event falls outside period ${period}: ${JSON.stringify(spec)}`);
    }
    const matchSecond = globalSecond(period, periodSecond, half1Seconds);
    const id = `event-${String(++sequence).padStart(5, "0")}`;
    const participants = [...new Set([
      spec.playerId,
      spec.relatedPlayerId,
      spec.targetPlayerId,
      spec.goalkeeperId,
      spec.refereeId,
      ...(spec.participantIds || []),
    ].filter(Boolean))];
    const teamCode = spec.teamCode || teamForPlayerId(spec.playerId) || null;
    const parent = spec.parentEventId || null;
    const event = {
      event_id: id,
      sequence,
      period,
      period_ms: periodSecond * 1000,
      match_ms: matchSecond * 1000,
      match_second: matchSecond,
      clock_label: spec.clockLabel || formatElapsedClock(matchSecond, half1Seconds, half2Seconds),
      minute_label: officialMinute(period, periodSecond, half1Seconds),
      period_added_seconds: Math.max(0, periodSecond - 45 * 60),
      phase: spec.phase || "",
      frame_id: frameId(matchSecond),
      chain_id: spec.chainId || id,
      parent_event_id: parent,
      event_type: spec.eventType,
      action: spec.action || "",
      outcome: spec.outcome || "",
      team_code: teamCode || "",
      awarded_team_code: spec.awardedTeamCode || "",
      player_id: spec.playerId || "",
      related_player_id: spec.relatedPlayerId || "",
      target_player_id: spec.targetPlayerId || "",
      goalkeeper_id: spec.goalkeeperId || "",
      referee_id: spec.refereeId || "",
      participant_ids: JSON.stringify(participants),
      decision: Boolean(spec.decision),
      decision_type: spec.decisionType || "",
      decision_label: spec.decisionLabel || "",
      decision_detail: spec.decisionDetail || "",
      restart_type: spec.restartType || "",
      score: "",
      score_home: "",
      score_away: "",
      score_delta: Number(spec.scoreDelta || 0),
      is_shot: Boolean(spec.isShot),
      count_in_stats: spec.countInStats === undefined ? Boolean(spec.isShot) : Boolean(spec.countInStats),
      shot_on_target: Boolean(spec.shotOnTarget),
      big_chance: Boolean(spec.bigChance),
      xg: spec.xg === undefined ? "" : Number(spec.xg),
      pass_completed: spec.passCompleted === undefined ? "" : Boolean(spec.passCompleted),
      duel_won: spec.duelWon === undefined ? "" : Boolean(spec.duelWon),
      counts_as_foul: Boolean(spec.countsAsFoul),
      counts_as_save: Boolean(spec.countsAsSave),
      incident_id: spec.incidentId || "",
      is_timeline_event: Boolean(spec.timelineEvent),
      show_in_commentary: Boolean(spec.showInCommentary),
      commentary: spec.commentary || "",
      detail: spec.detail || "",
      location_x: spec.x === undefined ? "" : round2(clamp(spec.x, -52.5, 52.5)),
      location_y: spec.y === undefined ? "" : round2(clamp(spec.y, -34, 34)),
      target_x: spec.targetX === undefined ? "" : round2(clamp(spec.targetX, -52.5, 52.5)),
      target_y: spec.targetY === undefined ? "" : round2(clamp(spec.targetY, -34, 34)),
      possession_after_player_id: spec.possessionAfterPlayerId || "",
      possession_after_team_code: spec.possessionAfterTeamCode || "",
    };
    for (const idValue of participants) {
      if (!peopleById.has(idValue) && !OFFICIALS.includes(idValue)) {
        throw new Error(`${id} references unknown participant ${idValue}`);
      }
    }
    events.push(event);
    return event;
  };
  return { add, events };
}

function locationFor(team, matchSecond, home, period, seed = 0) {
  const direction = team === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
  const phase = matchSecond / 130 + (seed % 7) * 0.05;
  const progress = 10 + 16 * Math.sin(phase);
  return {
    x: clamp(direction * progress, -48, 48),
    y: clamp(17 * Math.sin(phase * 0.73), -30, 30),
  };
}

function activePlayers(people, team, matchSecond, home, half1Seconds) {
  const subTime = half1Seconds + 24 * 60;
  return people.filter((person) => {
    if (person.team !== team || person.role) return false;
    if (person.xi === "start") {
      return !(team === home && person.no === 19 && matchSecond >= subTime);
    }
    return team === home && person.no === 8 && matchSecond >= subTime;
  });
}

function buildPassEvents({ add, events, people, home, away, half1Seconds, half2Seconds }) {
  const duration = half1Seconds + half2Seconds;
  const peopleById = new Map(people.filter((person) => !person.role).map((person) => [playerId(person.team, person.no), person]));
  const originalEvents = [...events];
  const reservedTimes = new Set(originalEvents.map((event) => event.match_second));

  // A scored goal is followed by a real restart before the open-play state machine resumes.
  for (const goal of originalEvents.filter((event) => event.event_type === "goal" && event.outcome === "scored")) {
    let second = Math.min(duration - 2, goal.match_second + 8);
    while (reservedTimes.has(second) && second < Math.min(duration - 2, goal.match_second + 18)) second += 1;
    if (reservedTimes.has(second) || second <= goal.match_second) continue;
    const period = periodForMatchSecond(second, half1Seconds);
    const kickoffTeam = goal.team_code === home ? away : home;
    const kickoff = add({
      period,
      periodSecond: periodSecondForMatchSecond(second, period, half1Seconds),
      eventType: "phase",
      phase: "kick_off",
      action: "kick_off_after_goal",
      outcome: "restart_after_goal",
      teamCode: kickoffTeam,
      playerId: playerId(kickoffTeam, kickoffTeam === home ? 16 : 41),
      participantIds: [playerId(kickoffTeam, kickoffTeam === home ? 16 : 41)],
      detail: `${kickoffTeam} restart after the goal.`,
      x: 0,
      y: 0,
      possessionAfterPlayerId: playerId(kickoffTeam, kickoffTeam === home ? 16 : 41),
      possessionAfterTeamCode: kickoffTeam,
    });
    kickoff._priority = -50;
    reservedTimes.add(second);
  }

  const anchorsBySecond = new Map();
  for (const event of events) {
    const rows = anchorsBySecond.get(event.match_second) || [];
    rows.push(event);
    anchorsBySecond.set(event.match_second, rows);
  }
  for (const rows of anchorsBySecond.values()) rows.sort((left, right) => left.sequence - right.sequence);

  const state = { team: home, holder: playerId(home, 16), stopped: false, passes: 0, possessionStartSecond: 0 };
  let nextActionSecond = 5;
  const activeOutfield = (team, second) => activePlayers(people, team, second, home, half1Seconds)
    .filter((person) => person.pos !== "GK");
  const positionOf = (id, second) => {
    const person = peopleById.get(id);
    if (!person) return { x: 0, y: 0 };
    const period = periodForMatchSecond(second, half1Seconds);
    return formationSlot(person, person.team, home, away, period, second, half1Seconds, 0.35, false);
  };
  const setHolder = (id) => {
    state.holder = id || "";
    state.team = teamForPlayerId(id || "") || "";
    state.stopped = !id;
  };
  const ensureController = (expectedId, second) => {
    const expectedTeam = teamForPlayerId(expectedId);
    const expectedPlayer = peopleById.get(expectedId);
    if (!expectedTeam || !expectedPlayer || state.stopped) return null;
    if (state.holder === expectedId) return null;
    const period = periodForMatchSecond(second, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(second, period, half1Seconds);
    const currentPlayer = peopleById.get(state.holder);
    const from = currentPlayer ? positionOf(state.holder, second) : positionOf(expectedId, second);
    const to = positionOf(expectedId, second);
    const sameTeam = state.team === expectedTeam;
    const row = add({
      period,
      periodSecond,
      eventType: sameTeam ? "pass" : "ball_recovery",
      action: sameTeam ? "completed_pass" : "pressing_recovery",
      outcome: sameTeam ? "completed" : "won",
      teamCode: expectedTeam,
      playerId: sameTeam ? state.holder : expectedId,
      relatedPlayerId: sameTeam ? expectedId : (state.holder || expectedId),
      participantIds: [...new Set([state.holder, expectedId])],
      chainId: `possession-link-${second}-${expectedId}`,
      passCompleted: sameTeam ? true : undefined,
      detail: sameTeam
        ? `${currentPlayer?.name || state.holder} plays a short pass to ${expectedPlayer.name} before the next action.`
        : `${expectedPlayer.name} wins the ball back before the next action.`,
      x: from.x,
      y: from.y,
      targetX: to.x,
      targetY: to.y,
      possessionAfterPlayerId: expectedId,
      possessionAfterTeamCode: expectedTeam,
    });
    row._priority = -100;
    setHolder(expectedId);
    state.passes = sameTeam ? state.passes + 1 : 0;
    return row;
  };
  const anchorController = (event) => {
    if (event.event_type === "pass" || event.event_type === "shot" || event.event_type === "penalty_attempt") return event.player_id;
    // A challenge is not proof that the defender won the ball. Only explicit recovery
    // events may transfer possession; a foul is stopped by the following decision.
    if (event.event_type === "challenge") return "";
    if (event.event_type === "duel" || event.event_type === "aerial_duel") return "";
    return "";
  };
  const applyAnchor = (event) => {
    if (event.event_type === "phase") {
      if (["half_time", "full_time"].includes(event.phase)) setHolder("");
      else if (["kick_off", "second_half"].includes(event.phase)) {
        const kickoffTeam = event.team_code || home;
        setHolder(event.player_id || playerId(kickoffTeam, 16));
      }
    }
    if (event.possession_after_player_id && event.possession_after_team_code) {
      setHolder(event.possession_after_player_id);
    } else if (["restart_delivery", "restart_resolution", "save"].includes(event.event_type) && event.related_player_id) {
      setHolder(event.related_player_id);
    }
    const stopsPlay = ["foul_decision", "corner_awarded", "penalty_awarded", "offside_decision", "ball_out"].includes(event.event_type)
      || event.event_type === "goal" && event.outcome === "scored"
      || ["shot", "penalty_attempt"].includes(event.event_type) && event.outcome === "wide"
      || event.event_type === "phase" && ["half_time", "full_time"].includes(event.phase);
    if (stopsPlay) setHolder("");
    if (event.event_type === "substitution" && state.holder === event.related_player_id) setHolder(event.player_id);
    if (event.event_type === "pass") state.passes += event.pass_completed === false ? 0 : 1;
    if (["ball_recovery", "save", "restart_delivery", "restart_resolution"].includes(event.event_type)) state.passes = 0;
    if (state.team && event.match_second >= 0) state.possessionStartSecond = event.match_second;
  };
  const makeOpenPlayAction = (second) => {
    if (state.stopped || !state.holder || !state.team) return;
    const holder = peopleById.get(state.holder);
    if (!holder || !activeAt(holder, second, home, half1Seconds)) {
      const candidates = activeOutfield(state.team, second);
      if (!candidates.length) return;
      setHolder(playerId(state.team, candidates[0].no));
    }
    const current = peopleById.get(state.holder);
    const opponent = state.team === home ? away : home;
    const activeTeammates = activeOutfield(state.team, second).filter((person) => playerId(person.team, person.no) !== state.holder);
    const activeOpponents = activeOutfield(opponent, second);
    const period = periodForMatchSecond(second, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(second, period, half1Seconds);
    const from = positionOf(state.holder, second);
    const nearbyTeammates = activeTeammates
      .map((person) => ({ person, position: positionOf(playerId(person.team, person.no), second) }))
      .sort((left, right) => Math.hypot(left.position.x - from.x, left.position.y - from.y)
        - Math.hypot(right.position.x - from.x, right.position.y - from.y));
    const nearestOpponents = activeOpponents
      .map((person) => ({ person, position: positionOf(playerId(person.team, person.no), second) }))
      .sort((left, right) => Math.hypot(left.position.x - from.x, left.position.y - from.y)
        - Math.hypot(right.position.x - from.x, right.position.y - from.y));
    const seed = stableHash(`${second}-${state.holder}-open-play`);
    const possessionAge = second - state.possessionStartSecond;
    const shouldRecover = state.passes >= 3 && (seed % 100 < 38 || possessionAge > 28);
    if (shouldRecover && nearestOpponents.length) {
      const tackler = nearestOpponents[0].person;
      const tacklerId = playerId(opponent, tackler.no);
      const recovery = add({
        period, periodSecond, eventType: "ball_recovery", action: "tackle_recovery", outcome: "won",
        teamCode: opponent, playerId: tacklerId, relatedPlayerId: state.holder,
        participantIds: [tacklerId, state.holder], chainId: `recovery-${second}`,
        duelWon: true, detail: `${tackler.name} presses ${current.name} and wins possession.`,
        x: from.x, y: from.y, targetX: nearestOpponents[0].position.x, targetY: nearestOpponents[0].position.y,
        possessionAfterPlayerId: tacklerId, possessionAfterTeamCode: opponent,
      });
      setHolder(tacklerId);
      state.passes = 0;
      state.possessionStartSecond = second;
      nextActionSecond = second + 3 + seed % 4;
      return recovery;
    }
    const carry = seed % 100 < 29;
    if (carry) {
      const carryEvent = add({
        period, periodSecond, eventType: "carry", action: seed % 2 ? "progressive_carry" : "retain_possession",
        outcome: seed % 2 ? "progressed" : "retained", teamCode: state.team,
        playerId: state.holder, participantIds: [state.holder], chainId: `carry-${second}`,
        detail: seed % 2 ? `${current.name} carries the ball forward under pressure.` : `${current.name} shields the ball and keeps possession.`,
        x: from.x, y: from.y, possessionAfterPlayerId: state.holder, possessionAfterTeamCode: state.team,
      });
      nextActionSecond = second + 3 + (seed >>> 3) % 5;
      return carryEvent;
    }
    if (!nearbyTeammates.length) return;
    const receiver = nearbyTeammates[Math.min(nearbyTeammates.length - 1, (seed >>> 4) % Math.min(4, nearbyTeammates.length))];
    const distanceToReceiver = Math.hypot(receiver.position.x - from.x, receiver.position.y - from.y);
    const pressured = nearestOpponents.length > 0
      && Math.hypot(nearestOpponents[0].position.x - from.x, nearestOpponents[0].position.y - from.y) < 8.5;
    const intercepted = distanceToReceiver > 24 || (pressured && seed % 100 < 13);
    const target = intercepted && nearestOpponents.length ? nearestOpponents[0] : receiver;
    const targetId = playerId(target.person.team, target.person.no);
    const pass = add({
      period, periodSecond, eventType: "pass", action: intercepted ? "attempted_pass" : "completed_pass",
      outcome: intercepted ? "intercepted" : "completed", teamCode: state.team, playerId: state.holder,
      relatedPlayerId: targetId, participantIds: [state.holder, targetId], chainId: `open-pass-${second}`,
      passCompleted: !intercepted,
      detail: intercepted
        ? `${current.name}'s pass is cut out by ${target.person.name}.`
        : `${current.name} passes to ${target.person.name}.`,
      x: from.x, y: from.y, targetX: target.position.x, targetY: target.position.y,
      possessionAfterPlayerId: targetId, possessionAfterTeamCode: target.person.team,
    });
    setHolder(targetId);
    state.passes = intercepted ? 0 : state.passes + 1;
    if (intercepted) state.possessionStartSecond = second;
    const expectedFlightSeconds = Math.ceil(distanceToReceiver / 15) + 1;
    nextActionSecond = second + Math.max(6, expectedFlightSeconds + 1);
    return pass;
  };

  for (let second = 0; second <= duration; second += 1) {
    const anchors = anchorsBySecond.get(second) || [];
    if (anchors.length) {
      for (const event of anchors) {
        const expectedId = anchorController(event);
        if (expectedId && !state.stopped) ensureController(expectedId, second);
        applyAnchor(event);
      }
      const anchorStartsTransfer = anchors.some((event) => ["pass", "restart_delivery"].includes(event.event_type));
      nextActionSecond = second + (anchorStartsTransfer ? 7 : 3 + stableHash(`anchor-${second}`) % 5);
      continue;
    }
    if (!reservedTimes.has(second) && second >= nextActionSecond && !state.stopped) makeOpenPlayAction(second);
  }
}
function addRestartChain({ add, people, peopleById, home, away, half1Seconds, period, second, team, chainId, kind, offenderId = "", fouledId = "", incidentId = "", card = "", description = "" }) {
  const matchSecond = globalSecond(period, second, half1Seconds);
  const direction = team === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
  const cornerY = stableHash(chainId) % 2 ? 32 : -32;
  const base = kind === "corner"
    ? { x: direction * 49.5, y: cornerY }
    : locationFor(team, matchSecond, home, period, stableHash(chainId) % 7);
  const opponent = team === home ? away : home;
  const takers = peopleById;
  const activeTeamPlayers = activePlayers(people, team, matchSecond, home, half1Seconds).filter((person) => person.pos !== "GK");
  const activeOpponentPlayers = activePlayers(people, opponent, matchSecond, home, half1Seconds).filter((person) => person.pos !== "GK");
  const taker = activeTeamPlayers.find((person) => person.pos === "CM") || activeTeamPlayers[0];
  const target = activeTeamPlayers.find((person) => person.pos === "ST") || activeTeamPlayers[1];
  const defender = activeOpponentPlayers.find((person) => person.pos === "CB") || activeOpponentPlayers[0];
  const offender = offenderId ? peopleById.get(offenderId) : defender;
  const fouled = fouledId ? peopleById.get(fouledId) : target;
  const offenseTeam = offender?.team || opponent;
  const offenseTeamCode = teamForPlayerId(offender?.team || "") || offenseTeam;
  const restartType = kind === "penalty" ? "penalty" : kind === "corner" ? "corner" : kind;

  const challenge = kind === "corner" ? add({
    period,
    periodSecond: Math.max(0, second - 4),
    eventType: "shot",
    action: "shot_blocked_out",
    outcome: "blocked_out_for_corner",
    teamCode: team,
    playerId: playerId(team, (activeTeamPlayers.find((person) => person.pos === "ST") || activeTeamPlayers[0]).no),
    relatedPlayerId: playerId(opponent, defender.no),
    participantIds: [playerId(team, (activeTeamPlayers.find((person) => person.pos === "ST") || activeTeamPlayers[0]).no), playerId(opponent, defender.no)],
    chainId,
    parentEventId: "",
    isShot: true,
    xg: team === home ? 0.04 : 0.02,
    shotOnTarget: false,
    bigChance: false,
    detail: `${(activeTeamPlayers.find((person) => person.pos === "ST") || activeTeamPlayers[0]).name}'s shot is blocked by ${defender.name}.`,
    commentary: `${(activeTeamPlayers.find((person) => person.pos === "ST") || activeTeamPlayers[0]).name} shoots; ${defender.name} blocks it.`,
    showInCommentary: true,
    timelineEvent: false,
    x: base.x,
    y: base.y,
    possessionAfterPlayerId: playerId(opponent, defender.no),
    possessionAfterTeamCode: opponent,
  }) : add({
    period,
    periodSecond: Math.max(0, second - 2),
    eventType: "challenge",
    action: description || "foul_committed",
    outcome: "foul",
    teamCode: offenseTeamCode,
    awardedTeamCode: team,
    playerId: playerId(offender.team, offender.no),
    relatedPlayerId: playerId(fouled.team, fouled.no),
    participantIds: [playerId(offender.team, offender.no), playerId(fouled.team, fouled.no)],
    chainId,
    incidentId,
    detail: `${offender.name} ${description || "commits a foul"} on ${fouled.name}.`,
    commentary: `${offender.name} fouls ${fouled.name}.`,
    showInCommentary: Boolean(incidentId || card),
    x: base.x,
    y: base.y,
    possessionAfterPlayerId: "",
    possessionAfterTeamCode: "",
  });

  let previous = challenge;
  if (kind === "corner") {
    const block = add({
      period,
      periodSecond: second - 3,
      eventType: "block",
      action: "defensive_block",
      outcome: "ball_deflected",
      teamCode: opponent,
      playerId: playerId(opponent, defender.no),
      relatedPlayerId: challenge.player_id,
      participantIds: [playerId(opponent, defender.no), challenge.player_id],
      chainId,
      parentEventId: challenge.event_id,
      detail: `${defender.name} blocks the shot and deflects the ball behind.`,
      commentary: `${defender.name} gets in the way; the ball runs behind.`,
      showInCommentary: true,
      x: base.x,
      y: base.y,
      possessionAfterPlayerId: "",
      possessionAfterTeamCode: "",
    });
    const out = add({
      period,
      periodSecond: second - 2,
      eventType: "ball_out",
      action: "crossed_byline",
      outcome: "corner",
      teamCode: opponent,
      awardedTeamCode: team,
      playerId: playerId(opponent, defender.no),
      relatedPlayerId: challenge.player_id,
      participantIds: [playerId(opponent, defender.no), challenge.player_id, "OFFICIAL-ar1"],
      refereeId: "OFFICIAL-ar1",
      chainId,
      parentEventId: block.event_id,
      decision: false,
      detail: `The block by ${defender.name} sends the ball over the goal line.`,
      commentary: `The ball goes behind after ${defender.name}'s block.`,
      showInCommentary: true,
      x: base.x,
      y: base.y,
      possessionAfterPlayerId: "",
      possessionAfterTeamCode: "",
    });
    previous = add({
      period,
      periodSecond: second,
      eventType: "corner_awarded",
      action: "referee_awards_corner",
      outcome: "corner_to_attacking_team",
      teamCode: team,
      awardedTeamCode: team,
      playerId: challenge.player_id,
      relatedPlayerId: playerId(opponent, defender.no),
      participantIds: [challenge.player_id, playerId(opponent, defender.no), "OFFICIAL-main"],
      refereeId: "OFFICIAL-main",
      chainId,
      parentEventId: out.event_id,
      decision: true,
      decisionType: "corner_awarded",
      decisionLabel: "Corner awarded",
      decisionDetail: `${team} awarded a corner after ${defender.name} blocked ${peopleById.get(challenge.player_id).name}'s shot over the goal line.`,
      restartType,
      timelineEvent: true,
      showInCommentary: true,
      detail: `${peopleById.get(challenge.player_id).name}'s shot is blocked by ${defender.name}, goes over the goal line; corner to ${team}.`,
      commentary: `Corner to ${team}: ${peopleById.get(challenge.player_id).name}'s shot was blocked by ${defender.name} and deflected behind.`,
      x: base.x,
      y: base.y,
      possessionAfterPlayerId: "",
      possessionAfterTeamCode: "",
    });
  } else {
    const decision = add({
      period,
      periodSecond: second,
      eventType: "foul_decision",
      action: "whistle_and_award_free_kick",
      outcome: "free_kick_awarded",
      teamCode: offenseTeamCode,
      awardedTeamCode: team,
      playerId: playerId(offender.team, offender.no),
      relatedPlayerId: playerId(fouled.team, fouled.no),
      targetPlayerId: playerId(offender.team, offender.no),
      participantIds: [playerId(offender.team, offender.no), playerId(fouled.team, fouled.no), "OFFICIAL-main"],
      refereeId: "OFFICIAL-main",
      chainId,
      parentEventId: challenge.event_id,
      decision: true,
      decisionType: "free_kick_awarded",
      decisionLabel: "Free kick awarded",
      decisionDetail: `${team} awarded a ${kind.replaceAll("_", " ")} for a foul by ${offender.name} on ${fouled.name}.`,
      restartType,
      countsAsFoul: true,
      timelineEvent: true,
      showInCommentary: true,
      incidentId,
      detail: `${offender.name} fouls ${fouled.name}; referee awards ${kind.replaceAll("_", " ")} to ${team}.`,
      commentary: `Free kick to ${team}. ${offender.name} is penalised for a foul on ${fouled.name}.`,
      x: base.x,
      y: base.y,
      possessionAfterPlayerId: "",
      possessionAfterTeamCode: "",
    });
    previous = decision;
    if (card) {
      previous = add({
        period,
        periodSecond: second + 1,
        eventType: "card_shown",
        action: "shown_by_referee",
        outcome: card,
        teamCode: offenseTeamCode,
        playerId: playerId(offender.team, offender.no),
        relatedPlayerId: playerId(fouled.team, fouled.no),
        targetPlayerId: playerId(offender.team, offender.no),
        participantIds: [playerId(offender.team, offender.no), "OFFICIAL-main"],
        refereeId: "OFFICIAL-main",
        chainId,
        parentEventId: decision.event_id,
        decision: true,
        decisionType: "card",
        decisionLabel: `${card === "yellow" ? "Yellow" : "Red"} card shown`,
        decisionDetail: `The referee shows ${offender.name} a ${card} card.`,
        timelineEvent: true,
        showInCommentary: true,
        incidentId,
        detail: `The referee shows ${offender.name} a ${card} card.`,
        commentary: `${card === "yellow" ? "Yellow" : "Red"} card for ${offender.name}.`,
        x: base.x,
        y: base.y,
        possessionAfterPlayerId: "",
        possessionAfterTeamCode: "",
      });
    }
  }

  if (kind === "penalty") return { challenge, restart: previous };

  const delivery = add({
    period,
    periodSecond: second + (kind === "corner" ? 12 : card ? 10 : 8),
    eventType: "restart_delivery",
    action: kind === "corner" ? "corner_delivery" : "free_kick_delivery",
    outcome: "delivered_to_teammate",
    teamCode: team,
    playerId: playerId(team, taker.no),
    relatedPlayerId: playerId(team, target.no),
    participantIds: [playerId(team, taker.no), playerId(team, target.no)],
    chainId,
    parentEventId: previous.event_id,
    restartType,
    timelineEvent: true,
    detail: `${taker.name} takes the ${kind.replaceAll("_", " ")} and delivers toward ${target.name}.`,
    commentary: `${taker.name} delivers the ${kind.replaceAll("_", " ")} toward ${target.name}.`,
    showInCommentary: true,
    x: kind === "corner" ? (team === home ? (period === 1 ? 50 : -50) : (period === 1 ? -50 : 50)) : base.x,
    y: kind === "corner" ? (stableHash(chainId) % 2 ? 32 : -32) : base.y,
    targetX: base.x,
    targetY: base.y,
    possessionAfterPlayerId: playerId(team, taker.no),
    possessionAfterTeamCode: team,
  });
  const clearance = add({
    period,
    periodSecond: second + (kind === "corner" ? 15 : card ? 13 : 11),
    eventType: kind === "corner" ? "aerial_duel" : "restart_resolution",
    action: kind === "corner" ? "corner_header_contested" : "free_kick_cleared",
    outcome: kind === "corner" ? "defender_wins_aerial" : "defender_clears_delivery",
    teamCode: opponent,
    playerId: playerId(team, target.no),
    relatedPlayerId: playerId(opponent, defender.no),
    participantIds: [playerId(team, target.no), playerId(opponent, defender.no)],
    chainId,
    parentEventId: delivery.event_id,
    timelineEvent: true,
    detail: `${defender.name} beats ${target.name} to the delivery and clears the ball.`,
    commentary: `${defender.name} beats ${target.name} to the ball and clears.`,
    showInCommentary: true,
    x: base.x,
    y: base.y,
    possessionAfterPlayerId: playerId(opponent, defender.no),
    possessionAfterTeamCode: opponent,
  });
  clearance.duel_won = "true";
  return { challenge, restart: previous, delivery, resolution: clearance };
}

function buildDetailedEvents({ people, home, away, half1Seconds, half2Seconds }) {
  const peopleById = new Map(people.filter((person) => !person.role).map((person) => [playerId(person.team, person.no), person]));
  const { add, events } = makeEventFactory({ home, away, half1Seconds, half2Seconds, peopleById });
  const start = add({
    period: 1, periodSecond: 0, eventType: "phase", action: "kick_off", outcome: "match_started",
    teamCode: home, playerId: playerId(home, 16), phase: "kick_off", detail: "Match started.",
    x: 0, y: 0, possessionAfterPlayerId: playerId(home, 16), possessionAfterTeamCode: home,
  });
  void start;

  const addOpenPlayGoal = (period, second, team, scorerNo, assisterNo, xg, chainId, incidentId = "") => {
    const scorer = peopleById.get(playerId(team, scorerNo));
    const assister = peopleById.get(playerId(team, assisterNo));
    const opponent = team === home ? away : home;
    const goalkeeper = people.find((person) => person.team === opponent && person.pos === "GK");
    const at = locationFor(team, globalSecond(period, second, half1Seconds), home, period, scorerNo);
    const pass = add({
      period, periodSecond: second - 2, eventType: "pass", action: "through_ball", outcome: "completed",
      teamCode: team, playerId: playerId(team, assisterNo), relatedPlayerId: playerId(team, scorerNo),
      participantIds: [playerId(team, assisterNo), playerId(team, scorerNo)], chainId,
      passCompleted: true, detail: `${assister.name} threads a pass into ${scorer.name}.`,
      commentary: `${assister.name} releases ${scorer.name} with a through ball.`, showInCommentary: true,
      x: at.x - (team === home ? 6 : -6), y: at.y - 2, targetX: at.x, targetY: at.y,
      possessionAfterPlayerId: playerId(team, scorerNo), possessionAfterTeamCode: team,
    });
    const shot = add({
      period, periodSecond: second - 1, eventType: "shot", action: "open_play_shot", outcome: "goal",
      teamCode: team, playerId: playerId(team, scorerNo), relatedPlayerId: playerId(team, assisterNo),
      goalkeeperId: playerId(opponent, goalkeeper.no), participantIds: [playerId(team, scorerNo), playerId(opponent, goalkeeper.no)],
      chainId, parentEventId: pass.event_id, isShot: true, shotOnTarget: true, bigChance: true, xg,
      incidentId, detail: `${scorer.name} shoots and scores, assisted by ${assister.name}.`,
      commentary: `${scorer.name} scores for ${team} after ${assister.name}'s pass.`, showInCommentary: true,
      timelineEvent: false, x: at.x, y: at.y, targetX: team === home ? 52 : -52, targetY: 0,
      possessionAfterPlayerId: playerId(team, scorerNo), possessionAfterTeamCode: team,
    });
    return add({
      period, periodSecond: second, eventType: "goal", action: "goal_confirmed", outcome: "scored",
      teamCode: team, playerId: playerId(team, scorerNo), relatedPlayerId: playerId(team, assisterNo),
      participantIds: [playerId(team, scorerNo), playerId(team, assisterNo)], chainId,
      parentEventId: shot.event_id, scoreDelta: 1,
      detail: `${scorer.name} scores for ${team}.`, commentary: `GOAL ${team}. ${scorer.name} finishes ${assister ? `from ${assister.name}'s pass` : ""}.`,
      showInCommentary: true, timelineEvent: true, x: at.x, y: at.y,
      possessionAfterPlayerId: playerId(team, scorerNo), possessionAfterTeamCode: team,
    });
  };

  add({ period: 1, periodSecond: half1Seconds, eventType: "phase", phase: "half_time", action: "half_time_whistle", outcome: "first_half_ended", teamCode: "", detail: "Half-time." , clockLabel: "45+1:00", timelineEvent: false });
  add({ period: 2, periodSecond: 0, eventType: "phase", phase: "second_half", action: "second_half_started", outcome: "second_half_started", teamCode: home, detail: "Second half started." });

  addOpenPlayGoal(1, 23 * 60, home, 47, 17, 0.25, "goal-mci-23");

  // The offside incident is a complete pass → shot → flag → VAR review → disallowed goal chain.
  const offsideAt = 27 * 60 + 10;
  const offsideLoc = locationFor(away, offsideAt, home, 1, 9);
  const offsideRecovery = add({
    period: 1, periodSecond: offsideAt - 4, eventType: "ball_recovery", action: "pressing_recovery", outcome: "won",
    teamCode: away, playerId: playerId(away, 8), relatedPlayerId: playerId(home, 9),
    participantIds: [playerId(away, 8), playerId(home, 9)], chainId: "incident-offside",
    incidentId: "offside", duelWon: true, detail: "Odegaard presses and wins the ball before the transition.",
    x: offsideLoc.x - 3, y: offsideLoc.y, targetX: offsideLoc.x - 2, targetY: offsideLoc.y,
    possessionAfterPlayerId: playerId(away, 8), possessionAfterTeamCode: away,
  });
  offsideRecovery._priority = -20;
  const offsidePass = add({
    period: 1, periodSecond: offsideAt - 3, eventType: "pass", action: "through_ball", outcome: "completed",
    teamCode: away, playerId: playerId(away, 8), relatedPlayerId: playerId(away, 9),
    participantIds: [playerId(away, 8), playerId(away, 9)], chainId: "incident-offside",
    passCompleted: true, incidentId: "offside", detail: "Odegaard releases Jesus in behind.",
    commentary: "Odegaard threads the ball through for Jesus.", showInCommentary: true,
    x: offsideLoc.x - 4, y: offsideLoc.y, targetX: offsideLoc.x, targetY: offsideLoc.y,
    possessionAfterPlayerId: playerId(away, 9), possessionAfterTeamCode: away,
  });
  add({
    period: 1, periodSecond: offsideAt - 2, eventType: "carry", action: "first_touch_control",
    outcome: "controlled_in_stride", teamCode: away, playerId: playerId(away, 9),
    relatedPlayerId: playerId(away, 8), participantIds: [playerId(away, 9), playerId(away, 8)],
    chainId: "incident-offside", parentEventId: offsidePass.event_id, incidentId: "offside",
    detail: "Jesus cushions the through ball into his stride.", x: offsideLoc.x, y: offsideLoc.y,
    possessionAfterPlayerId: playerId(away, 9), possessionAfterTeamCode: away,
  });
  const disallowedShot = add({
    period: 1, periodSecond: offsideAt - 1, eventType: "shot", action: "shot_before_offside_whistle", outcome: "goal_disallowed",
    teamCode: away, playerId: playerId(away, 9), goalkeeperId: playerId(home, 31),
    participantIds: [playerId(away, 9), playerId(home, 31)], chainId: "incident-offside",
    parentEventId: offsidePass.event_id, incidentId: "offside", isShot: true, shotOnTarget: true,
    bigChance: true, xg: 0.31, countInStats: false, detail: "Jesus shoots into the net; the flag is raised for offside.",
    commentary: "Jesus scores, but the assistant's flag is raised for offside.", showInCommentary: true,
    x: offsideLoc.x, y: offsideLoc.y, targetX: -52, targetY: 0,
  });
  const disallowedGoal = add({
    period: 1, periodSecond: offsideAt - 1, eventType: "goal", action: "goal_disallowed_for_offside", outcome: "disallowed",
    teamCode: away, playerId: playerId(away, 9), participantIds: [playerId(away, 9)], chainId: "incident-offside",
    parentEventId: disallowedShot.event_id, incidentId: "offside", scoreDelta: 0, timelineEvent: true,
    detail: "Jesus's finish is ruled out for offside.", commentary: "The goal is ruled out for offside.", showInCommentary: true,
    x: offsideLoc.x, y: offsideLoc.y,
  });
  const offsideCall = add({
    period: 1, periodSecond: offsideAt, eventType: "offside_decision", action: "assistant_flags_offside",
    outcome: "offside_given", teamCode: away, playerId: playerId(away, 9), participantIds: [playerId(away, 9), "OFFICIAL-ar1"],
    refereeId: "OFFICIAL-ar1", chainId: "incident-offside", parentEventId: disallowedShot.event_id,
    decision: true, decisionType: "offside", decisionLabel: "Offside given",
    decisionDetail: "The assistant referee flags Jesus offside; a free kick is awarded to MCI.",
    awardedTeamCode: home, restartType: "indirect_free_kick", incidentId: "offside",
    detail: "The assistant referee flags Jesus offside; MCI receive an indirect free kick.",
    commentary: "Offside against Jesus. MCI restart with an indirect free kick.", showInCommentary: true,
    timelineEvent: true, x: offsideLoc.x, y: offsideLoc.y,
  });
  add({
    period: 1, periodSecond: offsideAt + 3, eventType: "var_review", action: "check_goal_for_offside",
    outcome: "goal_disallowed", teamCode: away, playerId: playerId(away, 9),
    participantIds: [playerId(away, 9), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: "incident-offside", parentEventId: offsideCall.event_id, incidentId: "offside",
    detail: "VAR checks the offside phase; the goal is disallowed and the score remains unchanged.",
    commentary: "VAR confirms the offside; the goal is disallowed.", showInCommentary: true,
    timelineEvent: true, x: offsideLoc.x, y: offsideLoc.y,
  });

  // 11 corners. Each one has an identified shot, defender's block, ball over the line,
  // referee award, delivery, aerial contest, and clearance.
  const cornerPlans = [
    { period: 1, second: 7 * 60 + 12, team: home },
    { period: 1, second: 10 * 60 + 30, team: away },
    { period: 1, second: 14 * 60 + 38, team: home },
    { period: 1, second: 29 * 60 + 38, team: away },
    { period: 1, second: 32 * 60 + 20, team: home },
    { period: 2, second: 4 * 60 + 48, team: away },
    { period: 2, second: 8 * 60 + 10, team: home },
    { period: 2, second: 13 * 60 + 52, team: away },
    { period: 2, second: 18 * 60 + 30, team: home },
    { period: 2, second: 27 * 60 + 40, team: home },
    { period: 2, second: 35 * 60, team: home },
  ];
  cornerPlans.forEach((plan, index) => addRestartChain({
    add, people, peopleById, home, away, half1Seconds, period: plan.period, second: plan.second,
    team: plan.team, chainId: `corner-${String(index + 1).padStart(2, "0")}`, kind: "corner",
  }));

  // An ordinary first-half caution and the remaining free-kick chains are generated
  // from explicit offender/victim pairs. The foul count is team-specific and auditable.
  const foulSpecs = [
    { period: 1, second: 5 * 60 + 18, offender: playerId(away, 4), fouled: playerId(home, 20), text: "holds" },
    { period: 1, second: 12 * 60 + 7, offender: playerId(away, 4), fouled: playerId(home, 47), text: "clips" },
    { period: 1, second: 18 * 60 + 44, offender: playerId(away, 5), fouled: playerId(home, 17), text: "catches" },
    { period: 1, second: 21 * 60 + 9, offender: playerId(home, 3), fouled: playerId(away, 7), text: "pulls back" },
    { period: 1, second: 25 * 60 + 56, offender: playerId(away, 6), fouled: playerId(home, 9), text: "trips" },
    { period: 1, second: 33 * 60 + 11, offender: playerId(home, 2), fouled: playerId(away, 11), text: "blocks the run of" },
    { period: 1, second: 37 * 60 + 42, offender: playerId(away, 8), fouled: playerId(home, 16), text: "pushes" },
    { period: 1, second: 41 * 60, offender: playerId(away, 5), fouled: playerId(home, 17), card: "yellow", text: "makes a late challenge on" },
    { period: 1, second: 43 * 60 + 3, offender: playerId(home, 16), fouled: playerId(away, 8), text: "obstructs" },
    { period: 2, second: 3 * 60 + 41, offender: playerId(away, 4), fouled: playerId(home, 20), text: "catches" },
    { period: 2, second: 6 * 60 + 27, offender: playerId(home, 25), fouled: playerId(away, 11), text: "holds" },
    { period: 2, second: 9 * 60 + 56, offender: playerId(away, 35), fouled: playerId(home, 47), text: "clips" },
    { period: 2, second: 12 * 60 + 23, offender: playerId(home, 17), fouled: playerId(away, 7), text: "pulls back" },
    { period: 2, second: 15 * 60 + 3, offender: playerId(away, 2), fouled: playerId(home, 9), text: "holds" },
    { period: 2, second: 17 * 60 + 4, offender: playerId(home, 3), fouled: playerId(away, 9), text: "trips" },
    { period: 2, second: 21 * 60 + 13, offender: playerId(away, 41), fouled: playerId(home, 16), text: "checks" },
    { period: 2, second: 23 * 60 + 6, offender: playerId(home, 2), fouled: playerId(away, 11), text: "blocks the run of" },
    { period: 2, second: 26 * 60 + 19, offender: playerId(away, 5), fouled: playerId(home, 20), card: "yellow", text: "catches" },
    { period: 2, second: 29 * 60 + 48, offender: playerId(home, 25), fouled: playerId(away, 7), text: "pulls back" },
    { period: 2, second: 33 * 60 + 5, offender: playerId(away, 6), fouled: playerId(home, 9), text: "trips" },
    { period: 2, second: 40 * 60 + 8, offender: playerId(away, 8), fouled: playerId(home, 20), text: "holds" },
    { period: 2, second: 43 * 60 + 20, offender: playerId(home, 3), fouled: playerId(away, 11), text: "obstructs" },
  ];
  foulSpecs.forEach((foul, index) => {
    const offender = peopleById.get(foul.offender);
    const fouled = peopleById.get(foul.fouled);
    addRestartChain({
      add, people, peopleById, home, away, half1Seconds, period: foul.period, second: foul.second,
      team: fouled.team, chainId: `foul-${String(index + 1).padStart(2, "0")}`,
      kind: "direct_free_kick", offenderId: foul.offender, fouledId: foul.fouled,
      card: foul.card || "", description: foul.text,
    });
  });

  // Match score: one open-play goal each and a City penalty goal.
  addOpenPlayGoal(2, 60, away, 7, 8, 0.16, "goal-ars-47");

  // A penalty is a referee decision; the kick and its result are separate non-decision events.
  const penaltyGoalChain = "penalty-mci-66";
  const penaltyFoul = add({
    period: 2, periodSecond: 19 * 60 + 55, eventType: "challenge", action: "foul_in_penalty_area",
    outcome: "penalty_offence", teamCode: away, awardedTeamCode: home,
    playerId: playerId(away, 6), relatedPlayerId: playerId(home, 9),
    participantIds: [playerId(away, 6), playerId(home, 9)], chainId: penaltyGoalChain,
    detail: "Gabriel catches Haaland inside the penalty area.",
    commentary: "Gabriel makes contact with Haaland in the penalty area.", showInCommentary: true,
    x: 45, y: 4,
  });
  const award = add({
    period: 2, periodSecond: 19 * 60 + 56, eventType: "penalty_awarded", action: "whistle_for_penalty",
    outcome: "penalty_to_mci", teamCode: home, awardedTeamCode: home,
    playerId: playerId(away, 6), relatedPlayerId: playerId(home, 9), targetPlayerId: playerId(away, 6),
    participantIds: [playerId(away, 6), playerId(home, 9), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: penaltyGoalChain, parentEventId: penaltyFoul.event_id, decision: true,
    decisionType: "penalty_awarded", decisionLabel: "Penalty awarded",
    decisionDetail: "Penalty to MCI; Gabriel is penalised for a foul on Haaland.",
    countsAsFoul: true, restartType: "penalty", incidentId: "",
    detail: "Referee awards MCI a penalty for Gabriel's foul on Haaland.",
    commentary: "Penalty to MCI. Gabriel fouls Haaland inside the box.", showInCommentary: true,
    timelineEvent: true, x: 46, y: 4,
  });
  const penaltyShot = add({
    period: 2, periodSecond: 20 * 60 - 1, eventType: "penalty_attempt", action: "penalty_kick",
    outcome: "scored", teamCode: home, playerId: playerId(home, 9), goalkeeperId: playerId(away, 22),
    participantIds: [playerId(home, 9), playerId(away, 22)], chainId: penaltyGoalChain,
    parentEventId: award.event_id, restartType: "penalty", isShot: true, shotOnTarget: true,
    bigChance: true, xg: 0.79, detail: "Haaland takes the penalty and scores.",
    commentary: "Haaland converts the penalty for MCI.", showInCommentary: true, timelineEvent: true, x: 50, y: 0,
    targetX: 52, targetY: 0, possessionAfterPlayerId: playerId(home, 9), possessionAfterTeamCode: home,
  });
  add({
    period: 2, periodSecond: 20 * 60, eventType: "goal", action: "penalty_goal_confirmed",
    outcome: "scored", teamCode: home, playerId: playerId(home, 9), participantIds: [playerId(home, 9)],
    chainId: penaltyGoalChain, parentEventId: penaltyShot.event_id, scoreDelta: 1,
    restartType: "penalty", detail: "Haaland scores from the penalty spot for MCI.",
    commentary: "GOAL MCI. Haaland scores from the penalty spot.", showInCommentary: true, timelineEvent: true,
    x: 50, y: 0,
  });

  // Substitution is an atomic state transition at 70:00: Kovacic enters as Gundogan leaves.
  add({
    period: 2, periodSecond: 24 * 60, eventType: "substitution", action: "player_on_for_player",
    outcome: "completed", teamCode: home, playerId: playerId(home, 8), relatedPlayerId: playerId(home, 19),
    participantIds: [playerId(home, 8), playerId(home, 19), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: "substitution-mci-70", decision: false, decisionType: "",
    decisionLabel: "", decisionDetail: "",
    timelineEvent: true, showInCommentary: true, detail: "Kovacic replaces Gundogan for MCI.",
    commentary: "MCI substitution: Kovacic on for Gundogan.", x: 0, y: 0,
  });

  // Penalty incident: contact, VAR check, award, then saved kick (the save is not a decision).
  const handballChain = "incident-handball-74";
  const handballAt = 28 * 60 + 5;
  const handball = add({
    period: 2, periodSecond: handballAt - 2, eventType: "handball_contact", action: "ball_hits_arm_in_box",
    outcome: "handball_appeal", teamCode: home, awardedTeamCode: away,
    playerId: playerId(home, 25), relatedPlayerId: playerId(away, 7),
    participantIds: [playerId(home, 25), playerId(away, 7)], chainId: handballChain,
    incidentId: "handball", detail: "The ball strikes Akanji's arm in the penalty area after Saka's cross.",
    commentary: "Saka's cross strikes Akanji's arm inside the box.", showInCommentary: true,
    x: -45, y: -5,
  });
  const handballCheck = add({
    period: 2, periodSecond: handballAt - 1, eventType: "var_review", action: "check_handball_in_penalty_area",
    outcome: "review_complete", teamCode: away, playerId: playerId(home, 25), relatedPlayerId: playerId(away, 7),
    participantIds: [playerId(home, 25), playerId(away, 7), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: handballChain, parentEventId: handball.event_id, incidentId: "handball",
    detail: "VAR checks the handball incident before the referee makes a decision.",
    commentary: "VAR checks the handball incident in the penalty area.", showInCommentary: true,
    timelineEvent: true, x: -45, y: -5,
  });
  const handballAward = add({
    period: 2, periodSecond: handballAt, eventType: "penalty_awarded", action: "whistle_for_penalty_after_review",
    outcome: "penalty_to_ars", teamCode: away, awardedTeamCode: away,
    playerId: playerId(home, 25), relatedPlayerId: playerId(away, 7), targetPlayerId: playerId(home, 25),
    participantIds: [playerId(home, 25), playerId(away, 7), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: handballChain, parentEventId: handballCheck.event_id, decision: true,
    decisionType: "penalty_awarded", decisionLabel: "Penalty awarded",
    decisionDetail: "Penalty to ARS after the referee awards a handball offence against Akanji.",
    countsAsFoul: true, restartType: "penalty", incidentId: "handball",
    detail: "Referee awards ARS a penalty for handball by Akanji.",
    commentary: "Penalty to ARS for handball by Akanji.", showInCommentary: true,
    timelineEvent: true, x: -46, y: -5,
  });
  const savedPenalty = add({
    period: 2, periodSecond: handballAt + 20, eventType: "penalty_attempt", action: "penalty_kick",
    outcome: "saved", teamCode: away, playerId: playerId(away, 7), goalkeeperId: playerId(home, 31),
    participantIds: [playerId(away, 7), playerId(home, 31)], chainId: handballChain,
    parentEventId: handballAward.event_id, restartType: "penalty", isShot: true, shotOnTarget: true,
    bigChance: true, xg: 0.76, incidentId: "handball", detail: "Saka takes the penalty; Ederson saves it.",
    commentary: "Saka's penalty is saved by Ederson.", showInCommentary: true, timelineEvent: true,
    x: -50, y: 0, targetX: -52, targetY: 0,
    possessionAfterPlayerId: playerId(home, 31), possessionAfterTeamCode: home,
  });
  const penaltySave = add({
    period: 2, periodSecond: handballAt + 20, eventType: "save", action: "goalkeeper_save",
    outcome: "penalty_saved", teamCode: home, playerId: playerId(home, 31), relatedPlayerId: playerId(away, 7),
    participantIds: [playerId(home, 31), playerId(away, 7)], chainId: handballChain,
    parentEventId: savedPenalty.event_id, countsAsSave: true, incidentId: "handball",
    detail: "Ederson saves Saka's penalty.", commentary: "Ederson keeps out Saka's penalty.", showInCommentary: true,
    x: -51, y: 0, possessionAfterPlayerId: playerId(home, 31), possessionAfterTeamCode: home,
  });
  void penaltySave;

  // Tackle incident at 77:38: tackle → whistle/free kick → yellow card → VAR check → card upheld.
  const tackleChain = "incident-tackle-77";
  const tackleAt = 31 * 60 + 38;
  const tackleLoc = locationFor(home, globalSecond(2, tackleAt, half1Seconds), home, 2, 24);
  const tackleRecovery = add({
    period: 2, periodSecond: tackleAt - 4, eventType: "ball_recovery", action: "tackle_recovery", outcome: "won",
    teamCode: away, playerId: playerId(away, 7), relatedPlayerId: playerId(home, 8),
    participantIds: [playerId(away, 7), playerId(home, 8)], chainId: tackleChain,
    incidentId: "tackle", duelWon: true,
    detail: "Saka wins the ball from Kovacic and starts the attacking transition.",
    x: tackleLoc.x, y: tackleLoc.y, possessionAfterPlayerId: playerId(away, 7), possessionAfterTeamCode: away,
  });
  tackleRecovery._priority = -20;
  for (const offset of [3, 2]) add({
    period: 2, periodSecond: tackleAt - offset, eventType: "carry", action: "progressive_carry",
    outcome: "progressed", teamCode: away, playerId: playerId(away, 7), participantIds: [playerId(away, 7)],
    chainId: tackleChain, incidentId: "tackle", detail: "Saka drives forward with the ball as Gvardiol closes him down.",
    x: tackleLoc.x, y: tackleLoc.y, possessionAfterPlayerId: playerId(away, 7), possessionAfterTeamCode: away,
  });
  const tackle = add({
    period: 2, periodSecond: tackleAt - 1, eventType: "challenge", action: "sliding_tackle",
    outcome: "foul", teamCode: home, playerId: playerId(home, 24), relatedPlayerId: playerId(away, 7),
    participantIds: [playerId(home, 24), playerId(away, 7)], chainId: tackleChain,
    incidentId: "tackle", detail: "Gvardiol slides into Saka and commits a foul.",
    commentary: "Gvardiol slides in on Saka; the referee whistles for a foul.", showInCommentary: true,
    x: tackleLoc.x, y: tackleLoc.y,
  });
  const tackleCall = add({
    period: 2, periodSecond: tackleAt, eventType: "foul_decision", action: "whistle_and_award_free_kick",
    outcome: "free_kick_to_ars", teamCode: home, awardedTeamCode: away,
    playerId: playerId(home, 24), relatedPlayerId: playerId(away, 7), targetPlayerId: playerId(home, 24),
    participantIds: [playerId(home, 24), playerId(away, 7), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: tackleChain, parentEventId: tackle.event_id, decision: true,
    decisionType: "free_kick_awarded", decisionLabel: "Free kick awarded",
    decisionDetail: "ARS receive a free kick after Gvardiol fouls Saka.", countsAsFoul: true,
    restartType: "direct_free_kick", incidentId: "tackle", timelineEvent: true,
    detail: "Referee awards ARS a free kick for Gvardiol's foul on Saka.",
    commentary: "Free kick to ARS after Gvardiol's foul on Saka.", showInCommentary: true,
    x: tackleLoc.x, y: tackleLoc.y,
  });
  const tackleCard = add({
    period: 2, periodSecond: tackleAt + 1, eventType: "card_shown", action: "shown_by_referee",
    outcome: "yellow", teamCode: home, playerId: playerId(home, 24), relatedPlayerId: playerId(away, 7),
    targetPlayerId: playerId(home, 24), participantIds: [playerId(home, 24), "OFFICIAL-main"],
    refereeId: "OFFICIAL-main", chainId: tackleChain, parentEventId: tackleCall.event_id,
    decision: true, decisionType: "card", decisionLabel: "Yellow card shown",
    decisionDetail: "The referee shows Gvardiol a yellow card for the tackle on Saka.",
    incidentId: "tackle", timelineEvent: true, showInCommentary: true,
    detail: "The referee shows Gvardiol a yellow card for the tackle on Saka.",
    commentary: "Yellow card for Gvardiol after the tackle on Saka.", x: tackleLoc.x, y: tackleLoc.y,
  });
  const tackleReview = add({
    period: 2, periodSecond: tackleAt + 5, eventType: "var_review", action: "check_tackle_and_card",
    outcome: "yellow_card_upheld", teamCode: home, playerId: playerId(home, 24), relatedPlayerId: playerId(away, 7),
    participantIds: [playerId(home, 24), playerId(away, 7), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: tackleChain, parentEventId: tackleCard.event_id, incidentId: "tackle",
    detail: "VAR reviews the tackle; the on-field yellow card stands.",
    commentary: "VAR checks the tackle; the yellow card stands.", showInCommentary: true,
    timelineEvent: true, x: tackleLoc.x, y: tackleLoc.y,
  });
  const tackleRestart = add({
    period: 2, periodSecond: tackleAt + 14, eventType: "restart_delivery", action: "free_kick_delivery",
    outcome: "played_short", teamCode: away, playerId: playerId(away, 8), relatedPlayerId: playerId(away, 7),
    participantIds: [playerId(away, 8), playerId(away, 7)], chainId: tackleChain,
    parentEventId: tackleReview.event_id, restartType: "direct_free_kick",
    timelineEvent: true,
    detail: "Odegaard restarts play with a short pass to Saka.",
    commentary: "Odegaard takes the free kick short to Saka.", showInCommentary: true,
    x: tackleLoc.x, y: tackleLoc.y, targetX: tackleLoc.x + 5, targetY: tackleLoc.y + 3,
    possessionAfterPlayerId: playerId(away, 7), possessionAfterTeamCode: away,
  });
  add({
    period: 2, periodSecond: tackleAt + 16, eventType: "restart_resolution", action: "free_kick_played_short",
    outcome: "possession_retained", teamCode: away, playerId: playerId(away, 7), relatedPlayerId: playerId(away, 9),
    participantIds: [playerId(away, 7), playerId(away, 9)], chainId: tackleChain, parentEventId: tackleRestart.event_id,
    timelineEvent: true,
    detail: "Saka moves the ball to Jesus after the free kick.", commentary: "Saka plays the free kick on to Jesus.",
    showInCommentary: true, x: tackleLoc.x + 5, y: tackleLoc.y + 3,
    possessionAfterPlayerId: playerId(away, 9), possessionAfterTeamCode: away,
  });

  // Conflict incident follows the tackle: players confront each other, then the referee warns them.
  const conflictAt = 32 * 60 + 14;
  const conflict = add({
    period: 2, periodSecond: conflictAt, eventType: "confrontation", action: "players_confront_after_whistle",
    outcome: "players_separated", teamCode: home, playerId: playerId(home, 24), relatedPlayerId: playerId(away, 9),
    participantIds: [playerId(home, 24), playerId(away, 9), playerId(away, 7)], chainId: "incident-conflict-78",
    incidentId: "conflict", detail: "Gvardiol and Jesus confront each other after the whistle; nearby players join the exchange.",
    commentary: "Gvardiol and Jesus confront each other after the whistle; teammates move in.",
    showInCommentary: true, x: tackleLoc.x, y: tackleLoc.y,
  });
  add({
    period: 2, periodSecond: conflictAt + 5, eventType: "misconduct_warning", action: "referee_verbal_warning",
    outcome: "warning_no_card", teamCode: home, playerId: playerId(home, 24), relatedPlayerId: playerId(away, 9),
    participantIds: [playerId(home, 24), playerId(away, 9), "OFFICIAL-main"], refereeId: "OFFICIAL-main",
    chainId: "incident-conflict-78", parentEventId: conflict.event_id, incidentId: "conflict",
    decision: true, decisionType: "misconduct_warning", decisionLabel: "Verbal warning",
    decisionDetail: "The referee separates the players and gives both a verbal warning; no card is shown.",
    timelineEvent: true, showInCommentary: true,
    detail: "The referee separates Gvardiol and Jesus and gives both a verbal warning.",
    commentary: "The referee separates the players and warns both captains; no card is shown.",
    x: tackleLoc.x, y: tackleLoc.y,
  });

  // Other open-play attempts bring the current (78:32) shot totals to 14–9,
  // including the 11 blocked shots which won the corners and the two penalty kicks.
  const regularShots = [
    { period: 1, second: 12 * 60, team: home, shooter: 20, outcome: "wide", xg: 0.10, on: false },
    { period: 1, second: 17 * 60 + 48, team: away, shooter: 11, outcome: "wide", xg: 0.02, on: false },
    { period: 1, second: 39 * 60 + 20, team: home, shooter: 9, outcome: "saved", xg: 0.14, on: true, big: true },
    { period: 2, second: 10 * 60 + 45, team: home, shooter: 47, outcome: "saved", xg: 0.12, on: true },
    { period: 2, second: 16 * 60 + 10, team: away, shooter: 9, outcome: "saved", xg: 0.08, on: true },
    { period: 2, second: 30 * 60 + 20, team: home, shooter: 9, outcome: "saved", xg: 0.08, on: true },
    { period: 2, second: 36 * 60 + 12, team: away, shooter: 11, outcome: "wide", xg: 0.02, on: false },
    { period: 2, second: 37 * 60 + 15, team: home, shooter: 47, outcome: "wide", xg: 0.08, on: false, big: true },
  ];
  regularShots.forEach((shot, index) => {
    const opponent = shot.team === home ? away : home;
    const keeper = people.find((person) => person.team === opponent && person.pos === "GK");
    const shooter = peopleById.get(playerId(shot.team, shot.shooter));
    const loc = locationFor(shot.team, globalSecond(shot.period, shot.second, half1Seconds), home, shot.period, index + 8);
    const chainId = `shot-${String(index + 1).padStart(2, "0")}`;
    const action = add({
      period: shot.period, periodSecond: shot.second, eventType: "shot", action: "open_play_shot",
      outcome: shot.outcome, teamCode: shot.team, playerId: playerId(shot.team, shot.shooter),
      goalkeeperId: shot.outcome === "saved" ? playerId(opponent, keeper.no) : "",
      participantIds: [playerId(shot.team, shot.shooter), ...(shot.outcome === "saved" ? [playerId(opponent, keeper.no)] : [])],
      chainId, isShot: true, shotOnTarget: shot.on, bigChance: Boolean(shot.big), xg: shot.xg,
      detail: `${shooter.name} shoots ${shot.outcome === "wide" ? "wide" : "on target"}${shot.outcome === "saved" ? `; ${keeper.name} saves` : ""}.`,
      commentary: `${shooter.name} shoots ${shot.outcome === "wide" ? "wide" : "on target"}${shot.outcome === "saved" ? `; ${keeper.name} saves` : ""}.`,
      showInCommentary: shot.outcome === "saved" || Boolean(shot.big), timelineEvent: false,
      x: loc.x, y: loc.y, targetX: shot.team === home ? 52 : -52, targetY: 0,
      possessionAfterPlayerId: shot.outcome === "saved" ? playerId(opponent, keeper.no) : playerId(opponent, keeper.no),
      possessionAfterTeamCode: opponent,
    });
    if (shot.outcome === "saved") add({
      period: shot.period, periodSecond: shot.second + 1, eventType: "save", action: "goalkeeper_save",
      outcome: "shot_saved", teamCode: opponent, playerId: playerId(opponent, keeper.no),
      relatedPlayerId: playerId(shot.team, shot.shooter), participantIds: [playerId(opponent, keeper.no), playerId(shot.team, shot.shooter)],
      chainId, parentEventId: action.event_id, countsAsSave: true,
      detail: `${keeper.name} saves ${shooter.name}'s shot.`, commentary: `${keeper.name} makes the save.`,
      showInCommentary: false, x: loc.x, y: loc.y,
      possessionAfterPlayerId: playerId(opponent, keeper.no), possessionAfterTeamCode: opponent,
    });
  });

  // The indirect-free-kick restart after the offside call has its own delivery and resolution.
  const offsideDelivery = add({
    period: 1, periodSecond: offsideAt + 7, eventType: "restart_delivery", action: "indirect_free_kick_delivery",
    outcome: "delivered", teamCode: home, playerId: playerId(home, 17), relatedPlayerId: playerId(home, 3),
    participantIds: [playerId(home, 17), playerId(home, 3)], chainId: "incident-offside",
    parentEventId: offsideCall.event_id, restartType: "indirect_free_kick", incidentId: "offside",
    timelineEvent: true,
    detail: "De Bruyne takes the indirect free kick toward Dias.",
    commentary: "De Bruyne takes the indirect free kick toward Dias.", showInCommentary: true,
    x: offsideLoc.x, y: offsideLoc.y, targetX: offsideLoc.x + 4, targetY: offsideLoc.y + 2,
  });
  add({
    period: 1, periodSecond: offsideAt + 9, eventType: "restart_resolution", action: "indirect_free_kick_cleared",
    outcome: "defender_clears_delivery", teamCode: home, playerId: playerId(home, 3), relatedPlayerId: playerId(away, 6),
    participantIds: [playerId(home, 3), playerId(away, 6)], chainId: "incident-offside",
    parentEventId: offsideDelivery.event_id, incidentId: "offside",
    timelineEvent: true,
    detail: "Gabriel wins the aerial challenge and clears De Bruyne's delivery.",
    commentary: "Gabriel heads De Bruyne's free kick clear.", showInCommentary: true,
    x: offsideLoc.x + 4, y: offsideLoc.y + 2,
    possessionAfterPlayerId: playerId(home, 3), possessionAfterTeamCode: home,
  });

  // One ordinary offside call and its indirect-free-kick sequence, then late non-scoring shots.
  const offsideLoc2 = locationFor(home, 70 * 60, home, 2, 47);
  const secondOffside = add({
    period: 2, periodSecond: 24 * 60 + 30, eventType: "offside_decision", action: "assistant_flags_offside",
    outcome: "offside_given", teamCode: home, playerId: playerId(home, 9), participantIds: [playerId(home, 9), "OFFICIAL-ar2"],
    refereeId: "OFFICIAL-ar2", chainId: "offside-mci-70", decision: true,
    decisionType: "offside", decisionLabel: "Offside given",
    decisionDetail: "Haaland is flagged offside; ARS receive an indirect free kick.",
    awardedTeamCode: away, restartType: "indirect_free_kick", timelineEvent: true,
    detail: "The assistant referee flags Haaland offside; ARS receive an indirect free kick.",
    commentary: "Offside against Haaland; Arsenal restart with a free kick.", showInCommentary: true,
    x: offsideLoc2.x, y: offsideLoc2.y,
  });
  const secondOffsideDelivery = add({
    period: 2, periodSecond: 24 * 60 + 38, eventType: "restart_delivery", action: "indirect_free_kick_delivery",
    outcome: "delivered", teamCode: away, playerId: playerId(away, 8), relatedPlayerId: playerId(away, 6),
    participantIds: [playerId(away, 8), playerId(away, 6)], chainId: "offside-mci-70",
    parentEventId: secondOffside.event_id, restartType: "indirect_free_kick",
    timelineEvent: true,
    detail: "Odegaard takes the indirect free kick toward Gabriel.",
    commentary: "Odegaard takes the indirect free kick toward Gabriel.", showInCommentary: true,
    x: offsideLoc2.x, y: offsideLoc2.y, targetX: offsideLoc2.x + 4, targetY: offsideLoc2.y - 2,
  });
  add({
    period: 2, periodSecond: 24 * 60 + 41, eventType: "restart_resolution", action: "indirect_free_kick_cleared",
    outcome: "defender_clears_delivery", teamCode: home, playerId: playerId(home, 3), relatedPlayerId: playerId(away, 6),
    participantIds: [playerId(home, 3), playerId(away, 6)], chainId: "offside-mci-70",
    parentEventId: secondOffsideDelivery.event_id,
    timelineEvent: true,
    detail: "Dias wins the aerial challenge and clears the indirect free kick.",
    commentary: "Dias heads Odegaard's free kick away.", showInCommentary: true,
    x: offsideLoc2.x + 4, y: offsideLoc2.y - 2,
  });
  add({
    period: 2, periodSecond: 45 * 60 + 20, eventType: "shot", action: "open_play_shot",
    outcome: "saved", teamCode: home, playerId: playerId(home, 8), goalkeeperId: playerId(away, 22),
    participantIds: [playerId(home, 8), playerId(away, 22)], chainId: "late-shot-mci",
    isShot: true, shotOnTarget: true, bigChance: false, xg: 0.09,
    detail: "Kovacic shoots from the edge of the area; Raya saves.", commentary: "Kovacic shoots; Raya saves for Arsenal.",
    showInCommentary: true, x: 25, y: 4, targetX: -52, targetY: 0,
    possessionAfterPlayerId: playerId(away, 22), possessionAfterTeamCode: away,
  });
  const lateTransitionRecovery = add({
    period: 2, periodSecond: 46 * 60 + 10, eventType: "ball_recovery", action: "pressing_recovery", outcome: "won",
    teamCode: away, playerId: playerId(away, 7), relatedPlayerId: playerId(home, 20),
    participantIds: [playerId(away, 7), playerId(home, 20)], chainId: "late-shot-ars",
    duelWon: true, detail: "Saka wins possession in midfield and turns toward the City goal.",
    possessionAfterPlayerId: playerId(away, 7), possessionAfterTeamCode: away,
  });
  lateTransitionRecovery._priority = -20;
  for (const periodOffset of [1, 3]) add({
    period: 2, periodSecond: 46 * 60 + 10 + periodOffset, eventType: "carry", action: "progressive_carry",
    outcome: "progressed", teamCode: away, playerId: playerId(away, 7), participantIds: [playerId(away, 7)],
    chainId: "late-shot-ars", detail: "Saka carries forward through the open channel.",
    possessionAfterPlayerId: playerId(away, 7), possessionAfterTeamCode: away,
  });
  add({
    period: 2, periodSecond: 46 * 60 + 16, eventType: "shot", action: "open_play_shot",
    outcome: "wide", teamCode: away, playerId: playerId(away, 7),
    participantIds: [playerId(away, 7)], chainId: "late-shot-ars",
    isShot: true, shotOnTarget: false, bigChance: false, xg: 0.04,
    detail: "Saka shoots wide from the right side of the box.", commentary: "Saka's late effort goes wide.",
    showInCommentary: true, x: 36, y: 15, targetX: 52.5, targetY: 0,
  });

  // Close every late shot with its real outcome and, when it goes wide, a goal-kick restart.
  for (const shot of [...events].filter((event) => event.event_type === "shot"
    && event.match_second >= LIVE_CUTOFF_SECONDS && event.outcome === "saved"
    && !events.some((candidate) => candidate.chain_id === event.chain_id && candidate.event_type === "save"))) {
    const opponent = shot.team_code === home ? away : home;
    const keeper = people.find((person) => person.team === opponent && person.pos === "GK");
    add({
      period: shot.period, periodSecond: shot.period_ms / 1000 + 3, eventType: "save", action: "goalkeeper_save",
      outcome: "shot_saved", teamCode: opponent, playerId: playerId(opponent, keeper.no), relatedPlayerId: shot.player_id,
      participantIds: [playerId(opponent, keeper.no), shot.player_id], chainId: shot.chain_id,
      parentEventId: shot.event_id, countsAsSave: true,
      detail: `${keeper.name} gathers ${shot.player_id}'s shot.`,
      possessionAfterPlayerId: playerId(opponent, keeper.no), possessionAfterTeamCode: opponent,
    });
  }
  for (const shot of [...events].filter((event) => event.event_type === "shot"
    && event.match_second >= LIVE_CUTOFF_SECONDS && event.outcome === "wide")) {
    const defendingTeam = shot.team_code === home ? away : home;
    const keeper = people.find((person) => person.team === defendingTeam && person.pos === "GK");
    const defender = activePlayers(people, defendingTeam, shot.match_second, home, half1Seconds)
      .find((person) => person.pos === "CB") || keeper;
    const restartSecond = shot.period_ms / 1000;
    const chainId = `goal-kick-${shot.event_id}`;
    const out = add({
      period: shot.period, periodSecond: restartSecond + 1, eventType: "ball_out", action: "shot_crosses_goal_line",
      outcome: "goal_kick", teamCode: shot.team_code, awardedTeamCode: defendingTeam,
      playerId: shot.player_id, relatedPlayerId: playerId(defendingTeam, keeper.no),
      participantIds: [shot.player_id, playerId(defendingTeam, keeper.no), "OFFICIAL-ar1"],
      refereeId: "OFFICIAL-ar1", chainId, parentEventId: shot.event_id, restartType: "goal_kick",
      detail: "The shot goes wide over the goal line; the defending team is awarded a goal kick.",
      possessionAfterPlayerId: "", possessionAfterTeamCode: "",
    });
    const delivery = add({
      period: shot.period, periodSecond: restartSecond + 9, eventType: "restart_delivery", action: "goal_kick_delivery",
      outcome: "delivered", teamCode: defendingTeam, playerId: playerId(defendingTeam, keeper.no),
      relatedPlayerId: playerId(defendingTeam, defender.no), participantIds: [playerId(defendingTeam, keeper.no), playerId(defendingTeam, defender.no)],
      chainId, parentEventId: out.event_id, restartType: "goal_kick", timelineEvent: true,
      detail: `${keeper.name} takes the goal kick toward ${defender.name}.`,
      possessionAfterPlayerId: playerId(defendingTeam, defender.no), possessionAfterTeamCode: defendingTeam,
    });
    add({
      period: shot.period, periodSecond: restartSecond + 11, eventType: "restart_resolution", action: "goal_kick_controlled",
      outcome: "possession_retained", teamCode: defendingTeam, playerId: playerId(defendingTeam, defender.no),
      relatedPlayerId: playerId(defendingTeam, keeper.no), participantIds: [playerId(defendingTeam, defender.no), playerId(defendingTeam, keeper.no)],
      chainId, parentEventId: delivery.event_id, restartType: "goal_kick", timelineEvent: true,
      detail: `${defender.name} controls the goal kick for ${defendingTeam}.`,
      possessionAfterPlayerId: playerId(defendingTeam, defender.no), possessionAfterTeamCode: defendingTeam,
    });
  }

  // Generate detailed pass actions after reserving the incident and set-piece timestamps.
  const reservedTimes = events.map((event) => event.match_second);
  buildPassEvents({ add, events, people, home, away, half1Seconds, half2Seconds });
  const lateFoulChallenge = events.find((event) => event.chain_id === "foul-22" && event.event_type === "challenge");
  if (lateFoulChallenge) {
    const priorPass = events.filter((event) => event.event_type === "pass" && event.team_code === away
      && event.match_second < lateFoulChallenge.match_second).sort((a, b) => b.match_second - a.match_second)[0];
    const passerId = priorPass?.related_player_id || playerId(away, 7);
    const passSecond = lateFoulChallenge.match_second - 1;
    add({
      period: 2, periodSecond: periodSecondForMatchSecond(passSecond, 2, half1Seconds),
      eventType: "pass", action: "short_pass_into_contact", outcome: "completed",
      teamCode: away, playerId: passerId, relatedPlayerId: lateFoulChallenge.related_player_id,
      participantIds: [passerId, lateFoulChallenge.related_player_id], chainId: "foul-22-transition",
      parentEventId: priorPass?.event_id || "", passCompleted: true,
      detail: "Saka slips the ball into Martinelli ahead of the closing challenge.",
      possessionAfterPlayerId: lateFoulChallenge.related_player_id, possessionAfterTeamCode: away,
    });
  }
  alignClosingChallengesAfterPasses(events, half1Seconds, half2Seconds);
  shiftClosingPossessionLinks(events, half1Seconds, half2Seconds);
  add({ period: 2, periodSecond: half2Seconds, eventType: "phase", phase: "full_time", action: "full_time_whistle", outcome: "match_ended", teamCode: "", detail: "Full-time." , clockLabel: "90+3:00" });
  const fullTimeSecond = half1Seconds + half2Seconds;
  for (const event of events.filter((candidate) => candidate.match_second === fullTimeSecond && candidate.event_type !== "phase")) {
    const second = fullTimeSecond - 1;
    const period = periodForMatchSecond(second, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(second, period, half1Seconds);
    event.match_second = second;
    event.match_ms = second * 1000;
    event.period = period;
    event.period_ms = periodSecond * 1000;
    event.period_added_seconds = Math.max(0, periodSecond - 45 * 60);
    event.frame_id = frameId(second);
    event.clock_label = formatElapsedClock(second, half1Seconds, half2Seconds);
    event.minute_label = officialMinute(period, periodSecond, half1Seconds);
  }

  const sorted = events.sort((left, right) => left.match_ms - right.match_ms || (left._priority ?? 0) - (right._priority ?? 0) || left.sequence - right.sequence);
  sorted.forEach((event, index) => { delete event._priority; event.sequence = index + 1; });
  let scoreHome = 0;
  let scoreAway = 0;
  for (const event of sorted) {
    if (event.score_delta) {
      if (event.team_code === home) scoreHome += event.score_delta;
      if (event.team_code === away) scoreAway += event.score_delta;
    }
    event.score_home = scoreHome;
    event.score_away = scoreAway;
    event.score = `${scoreHome}-${scoreAway}`;
  }
  return sorted;
}

const DISTANCE_KM_PER_90_BY_POSITION = {
  GK: 5.1,
  CB: 9.6,
  RB: 10.5,
  LB: 10.5,
  FB: 10.5,
  CM: 11.0,
  CDM: 11.0,
  LW: 10.9,
  RW: 10.9,
  W: 10.9,
  ST: 10.1,
  MF: 10.9,
};

// Published individual match distances from Premier League/Opta season roundups.
// These are reference performances from other fixtures, not measurements from this synthetic match.
const PUBLISHED_MATCH_DISTANCE_KM = {
  "MCI-20": 12.3, // Bernardo Silva, Man City v Arsenal (Opta Analyst)
  "MCI-16": 12.48, // Rodri, Man City v Newcastle (Premier League 2023/24)
  "MCI-47": 12.45, // Phil Foden, Man City v Newcastle (Premier League 2023/24)
  "MCI-8": 12.23, // Mateo Kovacic, Man City v Newcastle (Premier League 2023/24)
  "ARS-19": 12.94, // Leandro Trossard, Arsenal v Wolves (Premier League 2023/24)
};
const PUBLISHED_DISTANCE_KM_PER_90 = {
  "ARS-41": 11.36, // Declan Rice: 412.9km in 3,272 PL minutes (Premier League, 2022/23)
  "ARS-5": 10.48, // Thomas Partey: PL distance covered per 90 (Premier League, 2022/23)
  "ARS-8": 401.31 / (3104 / 90), // Martin Odegaard: 401.31km / 3,104 PL minutes (2023/24)
  "MCI-16": 388.53 / (2937 / 90), // Rodri: 388.53km / 2,937 PL minutes (2023/24)
};

function distanceSource(person) {
  const id = playerId(person.team, person.no);
  if (id === "ARS-41" || id === "ARS-5") return "individual Premier League distance per 90";
  if (id === "ARS-8" || id === "MCI-16") return "individual season distance divided by Premier League minutes";
  if (PUBLISHED_MATCH_DISTANCE_KM[id]) return "position average blended with published individual match distance";
  if (person.pos === "GK") return "goalkeeper match-distance research average";
  return "position average with deterministic individual variation";
}

function distanceSourceUrl(person) {
  const id = playerId(person.team, person.no);
  if (id === "ARS-41") return "https://www.premierleague.com/en/news/3572110";
  if (id === "ARS-5") return "https://www.premierleague.com/en/news/3572110";
  if (id === "ARS-8") return "https://www.premierleague.com/en/news/4025765; https://theanalyst.com/players/3782/martin-odegaard/career";
  if (id === "MCI-16") return "https://www.premierleague.com/en/news/4025765; https://theanalyst.com/players/4143/rodri/career";
  if (PUBLISHED_MATCH_DISTANCE_KM[id]) {
    return id === "MCI-20"
      ? "https://theanalyst.com/articles/bernardo-silva-cannavaro-man-city-vs-arsenal-premier-league-title"
      : "https://www.premierleague.com/en/news/4025771";
  }
  return person.pos === "GK"
    ? "https://doi.org/10.1080/02640414.2022.2044135"
    : "https://pmc.ncbi.nlm.nih.gov/articles/PMC11561100/";
}

function distanceTargetKmPer90(person) {
  const id = playerId(person.team, person.no);
  if (PUBLISHED_DISTANCE_KM_PER_90[id]) return PUBLISHED_DISTANCE_KM_PER_90[id];
  const positionTarget = DISTANCE_KM_PER_90_BY_POSITION[person.pos] ?? 10.5;
  const observation = PUBLISHED_MATCH_DISTANCE_KM[id];
  const observationBlend = observation ? positionTarget + (observation - positionTarget) * 0.2 : positionTarget;
  const individualVariation = 0.97 + (stableHash(`${person.team}-${person.no}-workrate`) % 61) / 1000;
  return observationBlend * individualVariation;
}

function sprintOffset(person, matchSecond) {
  const id = playerId(person.team, person.no);
  const seed = stableHash(`${id}-sprint`);
  const duration = 4;
  const interval = 150 + seed % 91;
  const cycle = Math.floor(matchSecond / interval);
  const windowSeed = stableHash(`${id}-sprint-${cycle}`);
  const start = cycle * interval + windowSeed % Math.max(1, interval - duration);
  const progress = (matchSecond - start) / duration;
  if (progress < 0 || progress > 1) return { x: 0, y: 0 };
  const angle = ((windowSeed >>> 8) % 6284) / 1000;
  const amplitude = 5.5;
  const displacement = amplitude * Math.sin(Math.PI * progress) ** 2;
  return { x: Math.cos(angle) * displacement, y: Math.sin(angle) * displacement };
}

function formationSlot(person, team, home, away, period, matchSecond, half1Seconds, movementScale = 1, includeSprints = false) {
  const formation = team === home ? HOME_FORMATION : AWAY_FORMATION;
  const directional = team === home ? (period === 1 ? -1 : 1) : (period === 1 ? 1 : -1);
  const pos = person.pos;
  const group = formation[pos];
  const groupIndex = Array.isArray(group) ? group.indexOf(person.no) : 0;
  const widths = {
    GK: [0], RB: [-25], CB: [-9, 9], LB: [25],
    CM: [-15, 15], CDM: [0], LW: [-22], ST: [0], RW: [22],
    FB: [-20], W: [0], MF: [0],
  };
  let x = directional * ({ GK: 44, RB: 32, CB: 32, LB: 32, CM: 18, CDM: 18, LW: 5, ST: 3, RW: 5, FB: 32, W: 6, MF: 18 }[pos] ?? 18);
  const teamOffset = team === home ? -3 : 3;
  const movementSeed = stableHash(`${team}-${person.no}-movement`);
  const xPeriod = 18 + (movementSeed % 110) / 10;
  const yPeriod = 17 + ((movementSeed >>> 8) % 120) / 10;
  const xPhase = ((movementSeed >>> 16) % 6284) / 1000;
  const yPhase = ((movementSeed >>> 4) % 6284) / 1000;
  x += directional * (teamOffset + 4.2 * movementScale * Math.sin(matchSecond / xPeriod * (2 * Math.PI) + xPhase));
  const lateral = widths[pos] || [0];
  let y = (lateral[Math.max(0, groupIndex)] ?? lateral[0]) + 3.6 * movementScale * Math.sin(matchSecond / yPeriod * (2 * Math.PI) + yPhase);
  if (includeSprints && person.pos !== "GK") {
    const sprint = sprintOffset(person, matchSecond);
    x += sprint.x;
    y += sprint.y;
  }
  return { x: clamp(x, -50, 50), y: clamp(y, -31, 31) };
}

function activeAt(person, matchSecond, home, half1Seconds) {
  const substitutionSecond = half1Seconds + 24 * 60;
  if (person.team === home && person.no === 19 && matchSecond >= substitutionSecond) return false;
  if (person.team === home && person.no === 8 && matchSecond < substitutionSecond) return false;
  return person.xi === "start" || (person.team === home && person.no === 8 && matchSecond >= substitutionSecond);
}

function outfieldPosition(person, { home, away, period, second, half1Seconds, movementScale }) {
  const subAt = half1Seconds + 24 * 60;
  const baseSlot = formationSlot(person, person.team, home, away, period, second, half1Seconds, movementScale, true);
  if (person.team === home && person.no === 19) {
    const slotAtSub = formationSlot(person, person.team, home, away, 2, subAt, half1Seconds, movementScale, true);
    if (second >= subAt - 15 && second < subAt) {
      const progress = (second - (subAt - 15)) / 15;
      return {
        x: baseSlot.x + (slotAtSub.x - baseSlot.x) * progress,
        y: baseSlot.y + (33.5 - baseSlot.y) * progress,
      };
    }
    if (second >= subAt) {
      const progress = clamp((second - subAt) / 4, 0, 1);
      return { x: slotAtSub.x, y: 33.5 + 3 * progress };
    }
  }
  if (person.team === home && person.no === 8) {
    const slotAtSub = formationSlot(person, person.team, home, away, 2, subAt, half1Seconds, movementScale, true);
    if (second < subAt) return { x: slotAtSub.x, y: 36.5 };
    const progress = clamp((second - subAt) / 30, 0, 1);
    const target = formationSlot(person, person.team, home, away, period, second, half1Seconds, movementScale, true);
    return { x: slotAtSub.x + (target.x - slotAtSub.x) * progress, y: 34 + (target.y - 34) * progress };
  }
  return baseSlot;
}

function playedSeconds(person, { home, half1Seconds, half2Seconds }) {
  const duration = half1Seconds + half2Seconds;
  let seconds = 0;
  let previous = null;
  for (let second = 0; second <= duration; second += 1) {
    if (!activeAt(person, second, home, half1Seconds)) {
      previous = null;
      continue;
    }
    const period = periodForMatchSecond(second, half1Seconds);
    if (previous && previous.period === period && previous.second === second - 1) seconds += 1;
    previous = { period, second };
  }
  return seconds;
}

function buildMovementProfiles(people) {
  const profiles = new Map();
  for (const person of people.filter((item) => !item.role && item.pos !== "GK")) {
    profiles.set(playerId(person.team, person.no), { amplitudeScale: 1.65 });
  }
  return profiles;
}

function summarizePlayerMovement(frames) {
  const summaries = new Map();
  const previous = new Map();
  const previousWholeSecond = new Map();
  for (const frame of frames) {
    for (const actor of JSON.parse(frame.actors)) {
      const id = actor.person_id;
      if (!actor.team || actor.status !== "active") {
        previous.delete(id);
        previousWholeSecond.delete(id);
        continue;
      }
      const summary = summaries.get(id) || { distance: 0, liveDistance: 0, seconds: 0, peakSpeed: 0, sprintSamples: 0 };
      const prior = previous.get(id);
      const elapsedSeconds = prior ? (Number(frame.match_ms) - prior.matchMs) / 1000 : 0;
      if (prior && prior.period === frame.period && elapsedSeconds > 0) {
        const distance = Math.hypot(actor.x - prior.x, actor.y - prior.y);
        const speed = distance / elapsedSeconds;
        summary.distance += distance;
        if (frame.match_second <= LIVE_CUTOFF_SECONDS) summary.liveDistance += distance;
        summary.seconds += elapsedSeconds;
        summary.peakSpeed = Math.max(summary.peakSpeed, speed);
      }
      if (Number.isInteger(Number(frame.match_second))) {
        const wholeSecondPrior = previousWholeSecond.get(id);
        if (wholeSecondPrior && wholeSecondPrior.period === frame.period
          && Number(frame.match_second) === wholeSecondPrior.second + 1) {
          const speed = Math.hypot(actor.x - wholeSecondPrior.x, actor.y - wholeSecondPrior.y);
          if (speed >= 25 / 3.6) summary.sprintSamples += 1;
        }
        previousWholeSecond.set(id, {
          x: actor.x,
          y: actor.y,
          period: frame.period,
          second: Number(frame.match_second),
        });
      }
      summaries.set(id, summary);
      previous.set(id, { x: actor.x, y: actor.y, period: frame.period, matchMs: Number(frame.match_ms) });
    }
  }
  return summaries;
}

const PLAYER_RATING_HEADERS = [
  "rating_id", "frame_id", "match_second", "period", "period_ms", "clock_label",
  "player_id", "team_code", "player_name", "player_status", "rating", "rating_delta",
  "event_ids", "change_reason", "source",
];

const PLAYER_RATING_SOURCE = "simulated_event_rating_v1";

export function buildPlayerRatings(events, frames, people) {
  const peopleById = new Map(people.filter((person) => !person.role).map((person) => [playerId(person.team, person.no), person]));
  const eventsBySecond = new Map();
  for (const event of events) {
    const second = Number(event.match_second);
    const atSecond = eventsBySecond.get(second) || [];
    atSecond.push(event);
    eventsBySecond.set(second, atSecond);
  }
  const ratings = new Map();
  const output = [];
  const ratingImpact = (event, actorsById) => {
    const impact = new Map();
    const add = (id, delta, reason) => {
      if (!id || !peopleById.has(id) || !delta) return;
      const existing = impact.get(id) || { delta: 0, reasons: [] };
      existing.delta += delta;
      existing.reasons.push(reason);
      impact.set(id, existing);
    };
    const player = event.player_id || "";
    const related = event.related_player_id || "";
    switch (event.event_type) {
      case "goal":
        if (event.outcome === "scored") {
          add(player, 1.0, "goal_scored");
          add(related, 0.35, "assist");
          const scoringTeam = event.team_code || peopleById.get(player)?.team;
          const opposingKeeper = [...actorsById.values()].find((actor) => actor.status === "active"
            && peopleById.get(actor.person_id)?.pos === "GK"
            && peopleById.get(actor.person_id)?.team !== scoringTeam);
          add(opposingKeeper?.person_id, -0.2, "goal_conceded");
        } else if (event.outcome === "disallowed") add(player, -0.02, "goal_disallowed");
        break;
      case "shot":
        if (event.outcome === "goal") add(player, 0.08, "shot_on_goal");
        else if (event.outcome === "saved") add(player, 0.04, "shot_on_target");
        else if (event.outcome === "blocked_out_for_corner") add(player, 0.015, "shot_blocked");
        else if (event.outcome === "wide") add(player, -0.025, "shot_wide");
        else if (event.outcome === "goal_disallowed") add(player, 0.025, "shot_disallowed");
        break;
      case "penalty_attempt":
        if (event.outcome === "saved") add(player, -0.18, "penalty_saved");
        else if (event.outcome === "scored") add(player, 0.08, "penalty_scored");
        break;
      case "save":
        add(player, event.action === "penalty_saved" ? 0.4 : 0.25, event.action === "penalty_saved" ? "penalty_save" : "save");
        break;
      case "pass":
        add(player, event.pass_completed === true || event.pass_completed === "true" ? 0.004 : -0.02,
          event.pass_completed === true || event.pass_completed === "true" ? "pass_completed" : "pass_lost");
        break;
      case "carry":
        add(player, 0.006, "ball_carry");
        break;
      case "ball_recovery":
        add(player, 0.045, "ball_recovery");
        add(related, -0.025, "possession_lost");
        break;
      case "duel":
      case "aerial_duel":
        add(player, event.duel_won === true || event.duel_won === "true" ? 0.035 : -0.035,
          event.duel_won === true || event.duel_won === "true" ? "duel_won" : "duel_lost");
        break;
      case "card_shown":
        add(player, event.outcome === "red" ? -1.0 : -0.25, event.outcome === "red" ? "red_card" : "yellow_card");
        break;
      case "foul_decision":
        add(player, -0.025, "foul_committed");
        add(related, 0.025, "foul_won");
        break;
      case "penalty_awarded":
        add(player, -0.04, "penalty_conceded");
        add(related, 0.04, "penalty_won");
        break;
      default:
        break;
    }
    return impact;
  };

  for (const frame of frames) {
    const second = Number(frame.match_second);
    const actors = typeof frame.actors === "string" ? JSON.parse(frame.actors) : frame.actors;
    const actorsById = new Map(actors.map((actor) => [actor.person_id, actor]));
    for (const actor of actors) {
      const person = peopleById.get(actor.person_id);
      if (person && actor.status === "active" && !ratings.has(actor.person_id)) ratings.set(actor.person_id, 6.0);
    }
    const deltas = new Map();
    const linkedEvents = new Map();
    const reasons = new Map();
    for (const event of (eventsBySecond.get(second) || []).sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
      for (const [id, result] of ratingImpact(event, actorsById)) {
        if (!ratings.has(id)) continue;
        ratings.set(id, Math.max(4, Math.min(10, ratings.get(id) + result.delta)));
        deltas.set(id, (deltas.get(id) || 0) + result.delta);
        linkedEvents.set(id, [...(linkedEvents.get(id) || []), event.event_id]);
        reasons.set(id, [...(reasons.get(id) || []), ...result.reasons]);
      }
    }
    for (const [id, rating] of ratings) {
      const person = peopleById.get(id);
      const actor = actorsById.get(id);
      if (!person || !actor) continue;
      const pad = String(second).padStart(5, "0");
      output.push({
        rating_id: `rating-${id}-${pad}`,
        frame_id: frame.frame_id,
        match_second: second,
        period: frame.period,
        period_ms: frame.period_ms,
        clock_label: frame.clock_label,
        player_id: id,
        team_code: person.team,
        player_name: person.name,
        player_status: actor.status,
        rating: Math.round(rating * 100) / 100,
        rating_delta: Math.round((deltas.get(id) || 0) * 1000) / 1000,
        event_ids: JSON.stringify(linkedEvents.get(id) || []),
        change_reason: [...new Set(reasons.get(id) || [])].join("|"),
        source: PLAYER_RATING_SOURCE,
      });
    }
  }
  return { rows: output, headers: PLAYER_RATING_HEADERS };
}

export const PLAYER_RATING_BY_SECOND_HEADERS = [
  "match_second", "period", "period_ms", "clock_label", "frame_id", "ratings",
];

export function buildPlayerRatingsBySecond(events, frames, people) {
  const { rows } = buildPlayerRatings(events, frames, people);
  const bySecond = new Map();
  for (const row of rows) {
    const sec = String(row.match_second);
    if (!bySecond.has(sec)) {
      bySecond.set(sec, {
        match_second: sec,
        period: row.period,
        period_ms: row.period_ms,
        clock_label: row.clock_label,
        frame_id: row.frame_id,
        entries: [],
      });
    }
    bySecond.get(sec).entries.push({
      rating_id: row.rating_id,
      player_id: row.player_id,
      team_code: row.team_code,
      player_name: row.player_name,
      player_status: row.player_status,
      rating: row.rating,
      rating_delta: row.rating_delta,
      event_ids: row.event_ids,
      change_reason: row.change_reason,
      source: row.source,
    });
  }
  const output = [...bySecond.values()]
    .sort((left, right) => Number(left.match_second) - Number(right.match_second))
    .map((group) => ({
      match_second: group.match_second,
      period: group.period,
      period_ms: group.period_ms,
      clock_label: group.clock_label,
      frame_id: group.frame_id,
      ratings: JSON.stringify(group.entries),
    }));
  return { rows: output, headers: PLAYER_RATING_BY_SECOND_HEADERS };
}

function buildFrames(events, { people, home, away, half1Seconds, half2Seconds, movementProfiles }) {
  const duration = half1Seconds + half2Seconds;
  const eventsAtSecond = new Map();
  for (const event of events) {
    const rows = eventsAtSecond.get(event.match_second) || [];
    rows.push(event);
    eventsAtSecond.set(event.match_second, rows);
  }
  const frames = [];
  let previousBall = { x: 0, y: 0 };
  let ballFlight = null;
  let ballStopped = false;
  let lastBallInteractionEventId = "";
  let previousOfficials = {
    main: { x: -4, y: 0 },
    ar1: { x: 4, y: -34 },
    ar2: { x: -2, y: 34 },
  };
  const previousGoalkeepers = new Map();
  const previousOutfieldPositions = new Map();
  let lastPossession = { team: home, id: playerId(home, 16) };
  const rosterPeople = people.filter((person) => !person.role);
  const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
  const quadraticPoint = (from, control, to, progress) => {
    const inverse = 1 - progress;
    return {
      x: inverse * inverse * from.x + 2 * inverse * progress * control.x + progress * progress * to.x,
      y: inverse * inverse * from.y + 2 * inverse * progress * control.y + progress * progress * to.y,
    };
  };
  const pointToSegmentDistance = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const progress = lengthSquared
      ? clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
      : 0;
    return distance(point, { x: start.x + dx * progress, y: start.y + dy * progress });
  };
  const distanceToPolyline = (point, points) => Math.min(...points.slice(1).map((sample, index) =>
    pointToSegmentDistance(point, points[index], sample)));
  const attackingGoalX = (team, period) => (team === home) === (period === 1) ? 52.5 : -52.5;
  const stoppageTypes = new Set([
    "foul_decision", "corner_awarded", "penalty_awarded", "offside_decision", "ball_out",
  ]);
  const interactionTypes = new Set([
    "pass", "carry", "ball_recovery", "shot", "penalty_attempt", "save", "block", "aerial_duel",
    "restart_delivery", "restart_resolution", "handball_contact", "substitution",
  ]);
  for (let second = 0; second <= duration; second += 1) {
    const period = periodForMatchSecond(second, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(second, period, half1Seconds);
    const currentEvents = eventsAtSecond.get(second) || [];
    const possessionBefore = lastPossession.id;
    for (const event of currentEvents) {
      if (interactionTypes.has(event.event_type) || event.event_type === "goal") {
        lastBallInteractionEventId = event.event_id;
      }
      if (event.event_type === "phase") {
        if (["half_time", "full_time"].includes(event.phase)) {
          ballStopped = true;
          ballFlight = null;
          lastPossession = { team: "", id: "" };
        } else if (["kick_off", "second_half"].includes(event.phase)) {
          const kickoffTeam = event.team_code || home;
          ballStopped = false;
          lastPossession = { team: kickoffTeam, id: event.player_id || playerId(kickoffTeam, 16) };
          lastBallInteractionEventId = event.event_id;
        }
      }
      if (stoppageTypes.has(event.event_type)) {
        ballStopped = true;
        ballFlight = null;
        lastPossession = { team: "", id: "" };
      }
      if (["pass", "restart_delivery"].includes(event.event_type)) {
        ballStopped = false;
      }
      if (event.event_type === "carry") {
        ballStopped = false;
        ballFlight = null;
      }
      if (interactionTypes.has(event.event_type)) {
        ballStopped = false;
      }
      if (event.event_type === "goal" && event.outcome === "scored") {
        ballStopped = true;
        ballFlight = null;
      }
      const nextPlayer = event.possession_after_player_id;
      const nextTeam = event.possession_after_team_code;
      if (nextPlayer && nextTeam) lastPossession = { team: nextTeam, id: nextPlayer };
      if (event.event_type === "restart_delivery" && event.related_player_id) {
        const receiverTeam = teamForPlayerId(event.related_player_id);
        lastPossession = { team: receiverTeam || event.team_code, id: event.related_player_id };
      }
      if (event.event_type === "phase" && event.phase === "second_half") {
        lastPossession = { team: event.team_code || home, id: event.player_id || playerId(event.team_code || home, 16) };
      }
      if (event.event_type === "substitution" && lastPossession.id === event.related_player_id) {
        lastPossession = { team: event.team_code, id: event.player_id };
      }
    }
    if (currentEvents.some((event) => event.event_type === "goal" && event.outcome === "scored")) {
      lastPossession = { team: "", id: "" };
      ballStopped = true;
      ballFlight = null;
    }
    if (!ballStopped && lastPossession.id) {
      const possessor = rosterPeople.find((person) => playerId(person.team, person.no) === lastPossession.id);
      if (!possessor || !activeAt(possessor, second, home, half1Seconds)) {
        const subIn = currentEvents.find((event) => event.event_type === "substitution" && event.related_player_id === lastPossession.id);
        const fallbackTeam = subIn?.team_code || lastPossession.team || home;
        const fallback = rosterPeople.find((person) => person.team === fallbackTeam
          && activeAt(person, second, home, half1Seconds) && person.pos !== "GK");
        lastPossession = fallback ? { team: fallback.team, id: playerId(fallback.team, fallback.no) } : { team: "", id: "" };
      }
    }
    const basePositions = new Map();
    const pressingPlayers = new Set();
    const attackingDirection = (team) => team === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
    for (const team of [home, away]) {
      const defenders = rosterPeople.filter((person) => person.team === team && person.pos !== "GK"
        && activeAt(person, second, home, half1Seconds));
      for (const person of defenders) {
        const profile = movementProfiles.get(playerId(team, person.no));
        basePositions.set(playerId(team, person.no), outfieldPosition(person, {
          home, away, period, second, half1Seconds, movementScale: profile?.amplitudeScale ?? 0.55,
        }));
      }
      if (lastPossession.team && team !== lastPossession.team) {
        const pressers = defenders.filter((person) => !["ST", "LW", "RW", "W"].includes(person.pos))
          .sort((left, right) => distance(basePositions.get(playerId(team, left.no)), previousBall)
            - distance(basePositions.get(playerId(team, right.no)), previousBall))
          .slice(0, 2);
        pressers.forEach((person) => pressingPlayers.add(playerId(team, person.no)));
      }
    }
    let ball = { ...previousBall, z: 0 };
    const actors = rosterPeople.map((person) => {
      const id = playerId(person.team, person.no);
      const active = activeAt(person, second, home, half1Seconds);
      const status = active ? "active" : person.xi === "start" ? "subbed_off" : "bench";
      const baseSlot = formationSlot(person, person.team, home, away, period, second, half1Seconds);
      let pos = active ? baseSlot : { x: person.team === home ? -8 - (person.no % 9) * 2 : 8 + (person.no % 9) * 2, y: 36.5 };
      if ((active || person.team === home && person.no === 19) && person.pos !== "GK") {
        const profile = movementProfiles.get(id);
        pos = basePositions.get(id) || outfieldPosition(person, {
          home, away, period, second, half1Seconds, movementScale: profile?.amplitudeScale ?? 0.55,
        });
        const substitution = currentEvents.find((event) => event.event_type === "substitution" && event.player_id === id);
        const outgoingPosition = substitution ? previousOutfieldPositions.get(substitution.related_player_id) : null;
        if (outgoingPosition) pos = { x: outgoingPosition.x, y: outgoingPosition.y };
        const lineShiftX = clamp(previousBall.x * 0.20, -11, 11);
        const lateralShiftY = clamp(previousBall.y * 0.18, -5.8, 5.8);
        const direction = attackingDirection(person.team);
        const attackProgress = clamp((previousBall.x * direction + 48) / 96, 0, 1);
        const frontPlayer = ["ST", "LW", "RW", "W"].includes(person.pos);
        if (lastPossession.team === person.team) {
          const forwardRun = ({ ST: 3.2, LW: 2.6, RW: 2.6, W: 2.4, RB: 1.8, LB: 1.8, FB: 1.8, CM: 1.4, CDM: 0.6, CB: 0.2 })[person.pos] ?? 0.6;
          pos = { x: pos.x + lineShiftX + direction * forwardRun * attackProgress, y: pos.y + lateralShiftY };
          if (["LW", "RW", "W"].includes(person.pos)) pos.y += Math.sign(pos.y || (person.no % 2 ? 1 : -1)) * 2.2;
        } else {
          pos = {
            x: pos.x + lineShiftX * (frontPlayer ? 0.38 : 1),
            y: pos.y * 0.91 + lateralShiftY,
          };
          if (pressingPlayers.has(id)) {
            const dx = previousBall.x - pos.x;
            const dy = previousBall.y - pos.y;
            const span = Math.hypot(dx, dy) || 1;
            const desiredGap = 3.8 + (stableHash(id) % 25) / 10;
            pos = {
              x: pos.x + dx / span * Math.max(0, span - desiredGap) * 0.55,
              y: pos.y + dy / span * Math.max(0, span - desiredGap) * 0.55,
            };
          }
        }
        pos = { x: clamp(pos.x, -50, 50), y: clamp(pos.y, -32, 32) };
        if (active) {
          const prior = previousOutfieldPositions.get(id);
          if (prior?.period === period) {
            const dx = pos.x - prior.x;
            const dy = pos.y - prior.y;
            const travel = Math.hypot(dx, dy);
            const maxStep = pressingPlayers.has(id) ? 8.4 : id === lastPossession.id ? 8.0 : 7.5;
            const scale = travel > maxStep ? maxStep / travel : 1;
            pos = { x: prior.x + dx * scale, y: prior.y + dy * scale };
          }
          previousOutfieldPositions.set(id, { x: pos.x, y: pos.y, period });
        }
      }
      if (active && person.pos === "GK") {
        const goalDirection = person.team === home
          ? (period === 1 ? -1 : 1)
          : (period === 1 ? 1 : -1);
        const goalX = goalDirection * 52.5;
        const depth = clamp(Math.abs(goalX - ball.x) * 0.15, 3, 8);
        const keeperSeed = stableHash(`${id}-keeper-workrate`);
        const keeperX = 2.4 * Math.sin(second / (25 + keeperSeed % 7) * 2 * Math.PI + ((keeperSeed >>> 8) % 6284) / 1000);
        const keeperY = 2.7 * Math.sin(second / (15 + (keeperSeed >>> 12) % 6) * 2 * Math.PI + ((keeperSeed >>> 16) % 6284) / 1000);
        const penaltyXMin = Math.min(goalX - goalDirection * 15, goalX);
        const penaltyXMax = Math.max(goalX - goalDirection * 15, goalX);
        const desired = {
          x: clamp(goalX - goalDirection * depth + keeperX, penaltyXMin, penaltyXMax),
          y: clamp(ball.y * 0.2 + keeperY, -9, 9),
        };
        const previous = previousGoalkeepers.get(id);
        if (previous?.period === period) {
          const dx = desired.x - previous.x;
          const dy = desired.y - previous.y;
          const travel = Math.hypot(dx, dy);
          const scale = travel > 5.5 ? 5.5 / travel : 1;
          pos = { x: previous.x + dx * scale, y: previous.y + dy * scale };
        } else {
          pos = desired;
        }
        previousGoalkeepers.set(id, { x: pos.x, y: pos.y, period });
      }
      return {
        person_id: id,
        team: person.team,
        no: person.no,
        status,
        x: round2(pos.x),
        y: round2(pos.y),
        z: 0,
      };
    });
    const actorsById = new Map(actors.map((actor) => [actor.person_id, actor]));
    const actorPosition = (id) => {
      const actor = actorsById.get(id);
      return actor ? { x: actor.x, y: actor.y } : null;
    };
    const holderPosition = actorPosition(lastPossession.id);
    const possessionChanged = Boolean(lastPossession.id && lastPossession.id !== possessionBefore);
    const scoredGoal = currentEvents.find((event) => event.event_type === "goal" && event.outcome === "scored");
    const ballOut = currentEvents.find((event) => event.event_type === "ball_out");
    const shotEvent = [...currentEvents].reverse().find((event) => ["shot", "penalty_attempt"].includes(event.event_type));
    const kickoffEvent = currentEvents.find((event) => event.event_type === "phase" && ["kick_off", "second_half"].includes(event.phase));
    let ballMotion = ballStopped ? "stopped" : "controlled";
    let ballInteractionEventId = lastBallInteractionEventId;
    let ballFromPlayerId = lastPossession.id || "";
    let ballToPlayerId = lastPossession.id || "";

    if (scoredGoal) {
      ball = { x: attackingGoalX(scoredGoal.team_code, period) * 0.995, y: 0, z: 0 };
      ballMotion = "goal";
      ballInteractionEventId = scoredGoal.event_id;
      ballFromPlayerId = shotEvent?.player_id || scoredGoal.player_id;
      ballToPlayerId = `GOAL-${scoredGoal.team_code}`;
    } else if (ballOut) {
      const goalX = attackingGoalX(ballOut.awarded_team_code || ballOut.team_code, period);
      const side = stableHash(ballOut.chain_id || ballOut.event_id) % 2 ? 1 : -1;
      ball = { x: clamp(goalX, -52.5, 52.5), y: side * 34, z: 0 };
      ballMotion = "out";
      ballInteractionEventId = ballOut.event_id;
      ballFromPlayerId = ballOut.player_id || "";
      ballToPlayerId = "OUT";
    } else if (ballStopped) {
      ball = { ...previousBall, z: 0 };
    } else if (shotEvent && shotEvent.outcome === "wide") {
      const goalX = attackingGoalX(shotEvent.team_code, period);
      const side = stableHash(shotEvent.event_id) % 2 ? 1 : -1;
      ball = { x: clamp(goalX, -52.5, 52.5), y: side * 4.2, z: 0 };
      ballMotion = "out";
      ballInteractionEventId = shotEvent.event_id;
      ballFromPlayerId = shotEvent.player_id;
      ballToPlayerId = "OUT";
      ballStopped = true;
      ballFlight = null;
      lastPossession = { team: "", id: "" };
    } else if (!ballStopped && holderPosition) {
      const shotTarget = shotEvent?.outcome === "saved"
        ? actorPosition(shotEvent.goalkeeper_id || lastPossession.id)
        : null;
      const shotAtGoal = Boolean(shotEvent && ["goal", "goal_disallowed", "blocked_out_for_corner", "scored"].includes(shotEvent.outcome));
      const interactionEvent = [...currentEvents].reverse().find((event) => ["pass", "ball_recovery", "restart_delivery", "restart_resolution", "block", "save", "shot", "penalty_attempt", "substitution"].includes(event.event_type)
        && JSON.parse(event.participant_ids).includes(lastPossession.id)) || kickoffEvent;
      const targetPlayerId = ["pass", "restart_delivery"].includes(interactionEvent?.event_type)
        ? interactionEvent.related_player_id || lastPossession.id
        : shotTarget ? shotEvent.goalkeeper_id || lastPossession.id : lastPossession.id;
      const targetPosition = actorPosition(targetPlayerId) || holderPosition;
      const destination = shotTarget
        || (shotAtGoal ? { x: attackingGoalX(shotEvent.team_code, period) * 0.995, y: 0 } : targetPosition);
      const startsFlight = possessionChanged || Boolean(shotTarget) || shotAtGoal || Boolean(kickoffEvent)
        || currentEvents.some((event) => ["pass", "ball_recovery", "restart_delivery", "restart_resolution", "block", "save", "substitution"].includes(event.event_type)
          && JSON.parse(event.participant_ids).includes(lastPossession.id));
      if (startsFlight) {
        const from = { x: previousBall.x, y: previousBall.y };
        const to = { x: destination.x, y: destination.y };
        const deltaX = to.x - from.x;
        const deltaY = to.y - from.y;
        const span = Math.hypot(deltaX, deltaY);
        const side = stableHash(interactionEvent?.event_id || `${second}-${lastPossession.id}`) % 2 ? 1 : -1;
        const bend = Math.min(1.7, Math.max(0.25, span * 0.035)) * side;
        const control = span > 0
          ? { x: (from.x + to.x) / 2 - (deltaY / span) * bend, y: (from.y + to.y) / 2 + (deltaX / span) * bend }
          : { ...from };
        const routeLength = distance(from, control) + distance(control, to);
        ballFlight = {
          from,
          control,
          to,
          startSecond: second - 1,
          duration: Math.max(1, Math.ceil(routeLength / 16)),
          targetPlayerId: shotTarget ? shotEvent.goalkeeper_id || lastPossession.id : shotAtGoal ? `GOAL-${shotEvent.team_code}` : targetPlayerId,
          fromPlayerId: interactionEvent?.player_id || possessionBefore,
          eventId: interactionEvent?.event_id || lastBallInteractionEventId,
          motion: shotEvent ? "shot" : "transfer",
          stopsAtGoal: shotEvent?.outcome === "goal" || shotEvent?.outcome === "scored",
        };
      }
      if (ballFlight) {
        const progress = clamp((second - ballFlight.startSecond) / ballFlight.duration, 0, 1);
        ball = { ...quadraticPoint(ballFlight.from, ballFlight.control, ballFlight.to, progress), z: 0 };
        ballMotion = ballFlight.motion;
        ballInteractionEventId = ballFlight.eventId;
        ballFromPlayerId = ballFlight.fromPlayerId || "";
        ballToPlayerId = ballFlight.targetPlayerId || "";
        if (progress >= 1) {
          if (ballToPlayerId.startsWith("GOAL-")) {
            ballMotion = ballFlight.stopsAtGoal ? "goal" : "shot";
            ballStopped = true;
            ballFlight = null;
          } else {
            const movingTarget = actorPosition(ballFlight.targetPlayerId) || holderPosition;
            if (movingTarget && distance(ball, movingTarget) > 1.05) {
              const from = { x: ball.x, y: ball.y };
              const to = { ...movingTarget };
              const deltaX = to.x - from.x;
              const deltaY = to.y - from.y;
              const span = Math.hypot(deltaX, deltaY);
              const side = stableHash(ballFlight.eventId || `${second}-${ballFlight.targetPlayerId}`) % 2 ? 1 : -1;
              const bend = Math.min(1.1, Math.max(0.2, span * 0.025)) * side;
              const control = span > 0
                ? { x: (from.x + to.x) / 2 - (deltaY / span) * bend, y: (from.y + to.y) / 2 + (deltaX / span) * bend }
                : { ...from };
              const routeLength = distance(from, control) + distance(control, to);
              ballFlight = {
                ...ballFlight,
                from,
                control,
                to,
                startSecond: second,
                duration: Math.max(1, Math.ceil(routeLength / 16)),
              };
            } else {
              if (movingTarget) ball = { ...movingTarget, z: 0 };
              ballMotion = "controlled";
              ballFlight = null;
            }
          }
        }
      } else {
        const attackDirection = lastPossession.team === home
          ? (period === 1 ? 1 : -1)
          : (period === 1 ? -1 : 1);
        ball = {
          x: clamp(holderPosition.x + attackDirection * 0.65, -52.5, 52.5),
          y: holderPosition.y,
          z: 0,
        };
        ballMotion = "controlled";
        ballFromPlayerId = lastPossession.id;
        ballToPlayerId = lastPossession.id;
      }
    }
    ball = { x: round2(clamp(ball.x, -52.5, 52.5)), y: round2(clamp(ball.y, -34, 34)), z: 0 };

    for (const event of currentEvents) {
      const playerPosition = actorPosition(event.player_id);
      const relatedPosition = actorPosition(event.related_player_id);
      if (["pass", "restart_delivery"].includes(event.event_type)) {
        if (playerPosition) {
          event.location_x = playerPosition.x;
          event.location_y = playerPosition.y;
        }
        if (relatedPosition) {
          event.target_x = relatedPosition.x;
          event.target_y = relatedPosition.y;
        }
      } else if (["shot", "penalty_attempt"].includes(event.event_type)) {
        if (playerPosition) {
          event.location_x = playerPosition.x;
          event.location_y = playerPosition.y;
        }
        if (event.team_code) {
          event.target_x = attackingGoalX(event.team_code, period);
          event.target_y = 0;
        }
      } else if (playerPosition && relatedPosition && ["challenge", "duel", "block", "aerial_duel", "handball_contact"].includes(event.event_type)) {
        event.location_x = round2((playerPosition.x + relatedPosition.x) / 2);
        event.location_y = round2((playerPosition.y + relatedPosition.y) / 2);
      } else if (event.event_type === "carry" && playerPosition) {
        event.location_x = playerPosition.x;
        event.location_y = playerPosition.y;
      } else if (event.event_type === "ball_recovery" && playerPosition) {
        if (relatedPosition) {
          event.location_x = relatedPosition.x;
          event.location_y = relatedPosition.y;
        }
        event.target_x = playerPosition.x;
        event.target_y = playerPosition.y;
      } else if (playerPosition && event.location_x !== "" && event.location_y !== "") {
        event.location_x = playerPosition.x;
        event.location_y = playerPosition.y;
      }
    }
    previousBall = ball;
    const attackDirection = attackingDirection(lastPossession.team || home);
    const mainRefSide = ball.y > 21 ? -1 : ball.y < -21 ? 1 : previousOfficials.main.y >= 0 ? 1 : -1;
    const preferredMainTarget = {
      x: clamp(ball.x - attackDirection * 5, -48, 48),
      y: clamp(ball.y + mainRefSide * 8, -31, 31),
    };
    let mainTarget = preferredMainTarget;
    let activePassRoute = null;
    if (ballFlight && ballFlight.motion === "transfer" && !ballToPlayerId.startsWith("GOAL-")) {
      const passer = actorPosition(ballFromPlayerId);
      const receiver = actorPosition(ballToPlayerId);
      if (passer && receiver) {
        activePassRoute = Array.from({ length: 25 }, (_, index) => {
          const progress = index / 24;
          return {
            x: passer.x + (receiver.x - passer.x) * progress,
            y: passer.y + (receiver.y - passer.y) * progress,
          };
        });
      }
    }
    if (activePassRoute) {
      const activePlayerPositions = actors.filter((actor) => actor.status === "active")
        .map((actor) => ({ x: actor.x, y: actor.y }));
      const candidates = [];
      for (let angle = 0; angle < 360; angle += 15) {
        const radians = angle * Math.PI / 180;
        const candidate = {
          x: clamp(ball.x + Math.cos(radians) * 10.5, -48, 48),
          y: clamp(ball.y + Math.sin(radians) * 10.5, -31, 31),
        };
        const routeClearance = distanceToPolyline(candidate, activePassRoute);
        const playerClearance = Math.min(...activePlayerPositions.map((position) => distance(candidate, position)));
        const movementCost = distance(candidate, previousOfficials.main);
        const shapeCost = distance(candidate, preferredMainTarget) * 0.35;
        const routePenalty = Math.max(0, 8 - routeClearance) ** 2 * 4;
        const playerPenalty = Math.max(0, 4.5 - playerClearance) ** 2 * 0.7;
        candidates.push({ point: candidate, score: movementCost + shapeCost + routePenalty + playerPenalty });
      }
      candidates.sort((left, right) => left.score - right.score);
      if (candidates.length) mainTarget = candidates[0].point;
    }
    const officialTargets = {
      main: mainTarget,
      ar1: { x: clamp(ball.x + 4, -48, 48), y: -34 },
      ar2: { x: clamp(ball.x - 2, -48, 48), y: 34 },
    };
    const officials = Object.entries(officialTargets).map(([role, target]) => {
      const previous = previousOfficials[role];
      const dx = target.x - previous.x;
      const dy = target.y - previous.y;
      const travel = Math.hypot(dx, dy);
      const scale = travel > 7.2 ? 7.2 / travel : 1;
      let position = { x: round2(previous.x + dx * scale), y: round2(previous.y + dy * scale) };
      if (role === "main" && activePassRoute && distanceToPolyline(position, activePassRoute) < 7) {
        let escape = position;
        let escapeScore = distanceToPolyline(position, activePassRoute) - distance(position, target) * 0.05;
        for (let angle = 0; angle < 360; angle += 10) {
          const radians = angle * Math.PI / 180;
          const candidate = {
            x: round2(clamp(previous.x + Math.cos(radians) * 7.2, -48, 48)),
            y: round2(clamp(previous.y + Math.sin(radians) * 7.2, -31, 31)),
          };
          const candidateScore = distanceToPolyline(candidate, activePassRoute) - distance(candidate, target) * 0.05;
          if (candidateScore > escapeScore) {
            escape = candidate;
            escapeScore = candidateScore;
          }
        }
        position = escape;
      }
      previousOfficials[role] = position;
      return { person_id: `OFFICIAL-${role}`, role, status: "active", ...position, z: 0 };
    });
    actors.push(...officials);
    const frame = {
      frame_id: frameId(second),
      match_ms: second * 1000,
      match_second: second,
      period,
      period_ms: periodSecond * 1000,
      clock_label: formatElapsedClock(second, half1Seconds, half2Seconds),
      ball_x: round2(ball.x),
      ball_y: round2(ball.y),
      ball_z: 0,
      ball_motion: ballMotion,
      ball_interaction_event_id: ballInteractionEventId,
      ball_from_player_id: ballFromPlayerId,
      ball_to_player_id: ballToPlayerId,
      possession_team: lastPossession.team,
      possession_player_id: lastPossession.id,
      possession_no: lastPossession.id ? Number(lastPossession.id.split("-")[1]) : "",
      event_ids: JSON.stringify(currentEvents.map((event) => event.event_id)),
      actors: JSON.stringify(actors),
    };
    frames.push(frame);
  }
  return frames;
}

function shiftClosingPossessionLinks(events, half1Seconds, half2Seconds) {
  const actionTimes = new Set(events.filter((event) => event.match_second >= LIVE_CUTOFF_SECONDS
    && ["pass", "shot", "penalty_attempt"].includes(event.event_type))
    .map((event) => `${event.match_second}:${event.player_id}`));
  for (const event of events) {
    if (event.match_second < LIVE_CUTOFF_SECONDS || !event.chain_id.startsWith("possession-link-")) continue;
    if (!actionTimes.has(`${event.match_second}:${event.related_player_id}`)) continue;
    const routeLength = event.event_type === "pass" && event.location_x !== "" && event.target_x !== ""
      ? Math.hypot(Number(event.target_x) - Number(event.location_x), Number(event.target_y) - Number(event.location_y))
      : 0;
    const second = event.match_second - Math.max(1, Math.ceil(routeLength / 17.5));
    if (second < LIVE_CUTOFF_SECONDS) continue;
    const period = periodForMatchSecond(second, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(second, period, half1Seconds);
    event.match_second = second;
    event.match_ms = second * 1000;
    event.period = period;
    event.period_ms = periodSecond * 1000;
    event.period_added_seconds = Math.max(0, periodSecond - 45 * 60);
    event.frame_id = frameId(second);
    event.clock_label = formatElapsedClock(second, half1Seconds, half2Seconds);
    event.minute_label = officialMinute(period, periodSecond, half1Seconds);
  }
}

function alignClosingChallengesAfterPasses(events, half1Seconds, half2Seconds) {
  const retime = (event, second) => {
    const period = periodForMatchSecond(second, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(second, period, half1Seconds);
    event.match_second = second;
    event.match_ms = second * 1000;
    event.period = period;
    event.period_ms = periodSecond * 1000;
    event.period_added_seconds = Math.max(0, periodSecond - 45 * 60);
    event.frame_id = frameId(second);
    event.clock_label = formatElapsedClock(second, half1Seconds, half2Seconds);
    event.minute_label = officialMinute(period, periodSecond, half1Seconds);
  };
  const shiftedChains = new Set();
  for (const challenge of events.filter((event) => event.match_second >= LIVE_CUTOFF_SECONDS
    && event.event_type === "challenge" && event.outcome === "foul")) {
    const linkedPass = events.find((event) => event.match_second === challenge.match_second
      && event.event_type === "pass" && event.chain_id.startsWith("possession-link-")
      && event.related_player_id === challenge.related_player_id);
    if (!linkedPass || shiftedChains.has(challenge.chain_id)) continue;
    const length = Math.hypot(Number(linkedPass.target_x) - Number(linkedPass.location_x),
      Number(linkedPass.target_y) - Number(linkedPass.location_y));
    const delay = Math.max(1, Math.ceil(length / 17.5));
    for (const event of events.filter((candidate) => candidate.chain_id === challenge.chain_id)) {
      retime(event, Number(event.match_second) + delay);
    }
    shiftedChains.add(challenge.chain_id);
  }
}

function reconcileCriticalFrames(events, frames, { home, away, half1Seconds }) {
  const incidentSimulations = {
    offside: buildOffsideSimulation(),
    tackle: buildSimulation(),
  };
  const incidentSamplers = {
    offside: sampleOffsideFrame,
    tackle: sampleFrame,
  };
  const tackleContactPoint = incidentActorMatchPoint("tackle", incidentSimulations.tackle.impact.point);
  const bySecond = new Map(frames.map((frame) => [Number(frame.match_second), frame]));
  const parsedActors = new Map();
  for (const frame of frames) parsedActors.set(Number(frame.match_second), JSON.parse(frame.actors));
  const basePositions = new Map();
  for (const [second, actors] of parsedActors) {
    basePositions.set(second, new Map(actors.map((actor) => [actor.person_id, { x: Number(actor.x), y: Number(actor.y) }])));
  }
  const getPos = (id, second) => basePositions.get(second)?.get(id) || null;
  const overrides = new Map();
  const addPath = (id, keys) => {
    const sorted = [...keys].sort((a, b) => a.second - b.second);
    const byPlayer = overrides.get(id) || new Map();
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const from = sorted[i];
      const to = sorted[i + 1];
      for (let second = from.second; second <= to.second; second += 1) {
        const t = (second - from.second) / Math.max(1, to.second - from.second);
        byPlayer.set(second, {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
      }
    }
    overrides.set(id, byPlayer);
  };
  const baseKey = (id, second) => {
    const p = getPos(id, second);
    if (!p) throw new Error(`Missing ${id} at ${second} while reconciling incidents`);
    return { second, x: p.x, y: p.y };
  };

  // These broader paths lead into and out of the offside sequence; the 27:06 and
  // 27:07 frames are replaced with the same 120 Hz coordinates shown in Tactical Eye.
  const offsideRelease = 27 * 60 + 7;
  addPath("ARS-8", [baseKey("ARS-8", 1619), { second: 1626, x: -16, y: -3.3 },
    { second: offsideRelease, x: -23.19, y: -3.21 }, { second: 1630, x: -24.5, y: -3.1 }, baseKey("ARS-8", 1637)]);
  addPath("ARS-9", [baseKey("ARS-9", 1619), { second: 1626, x: -29, y: 0.2 },
    { second: offsideRelease, x: -32.14, y: 0.18 }, { second: 1628, x: -33.3, y: 0.14 },
    { second: 1629, x: -34.5, y: 0.1 }, { second: 1630, x: -34.5, y: 0.1 }, baseKey("ARS-9", 1637)]);
  addPath("MCI-16", [baseKey("MCI-16", 1619), { second: offsideRelease, x: -32, y: -1.55 },
    { second: 1630, x: -32.2, y: -1.55 }, baseKey("MCI-16", 1637)]);
  addPath("MCI-31", [baseKey("MCI-31", 1619), { second: offsideRelease, x: -48.7, y: 0 },
    { second: 1630, x: -48.5, y: 0 }, baseKey("MCI-31", 1637)]);
  addPath("MCI-9", [baseKey("MCI-9", 1619), { second: 1626, x: -15.2, y: -2.7 }, baseKey("MCI-9", 1637)]);
  addPath("MCI-17", [baseKey("MCI-17", 1630), { second: 1637, x: -34.5, y: 0.1 },
    { second: 1639, x: -30.5, y: 2 }, baseKey("MCI-17", 1645)]);
  addPath("MCI-3", [baseKey("MCI-3", 1630), { second: 1637, x: -30.5, y: 2 },
    baseKey("MCI-3", 1639), baseKey("MCI-3", 1645)]);
  addPath("ARS-6", [baseKey("ARS-6", 1630), { second: 1639, x: -26, y: 5 }, baseKey("ARS-6", 1645)]);

  // The recovery occurs with Saka and the previous carrier at the same point.
  // Gvardiol then closes from the simulation's start position; these three paths
  // are replaced by the exact 120 Hz incident samples below.
  addPath("MCI-24", [baseKey("MCI-24", 4640), { second: 4654, x: -5.5, y: -25.5 },
    { second: 4663, x: 11.55, y: -28.74 }, baseKey("MCI-24", 4672)]);
  addPath("ARS-7", [baseKey("ARS-7", 4640), { second: 4654, x: 2.35, y: -28.48 },
    { second: 4663, x: 14.1, y: -27.73 },
    { second: 4672, x: 14, y: -25 }, { second: 4674, x: 16, y: -23 }, baseKey("ARS-7", 4680)]);
  addPath("MCI-8", [baseKey("MCI-8", 4640), { second: 4645, x: 20.37, y: -15.82 },
    { second: 4650, x: 9, y: -20 }, { second: 4651, x: 8, y: -21 },
    { second: 4654, x: 2.35, y: -28.48 }, { second: 4657, x: 0, y: -25 }, baseKey("MCI-8", 4672)]);
  addPath("ARS-8", [baseKey("ARS-8", 4663), { second: 4672, x: 10.14, y: -28.06 },
    { second: 4674, x: 12, y: -26 }, baseKey("ARS-8", 4680)]);
  addPath("ARS-9", [baseKey("ARS-9", 4663), { second: 4674, x: 16, y: -23 }, baseKey("ARS-9", 4680)]);

  // The late City shot is rebuilt as a genuine edge-of-box chance with Raya in range.
  addPath("MCI-20", [baseKey("MCI-20", 5468), { second: 5476, x: -42, y: 5 },
    { second: 5480, x: -42, y: 5 }, baseKey("MCI-20", 5488)]);
  addPath("MCI-8", [baseKey("MCI-8", 5470), { second: 5480, x: -34.5, y: 3 }, baseKey("MCI-8", 5486)]);

  // Bring defenders into recovery distance before a late-match turnover. This keeps
  // tackles at the ball instead of teleporting a winner across the pitch.
  const initialEvents = [...events].sort((a, b) => a.match_second - b.match_second || a.sequence - b.sequence);
  for (const event of initialEvents.filter((item) => item.match_second >= LIVE_CUTOFF_SECONDS && item.event_type === "ball_recovery")) {
    const winner = event.player_id;
    const loser = event.related_player_id;
    const second = Number(event.match_second);
    const start = Math.max(LIVE_CUTOFF_SECONDS, second - 6);
    const winnerStart = overrides.get(winner)?.get(start) || getPos(winner, start);
    const loserEnd = overrides.get(loser)?.get(second) || getPos(loser, second);
    if (!winnerStart || !loserEnd) continue;
    const contact = { x: (winnerStart.x + loserEnd.x) / 2, y: (winnerStart.y + loserEnd.y) / 2 };
    addPath(winner, [baseKey(winner, start), { second, ...contact }, baseKey(winner, Math.min(5640, second + 5))]);
    addPath(loser, [baseKey(loser, start), { second, ...contact }, baseKey(loser, Math.min(5640, second + 5))]);
  }
  for (const challenge of initialEvents.filter((item) => item.match_second >= LIVE_CUTOFF_SECONDS
    && item.event_type === "challenge" && item.outcome === "foul")) {
    const decision = initialEvents.find((item) => item.chain_id === challenge.chain_id && item.event_type === "foul_decision");
    const restart = initialEvents.find((item) => item.chain_id === challenge.chain_id && item.event_type === "restart_delivery");
    if (!decision || !restart) continue;
    const second = Number(challenge.match_second);
    const start = Math.max(LIVE_CUTOFF_SECONDS, second - 7);
    const offender = challenge.player_id;
    const victim = challenge.related_player_id;
    const a = overrides.get(offender)?.get(second) || getPos(offender, second);
    if (challenge.chain_id === "foul-22" && victim === "ARS-11" && !overrides.get(victim)?.has(second)) {
      const latePoint = { x: -17.02, y: 31 };
      addPath(victim, [baseKey(victim, start), { second, ...latePoint }, baseKey(victim, Math.min(5640, Number(restart.match_second) + 5))]);
    }
    const b = overrides.get(victim)?.get(second) || getPos(victim, second);
    if (!a || !b) continue;
    // The fouled player is the current carrier; bring the challenger to the ball carrier.
    const contact = { x: b.x, y: b.y };
    const settleSecond = Math.min(Number(restart.match_second), second + 3);
    addPath(offender, [baseKey(offender, start), { second, ...contact }, { second: settleSecond, ...contact },
      baseKey(offender, Math.min(5640, Number(restart.match_second) + 5))]);
    addPath(victim, [baseKey(victim, start), { second, ...contact }, { second: settleSecond, ...contact },
      baseKey(victim, Math.min(5640, Number(restart.match_second) + 5))]);
  }
  for (const delivery of initialEvents.filter((item) => item.match_second >= LIVE_CUTOFF_SECONDS && item.event_type === "restart_delivery")) {
    const second = Number(delivery.match_second);
    const period = Number(delivery.period);
    let restartPoint = null;
    if (delivery.restart_type === "goal_kick") {
      const chainOut = initialEvents.find((item) => item.chain_id === delivery.chain_id && item.event_type === "ball_out");
      const shot = chainOut ? initialEvents.find((item) => item.event_id === chainOut.parent_event_id) : null;
      if (shot) {
        const direction = shot.team_code === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
        restartPoint = { x: direction * 52.5 - direction * 5, y: 0 };
      }
    } else if (delivery.restart_type === "corner") {
      const awarded = initialEvents.find((item) => item.chain_id === delivery.chain_id && item.event_type === "corner_awarded");
      const team = awarded?.awarded_team_code || delivery.team_code;
      const direction = team === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
      restartPoint = { x: direction * 52.5, y: (stableHash(delivery.chain_id) % 2 ? 1 : -1) * 33 };
    } else {
      const decision = initialEvents.find((item) => item.chain_id === delivery.chain_id
        && ["foul_decision", "offside_decision", "penalty_awarded"].includes(item.event_type));
      const challenge = initialEvents.find((item) => item.chain_id === delivery.chain_id && item.event_type === "challenge");
      const first = challenge || decision;
      if (first?.player_id && first?.related_player_id) {
        const firstSecond = Number(first.match_second);
        const a = overrides.get(first.player_id)?.get(firstSecond) || getPos(first.player_id, firstSecond);
        const b = overrides.get(first.related_player_id)?.get(firstSecond) || getPos(first.related_player_id, firstSecond);
        if (a && b) restartPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }
    if (!restartPoint) continue;
    const taker = delivery.player_id;
    const receiver = delivery.related_player_id;
    const start = Math.max(LIVE_CUTOFF_SECONDS, second - 7);
    const direction = delivery.team_code === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
    const target = { x: clamp(restartPoint.x + direction * 5, -48, 48), y: clamp(restartPoint.y + (restartPoint.y >= 0 ? -3 : 3), -30, 30) };
    addPath(taker, [baseKey(taker, start), { second, ...restartPoint },
      baseKey(taker, Math.min(5640, second + 5))]);
    addPath(receiver, [baseKey(receiver, start), { second, ...target },
      baseKey(receiver, Math.min(5640, second + 5))]);
  }
  for (const resolution of initialEvents.filter((item) => item.match_second >= LIVE_CUTOFF_SECONDS
    && ["restart_resolution", "aerial_duel"].includes(item.event_type) && item.possession_after_player_id)) {
    const winner = resolution.possession_after_player_id;
    const challenger = resolution.player_id;
    if (!winner || !challenger || winner === challenger) continue;
    const second = Number(resolution.match_second);
    const start = Math.max(LIVE_CUTOFF_SECONDS, second - 5);
    const a = overrides.get(winner)?.get(second) || getPos(winner, second);
    const b = overrides.get(challenger)?.get(second) || getPos(challenger, second);
    if (!a || !b) continue;
    const contact = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    addPath(winner, [baseKey(winner, start), { second, ...contact }, baseKey(winner, Math.min(5640, second + 5))]);
    addPath(challenger, [baseKey(challenger, start), { second, ...contact }, baseKey(challenger, Math.min(5640, second + 5))]);
  }

  // Give the closing counterattacks real attacking geometry and keep the
  // recovery, first-time shot, and goal-kick locations within a plausible run.
  addPath("ARS-11", [baseKey("ARS-11", 4927), { second: 4932, x: 29, y: -4 }, baseKey("ARS-11", 4943)]);
  addPath("MCI-25", [baseKey("MCI-25", 4927), { second: 4932, x: 29, y: -4 }, baseKey("MCI-25", 4943)]);
  addPath("MCI-8", [baseKey("MCI-8", 4987), { second: 4992, x: -5, y: -15 }, baseKey("MCI-8", 5004)]);
  addPath("MCI-47", [baseKey("MCI-47", 4987), { second: 4992, x: -15, y: 17 },
    { second: 4995, x: -28, y: 15 }, baseKey("MCI-47", 5004)]);
  addPath("ARS-7", [baseKey("ARS-7", 5528), { second: 5530, x: -2.08, y: 3.94 },
    { second: 5531, x: 5, y: 5.8 }, { second: 5533, x: 16.5, y: 10 },
    { second: 5536, x: 31, y: 14 }, baseKey("ARS-7", 5545)]);

  for (const [id, points] of overrides) {
    for (const [second, pos] of points) {
      const actors = parsedActors.get(second);
      const actor = actors?.find((item) => item.person_id === id);
      if (actor) {
        actor.x = round2(clamp(pos.x, -52.5, 52.5));
        actor.y = round2(clamp(pos.y, -34, 34));
      }
    }
  }
  const movementSpans = [[1599, 1645], [4634, 4680], [LIVE_CUTOFF_SECONDS - 1, 5640]];
  for (const [start, end] of movementSpans) {
    for (let second = start + 1; second <= end; second += 1) {
      if (!parsedActors.has(second) || !parsedActors.has(second - 1)) continue;
      const current = parsedActors.get(second);
      const prior = new Map(parsedActors.get(second - 1).map((actor) => [actor.person_id, actor]));
      for (const actor of current) {
        const previous = prior.get(actor.person_id);
        if (!previous || actor.status !== "active" || previous.status !== "active") continue;
        const dx = Number(actor.x) - Number(previous.x);
        const dy = Number(actor.y) - Number(previous.y);
        const distance = Math.hypot(dx, dy);
        if (distance > 8.9) {
          actor.x = round2(Number(previous.x) + dx / distance * 8.9);
          actor.y = round2(Number(previous.y) + dy / distance * 8.9);
        }
      }
    }
  }
  for (const kind of ["offside", "tackle"]) {
    const simulation = incidentSimulations[kind];
    const track = INCIDENT_TRACKING[kind];
    const firstSecond = Math.floor(matchSecondAtSimulationTime(kind, simulation, 0));
    const lastSecond = kind === "tackle"
      ? 4663
      : Math.ceil(matchSecondAtSimulationTime(kind, simulation, simulation.duration));
    for (let second = firstSecond; second <= lastSecond; second += 1) {
      const actors = parsedActors.get(second);
      if (!actors) continue;
      const time = simulationTimeAtMatchSecond(kind, simulation, second);
      const state = incidentSamplers[kind](simulation, time);
      for (const [role, id] of Object.entries(track.actors)) {
        const actor = actors.find((item) => item.person_id === id);
        const sceneActor = state[role];
        if (!actor || !sceneActor) throw new Error(`${kind} simulation is missing ${role} (${id}) at ${second}`);
        const point = incidentActorMatchPoint(kind, sceneActor);
        actor.x = roundPitchCoordinate(clamp(point.x, -52.5, 52.5));
        actor.y = roundPitchCoordinate(clamp(point.y, -34, 34));
      }
    }
  }
  for (const [second, actors] of parsedActors) {
    basePositions.set(second, new Map(actors.map((actor) => [actor.person_id, { x: Number(actor.x), y: Number(actor.y) }])));
  }
  for (const frame of frames) frame.actors = JSON.stringify(parsedActors.get(Number(frame.match_second)));

  const eventById = new Map(events.map((event) => [event.event_id, event]));
  const eventsAt = new Map();
  for (const event of events) {
    const rows = eventsAt.get(Number(event.match_second)) || [];
    rows.push(event);
    eventsAt.set(Number(event.match_second), rows);
  }
  const actorPos = (id, second) => {
    const frame = bySecond.get(Number(second));
    const actor = frame ? JSON.parse(frame.actors).find((item) => item.person_id === id) : null;
    return actor ? { x: Number(actor.x), y: Number(actor.y) } : { x: 0, y: 0 };
  };
  const directionFor = (team, period) => team === home ? (period === 1 ? 1 : -1) : (period === 1 ? -1 : 1);
  const goalFor = (team, period) => directionFor(team, period) * 52.5;

  for (const event of events) {
    const p = actorPos(event.player_id, Number(event.match_second));
    const related = actorPos(event.related_player_id, Number(event.match_second));
    if (["pass", "restart_delivery"].includes(event.event_type)) {
      event.location_x = round2(p.x);
      event.location_y = round2(p.y);
      if (event.related_player_id) {
        event.target_x = round2(related.x);
        event.target_y = round2(related.y);
      }
      if (event.event_type === "restart_delivery" && event.related_player_id) {
        event.possession_after_player_id = event.related_player_id;
        event.possession_after_team_code = teamForPlayerId(event.related_player_id) || event.team_code;
      }
    } else if (["shot", "penalty_attempt"].includes(event.event_type)) {
      event.location_x = round2(p.x);
      event.location_y = round2(p.y);
      if (event.team_code) {
        event.target_x = goalFor(event.team_code, Number(event.period));
        event.target_y = 0;
      }
    } else if (event.event_type === "ball_recovery") {
      event.location_x = round2(p.x);
      event.location_y = round2(p.y);
      event.target_x = round2(p.x);
      event.target_y = round2(p.y);
    } else if (event.event_type === "carry") {
      event.location_x = round2(p.x);
      event.location_y = round2(p.y);
    } else if (["restart_resolution", "aerial_duel", "save"].includes(event.event_type)) {
      const controller = actorPos(event.possession_after_player_id || event.player_id, Number(event.match_second));
      event.location_x = round2(controller.x);
      event.location_y = round2(controller.y);
    } else if (["foul_decision", "offside_decision", "penalty_awarded"].includes(event.event_type)) {
      const challenge = events.find((candidate) => candidate.chain_id === event.chain_id && candidate.event_type === "challenge");
      if (challenge) {
        event.location_x = challenge.location_x;
        event.location_y = challenge.location_y;
      } else if (event.chain_id === "incident-offside" && event.event_type === "offside_decision") {
        const whistlePoint = actorPos("ARS-9", 1630);
        event.location_x = round2(whistlePoint.x);
        event.location_y = round2(whistlePoint.y);
      }
    } else if (event.chain_id === "incident-offside" && event.event_type === "goal" && event.outcome === "disallowed") {
      event.location_x = goalFor(event.team_code, Number(event.period));
      event.location_y = 0;
    } else if (event.chain_id === "incident-offside" && ["offside_decision", "var_review"].includes(event.event_type)) {
      const whistlePoint = actorPos("ARS-9", 1630);
      event.location_x = round2(whistlePoint.x);
      event.location_y = round2(whistlePoint.y);
    } else if (event.chain_id === "incident-tackle-77" && ["challenge", "foul_decision", "card_shown", "var_review"].includes(event.event_type)) {
      event.location_x = roundPitchCoordinate(tackleContactPoint.x);
      event.location_y = roundPitchCoordinate(tackleContactPoint.y);
    } else if (event.event_type === "challenge" && event.player_id && event.related_player_id) {
      event.location_x = round2((p.x + related.x) / 2);
      event.location_y = round2((p.y + related.y) / 2);
    } else if (event.event_type === "ball_out") {
      const shot = eventById.get(event.parent_event_id);
      if (event.outcome === "goal_kick" && shot) {
        event.location_x = goalFor(shot.team_code, Number(event.period));
        event.location_y = (stableHash(shot.event_id) % 2 ? 1 : -1) * 4.2;
      } else if (event.outcome === "corner") {
        event.location_x = goalFor(event.awarded_team_code, Number(event.period));
        event.location_y = (stableHash(event.chain_id) % 2 ? 1 : -1) * 34;
      }
    }
  }

  const controlledTypes = new Set(["carry", "ball_recovery", "save", "restart_resolution", "aerial_duel"]);
  const stoppageTypes = new Set(["foul_decision", "corner_awarded", "penalty_awarded", "offside_decision", "ball_out"]);
  let possession = { id: "", team: "" };
  let lastTouch = "";
  let ball = { x: Number(bySecond.get(LIVE_CUTOFF_SECONDS - 1).ball_x), y: Number(bySecond.get(LIVE_CUTOFF_SECONDS - 1).ball_y) };
  let flight = null;
  const priorEvent = [...events].filter((event) => event.match_second < LIVE_CUTOFF_SECONDS
    && ["pass", "restart_delivery", "restart_resolution", "carry", "ball_recovery"].includes(event.event_type))
    .sort((a, b) => b.match_second - a.match_second || b.sequence - a.sequence)[0];
  if (priorEvent?.event_type === "pass" || priorEvent?.event_type === "restart_delivery") {
    possession = { id: priorEvent.possession_after_player_id || priorEvent.related_player_id, team: priorEvent.possession_after_team_code || teamForPlayerId(priorEvent.related_player_id) || "" };
    lastTouch = priorEvent.event_id;
  } else if (priorEvent) {
    possession = { id: priorEvent.possession_after_player_id || priorEvent.player_id, team: priorEvent.possession_after_team_code || teamForPlayerId(priorEvent.player_id) || "" };
    lastTouch = priorEvent.event_id;
  }

  const writeBall = (frame, motion, fromId = "", toId = "") => {
    frame.ball_x = round2(clamp(ball.x, -52.5, 52.5));
    frame.ball_y = round2(clamp(ball.y, -34, 34));
    frame.ball_z = 0;
    frame.ball_motion = motion;
    frame.ball_interaction_event_id = lastTouch;
    frame.ball_from_player_id = fromId;
    frame.ball_to_player_id = toId;
    frame.possession_player_id = possession.id;
    frame.possession_team = possession.team;
    frame.possession_no = possession.id ? Number(possession.id.split("-")[1]) : "";
  };
  const holderAt = (id, second) => actorPos(id, second);
  const startFlight = (event, second, targetId, targetPoint, motion = "transfer", resolvesToId = "", resolvesToTeam = "") => {
    const source = actorPos(event.player_id, second);
    const length = Math.hypot(targetPoint.x - source.x, targetPoint.y - source.y);
    ball = { x: source.x, y: source.y };
    possession = { id: "", team: "" };
    lastTouch = event.event_id;
    flight = {
      from: source, to: targetPoint, startSecond: second,
      duration: Math.max(1, Math.ceil(length / 17.5)), targetId,
      sourceId: event.player_id, eventId: event.event_id, motion,
      resolvesToId, resolvesToTeam,
    };
  };
  const advanceFlight = (second) => {
    const target = flight.targetId && !flight.targetId.startsWith("GOAL-") && flight.targetId !== "OUT"
      ? holderAt(flight.targetId, second) : flight.to;
    const dx = target.x - ball.x;
    const dy = target.y - ball.y;
    const remaining = Math.hypot(dx, dy);
    const step = Math.min(17.5, remaining);
    ball = remaining > 0
      ? { x: ball.x + dx / remaining * step, y: ball.y + dy / remaining * step }
      : { ...target };
    lastTouch = flight.eventId;
    if (remaining <= 17.5) {
      if (flight.targetId?.startsWith("GOAL-")) {
        possession = { id: "", team: "" };
        flight = null;
        return { motion: "goal" };
      }
      if (flight.targetId === "OUT") {
        possession = { id: "", team: "" };
        flight = null;
        return { motion: "out" };
      }
      possession = { id: flight.resolvesToId || flight.targetId, team: flight.resolvesToTeam || teamForPlayerId(flight.resolvesToId || flight.targetId) || "" };
      flight = null;
      return { motion: "controlled" };
    }
    return { motion: flight.motion };
  };

  for (let second = LIVE_CUTOFF_SECONDS; second <= Number(frames[frames.length - 1].match_second); second += 1) {
    const frame = bySecond.get(second);
    const frameEvents = (eventsAt.get(second) || []).sort((a, b) => a.sequence - b.sequence);
    let motion = "stopped";
    let fromId = "";
    let toId = "";
    if (second === LIVE_CUTOFF_SECONDS && possession.id) {
      ball = holderAt(possession.id, second);
      motion = "controlled";
      fromId = possession.id;
      toId = possession.id;
    } else if (!frameEvents.length && flight) {
      const result = advanceFlight(second);
      motion = result.motion;
      fromId = flight?.sourceId || "";
      toId = flight?.targetId || "";
      if (!flight) fromId = toId || fromId;
    } else if (!frameEvents.length && possession.id) {
      ball = holderAt(possession.id, second);
      motion = "controlled";
      fromId = possession.id;
      toId = possession.id;
    } else if (!frameEvents.length) {
      motion = "stopped";
    }

    for (const event of frameEvents) {
      if (event.event_type === "phase" && ["full_time", "half_time"].includes(event.phase)) {
        possession = { id: "", team: "" };
        flight = null;
        lastTouch = event.event_id;
        motion = "stopped";
        fromId = toId = "";
        continue;
      }
      if (event.event_type === "goal" && event.outcome === "scored") {
        ball = { x: goalFor(event.team_code, Number(event.period)) * 0.995, y: 0 };
        possession = { id: "", team: "" };
        flight = null;
        lastTouch = event.event_id;
        motion = "goal";
        fromId = event.player_id;
        toId = `GOAL-${event.team_code}`;
        continue;
      }
      if (event.event_type === "shot" || event.event_type === "penalty_attempt") {
        const period = Number(event.period);
        const shooter = actorPos(event.player_id, second);
        if (event.outcome === "wide") {
          const side = stableHash(event.event_id) % 2 ? 1 : -1;
          ball = { x: goalFor(event.team_code, period), y: side * 4.2 };
          possession = { id: "", team: "" };
          flight = null;
          lastTouch = event.event_id;
          motion = "out";
          fromId = event.player_id;
          toId = "OUT";
        } else if (event.outcome === "blocked_out_for_corner") {
          const defender = event.related_player_id || "";
          startFlight(event, second, defender, actorPos(defender, second), "shot", "", "");
          motion = "shot";
          fromId = event.player_id;
          toId = defender;
        } else if (event.outcome === "saved") {
          const keeper = event.goalkeeper_id || "";
          startFlight(event, second, keeper, actorPos(keeper, second), "shot", keeper, teamForPlayerId(keeper) || "");
          motion = "shot";
          fromId = event.player_id;
          toId = keeper;
        } else {
          const goalId = `GOAL-${event.team_code}`;
          const goalPoint = { x: goalFor(event.team_code, period), y: 0 };
          startFlight(event, second, goalId, goalPoint, "shot", "", "");
          motion = "shot";
          fromId = event.player_id;
          toId = goalId;
        }
        void shooter;
        continue;
      }
      if (["pass", "restart_delivery"].includes(event.event_type)) {
        const targetId = event.related_player_id || event.possession_after_player_id;
        if (targetId) {
          const receiver = actorPos(targetId, second);
          startFlight(event, second, targetId, receiver, "transfer",
            targetId,
            teamForPlayerId(targetId) || event.possession_after_team_code || event.team_code || "");
          motion = "transfer";
          fromId = event.player_id;
          toId = targetId;
        }
        continue;
      }
      if (event.event_type === "ball_out") {
        ball = { x: Number(event.location_x), y: Number(event.location_y) };
        possession = { id: "", team: "" };
        flight = null;
        lastTouch = event.event_id;
        motion = "out";
        fromId = event.player_id;
        toId = "OUT";
        continue;
      }
      if (event.event_type === "challenge" && event.outcome === "foul") {
        ball = { x: Number(event.location_x), y: Number(event.location_y) };
        possession = { id: "", team: "" };
        flight = null;
        lastTouch = event.event_id;
        motion = "stopped";
        fromId = toId = "";
        continue;
      }
      if (stoppageTypes.has(event.event_type)) {
        if (event.event_type !== "corner_awarded" && event.location_x !== "" && event.location_y !== "") {
          const stoppagePoint = { x: Number(event.location_x), y: Number(event.location_y) };
          if (Math.hypot(stoppagePoint.x - ball.x, stoppagePoint.y - ball.y) <= 18) ball = stoppagePoint;
        }
        possession = { id: "", team: "" };
        flight = null;
        lastTouch = event.event_id;
        motion = "stopped";
        fromId = toId = "";
        continue;
      }
      if (controlledTypes.has(event.event_type)) {
        const id = event.possession_after_player_id || event.player_id || event.related_player_id;
        if (id) {
          ball = holderAt(id, second);
          possession = { id, team: event.possession_after_team_code || teamForPlayerId(id) || "" };
          flight = null;
          lastTouch = event.event_id;
          motion = "controlled";
          fromId = toId = id;
        }
        continue;
      }
      if (event.event_type === "carry") {
        ball = holderAt(event.player_id, second);
        possession = { id: event.player_id, team: event.team_code };
        flight = null;
        lastTouch = event.event_id;
        motion = "controlled";
        fromId = toId = event.player_id;
      }
      if (event.event_type === "goal" && event.outcome === "disallowed") {
        flight = null;
        possession = { id: "", team: "" };
        lastTouch = event.event_id;
        motion = "stopped";
      }
    }
    writeBall(frame, motion, fromId, toId);
  }

  // Rebuild the two explicitly designed incident sequences before the strict checks.
  const eventFor = (chainId, type, second) => events.find((event) => event.chain_id === chainId
    && event.event_type === type && event.match_second === second);
  const setFrameBall = (second, point, motion, interaction, fromId = "", toId = "", possId = "", height = 0) => {
    const frame = bySecond.get(second);
    frame.ball_x = roundPitchCoordinate(point.x);
    frame.ball_y = roundPitchCoordinate(point.y);
    frame.ball_z = roundPitchCoordinate(height);
    frame.ball_motion = motion;
    frame.ball_interaction_event_id = typeof interaction === "string" ? interaction : interaction?.event_id || "";
    frame.ball_from_player_id = fromId;
    frame.ball_to_player_id = toId;
    frame.possession_player_id = possId;
    frame.possession_team = teamForPlayerId(possId) || "";
    frame.possession_no = possId ? Number(possId.split("-")[1]) : "";
  };
  const offsideRecovery = eventFor("incident-offside", "ball_recovery", 1626);
  const offsidePass = eventFor("incident-offside", "pass", 1627);
  const offsideTouch = eventFor("incident-offside", "carry", 1628);
  const offsideShot = eventFor("incident-offside", "shot", 1629);
  const offsideCall = eventFor("incident-offside", "offside_decision", 1630);
  const offsideDelivery = eventFor("incident-offside", "restart_delivery", 1637);
  const offsideResolution = eventFor("incident-offside", "restart_resolution", 1639);
  if ([offsideRecovery, offsidePass, offsideTouch, offsideShot, offsideCall, offsideDelivery, offsideResolution].every(Boolean)) {
    const precedingCarry = events.find((event) => event.match_second === 1625 && event.event_type === "carry" && event.player_id === "MCI-9");
    const precedingTouch = events.filter((event) => event.match_second < 1625 && event.event_type === "pass"
      && event.related_player_id === "MCI-9").sort((a, b) => b.match_second - a.match_second)[0];
    setFrameBall(1624, actorPos("MCI-9", 1624), "controlled", precedingTouch?.event_id || "", "MCI-9", "MCI-9", "MCI-9");
    if (precedingCarry) setFrameBall(1625, actorPos("MCI-9", 1625), "controlled", precedingCarry.event_id, "MCI-9", "MCI-9", "MCI-9");
    const offsideSimulation = incidentSimulations.offside;
    const recoveryTime = simulationTimeAtMatchSecond("offside", offsideSimulation, 1626);
    const recoveryState = sampleOffsideFrame(offsideSimulation, recoveryTime);
    const recoveryBall = incidentBallMatchPoint("offside", recoveryState.ball);
    setFrameBall(1626, recoveryBall, "controlled", offsideRecovery.event_id,
      "ARS-8", "ARS-8", "ARS-8", recoveryBall.z);
    const releaseTime = simulationTimeAtMatchSecond("offside", offsideSimulation, 1627);
    const releaseState = sampleOffsideFrame(offsideSimulation, releaseTime);
    const releaseBall = incidentBallMatchPoint("offside", releaseState.ball);
    setFrameBall(1627, releaseBall, "transfer", offsidePass.event_id,
      "ARS-8", "ARS-9", "", releaseBall.z);
    setFrameBall(1628, actorPos("ARS-9", 1628), "controlled", offsideTouch.event_id, "ARS-9", "ARS-9", "ARS-9");
    const disallowedGoalPoint = { x: goalFor(offsideShot.team_code, Number(offsideShot.period)), y: 0 };
    setFrameBall(1629, disallowedGoalPoint, "goal", offsideShot.event_id, "ARS-9", "GOAL-ARS", "");
    const whistlePoint = actorPos("ARS-9", 1630);
    const stoppagePoint = disallowedGoalPoint;
    for (const second of [1630, 1631, 1632, 1633, 1634, 1635, 1636]) {
      const stoppageEvent = second <= 1632 ? offsideCall : eventFor("incident-offside", "var_review", 1633);
      setFrameBall(second, stoppagePoint, "stopped", stoppageEvent, "", "", "");
    }
    const restartPoint = actorPos("MCI-17", 1637);
    const resolutionPoint = actorPos("MCI-3", 1639);
    setFrameBall(1637, restartPoint, "transfer", offsideDelivery.event_id, "MCI-17", "MCI-3", "");
    setFrameBall(1638, { x: (restartPoint.x + resolutionPoint.x) / 2, y: (restartPoint.y + resolutionPoint.y) / 2 },
      "transfer", offsideDelivery.event_id, "MCI-17", "MCI-3", "");
    setFrameBall(1639, resolutionPoint, "controlled", offsideResolution.event_id, "MCI-3", "MCI-3", "MCI-3");
    setFrameBall(1640, actorPos("MCI-3", 1640), "controlled", offsideResolution.event_id, "MCI-3", "MCI-3", "MCI-3");
  }

  // Reconstruct the lead-in pass to the tackle so the receiver cannot be
  // treated as having possession before the ball has physically arrived.
  const tackleLeadPass = events.find((event) => event.event_id === "event-00953");
  const tackleLeadCarry = events.find((event) => event.event_id === "event-00954");
  if (tackleLeadPass && tackleLeadCarry && tackleLeadPass.related_player_id === "MCI-8") {
    const source = { x: Number(tackleLeadPass.location_x), y: Number(tackleLeadPass.location_y) };
    setFrameBall(4645, source, "transfer", tackleLeadPass.event_id,
      tackleLeadPass.player_id, tackleLeadPass.related_player_id, "");
    let routeBall = source;
    let arrived = false;
    for (let second = 4646; second < tackleLeadCarry.match_second; second += 1) {
      const target = actorPos(tackleLeadPass.related_player_id, second);
      const dx = target.x - routeBall.x;
      const dy = target.y - routeBall.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 17.5) {
        routeBall = target;
        arrived = true;
      } else {
        routeBall = { x: routeBall.x + dx / distance * 17.5, y: routeBall.y + dy / distance * 17.5 };
      }
      setFrameBall(second, routeBall, arrived ? "controlled" : "transfer", tackleLeadPass.event_id,
        tackleLeadPass.player_id, tackleLeadPass.related_player_id, arrived ? tackleLeadPass.related_player_id : "");
    }
    if (!arrived) throw new Error("Tackle lead-in pass does not reach MCI-8 before the next carry");
    setFrameBall(tackleLeadCarry.match_second, actorPos(tackleLeadCarry.player_id, tackleLeadCarry.match_second),
      "controlled", tackleLeadCarry.event_id, tackleLeadCarry.player_id, tackleLeadCarry.player_id, tackleLeadCarry.player_id);
    for (let second = tackleLeadCarry.match_second + 1; second < 4654; second += 1) {
      setFrameBall(second, actorPos(tackleLeadCarry.player_id, second), "controlled", tackleLeadCarry.event_id,
        tackleLeadCarry.player_id, tackleLeadCarry.player_id, tackleLeadCarry.player_id);
    }
  }

  const tackleRecovery = events.find((event) => event.chain_id === "incident-tackle-77" && event.event_type === "ball_recovery");
  const tackleCarry1 = events.find((event) => event.chain_id === "incident-tackle-77" && event.event_type === "carry" && event.match_second === 4655);
  const tackleCarry2 = events.find((event) => event.chain_id === "incident-tackle-77" && event.event_type === "carry" && event.match_second === 4656);
  const tackle = eventFor("incident-tackle-77", "challenge", 4657);
  const tackleCall = eventFor("incident-tackle-77", "foul_decision", 4658);
  const tackleDelivery = eventFor("incident-tackle-77", "restart_delivery", 4672);
  const tackleResolution = eventFor("incident-tackle-77", "restart_resolution", 4674);
  if ([tackleRecovery, tackleCarry1, tackleCarry2, tackle, tackleCall, tackleDelivery, tackleResolution].every(Boolean)) {
    setFrameBall(4654, actorPos("ARS-7", 4654), "controlled", tackleRecovery.event_id, "ARS-7", "ARS-7", "ARS-7");
    const tackleSimulation = incidentSimulations.tackle;
    for (const [second, interaction] of [[4655, tackleCarry1], [4656, tackleCarry2]]) {
      const time = simulationTimeAtMatchSecond("tackle", tackleSimulation, second);
      const state = sampleFrame(tackleSimulation, time);
      const point = incidentBallMatchPoint("tackle", state.ball);
      setFrameBall(second, point, "controlled", interaction.event_id, "ARS-7", "ARS-7", "ARS-7", point.z);
    }
    const contactTime = simulationTimeAtMatchSecond("tackle", tackleSimulation, 4657);
    const contactState = sampleFrame(tackleSimulation, contactTime);
    const contactBall = incidentBallMatchPoint("tackle", contactState.ball);
    setFrameBall(4657, contactBall, "controlled", tackle.event_id, "ARS-7", "ARS-7", "ARS-7", contactBall.z);
    const whistleTime = tackleSimulation.events.find((item) => item.id === "whistle").t;
    const whistleState = sampleFrame(tackleSimulation, whistleTime);
    const whistleBall = incidentBallMatchPoint("tackle", whistleState.ball);
    for (const second of [4658, 4659, 4660, 4661, 4662, 4663, 4664, 4665, 4666, 4667, 4668, 4669, 4670, 4671]) {
      setFrameBall(second, whistleBall, "stopped", tackleCall.event_id, "", "", "", whistleBall.z);
    }
    setFrameBall(4672, actorPos("ARS-8", 4672), "transfer", tackleDelivery.event_id, "ARS-8", "ARS-7", "");
    setFrameBall(4673, actorPos("ARS-7", 4673), "controlled", tackleDelivery.event_id, "ARS-8", "ARS-7", "ARS-7");
    setFrameBall(4674, actorPos("ARS-9", 4674), "controlled", tackleResolution.event_id, "ARS-7", "ARS-9", "ARS-9");
    for (let second = 4675; second <= 4677; second += 1) {
      setFrameBall(second, actorPos("ARS-9", second), "controlled", tackleResolution.event_id, "ARS-9", "ARS-9", "ARS-9");
    }
    const nextPass = events.find((event) => event.event_type === "pass" && event.match_second === 4678);
    if (nextPass) {
      const from = actorPos(nextPass.player_id, 4678);
      const to = actorPos(nextPass.related_player_id, 4678);
      setFrameBall(4678, from, "transfer", nextPass.event_id, nextPass.player_id, nextPass.related_player_id, "");
      setFrameBall(4679, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
        "transfer", nextPass.event_id, nextPass.player_id, nextPass.related_player_id, "");
      setFrameBall(4680, actorPos(nextPass.related_player_id, 4680), "controlled", nextPass.event_id,
        nextPass.player_id, nextPass.related_player_id, nextPass.related_player_id);
    }
  }

  // Keep every live controlled-ball sample attached to the current holder after
  // the incident-specific timeline corrections above.
  for (const frame of frames) {
    const second = Number(frame.match_second);
    const criticalSpan = second >= LIVE_CUTOFF_SECONDS || (second >= 1600 && second <= 1645) || (second >= 4635 && second <= 4680);
    if (!criticalSpan || frame.ball_motion !== "controlled" || !frame.possession_player_id
      || [1626, 4655, 4656, 4657].includes(second)) continue;
    const holder = JSON.parse(frame.actors).find((actor) => actor.person_id === frame.possession_player_id);
    if (!holder) throw new Error(`${frame.frame_id} possession holder ${frame.possession_player_id} is absent while reconciling controlled ball`);
    frame.ball_x = round2(Number(holder.x));
    frame.ball_y = round2(Number(holder.y));
  }

  const interpolateActors = (matchSecond) => {
    const lowerSecond = Math.floor(matchSecond);
    const upperSecond = Math.ceil(matchSecond);
    const lower = bySecond.get(lowerSecond);
    const upper = bySecond.get(upperSecond);
    if (!lower || !upper) throw new Error(`No base frames bracket incident sample at ${matchSecond}`);
    const leftActors = JSON.parse(lower.actors);
    if (lowerSecond === upperSecond) return leftActors;
    const rightById = new Map(JSON.parse(upper.actors).map((actor) => [actor.person_id, actor]));
    const fraction = matchSecond - lowerSecond;
    return leftActors.map((actor) => {
      const next = rightById.get(actor.person_id);
      if (!next || actor.status !== "active" || next.status !== "active") return { ...actor };
      return {
        ...actor,
        x: roundPitchCoordinate(Number(actor.x) + (Number(next.x) - Number(actor.x)) * fraction),
        y: roundPitchCoordinate(Number(actor.y) + (Number(next.y) - Number(actor.y)) * fraction),
      };
    });
  };
  const denseIncidentFrames = [];
  const addIncidentSamples = (kind) => {
    const simulation = incidentSimulations[kind];
    const sampler = incidentSamplers[kind];
    const stepCount = Math.round(simulation.duration / INCIDENT_TRACKING_SAMPLE_STEP);
    const track = INCIDENT_TRACKING[kind];
    for (let index = 0; index <= stepCount; index += 1) {
      const time = Math.min(simulation.duration, index * INCIDENT_TRACKING_SAMPLE_STEP);
      const matchSecond = matchSecondAtSimulationTime(kind, simulation, time);
      const matchMs = simulationMatchMilliseconds(kind, simulation, time);
      if (matchMs % 1000 === 0) continue;
      const state = sampler(simulation, time);
      const actors = interpolateActors(matchMs / 1000);
      for (const [role, id] of Object.entries(track.actors)) {
        const actor = actors.find((item) => item.person_id === id);
        const point = incidentActorMatchPoint(kind, state[role]);
        actor.x = roundPitchCoordinate(clamp(point.x, -52.5, 52.5));
        actor.y = roundPitchCoordinate(clamp(point.y, -34, 34));
      }

      const ball = incidentBallMatchPoint(kind, state.ball);
      let motion;
      let interaction;
      let fromId = "";
      let toId = "";
      let possessionId = "";
      if (kind === "offside") {
        const recovery = events.find((event) => event.chain_id === "incident-offside" && event.event_type === "ball_recovery");
        const pass = events.find((event) => event.chain_id === "incident-offside" && event.event_type === "pass");
        const beforeRelease = time < simulation.contactT;
        motion = beforeRelease ? "controlled" : "transfer";
        interaction = beforeRelease ? recovery : pass;
        fromId = "ARS-8";
        toId = beforeRelease ? "ARS-8" : "ARS-9";
        possessionId = beforeRelease ? "ARS-8" : "";
      } else {
        const recovery = events.find((event) => event.chain_id === "incident-tackle-77" && event.event_type === "ball_recovery");
        const carries = events.filter((event) => event.chain_id === "incident-tackle-77" && event.event_type === "carry")
          .sort((a, b) => a.match_second - b.match_second);
        const challenge = events.find((event) => event.chain_id === "incident-tackle-77" && event.event_type === "challenge");
        const whistle = simulation.events.find((event) => event.id === "whistle");
        const decision = events.find((event) => event.chain_id === "incident-tackle-77" && event.event_type === "foul_decision");
        const globalTime = matchSecondAtSimulationTime(kind, simulation, time);
        if (time >= whistle.t) {
          motion = "stopped";
          interaction = decision;
        } else if (time >= simulation.contactT + 0.04) {
          motion = "transfer";
          interaction = challenge;
          fromId = "ARS-7";
        } else {
          motion = "controlled";
          interaction = globalTime < 4655.5 ? carries.find((event) => event.match_second === 4655) :
            globalTime < 4656.5 ? carries.find((event) => event.match_second === 4656) : challenge;
          interaction ||= recovery;
          fromId = "ARS-7";
          toId = "ARS-7";
          possessionId = "ARS-7";
        }
      }
      const period = periodForMatchSecond(matchMs / 1000, half1Seconds);
      const periodMs = period === 1 ? matchMs : matchMs - half1Seconds * 1000;
      const wholeClock = formatElapsedClock(matchMs / 1000, half1Seconds, 2880);
      const fraction = Math.round(matchMs % 1000);
      denseIncidentFrames.push({
        frame_id: `frame-incident-${kind}-${String(index).padStart(4, "0")}`,
        match_ms: matchMs,
        match_second: matchMs / 1000,
        period,
        period_ms: periodMs,
        clock_label: fraction ? `${wholeClock}.${String(fraction).padStart(3, "0")}` : wholeClock,
        ball_x: roundPitchCoordinate(ball.x),
        ball_y: roundPitchCoordinate(ball.y),
        ball_z: roundPitchCoordinate(ball.z),
        ball_motion: motion,
        ball_interaction_event_id: interaction?.event_id || "",
        ball_from_player_id: fromId,
        ball_to_player_id: toId,
        possession_team: teamForPlayerId(possessionId) || "",
        possession_player_id: possessionId,
        possession_no: possessionId ? Number(possessionId.split("-")[1]) : "",
        event_ids: "[]",
        actors: JSON.stringify(actors),
      });
    }
  };
  addIncidentSamples("offside");
  addIncidentSamples("tackle");
  frames.push(...denseIncidentFrames);
  frames.sort((left, right) => Number(left.match_ms) - Number(right.match_ms)
    || String(left.frame_id).localeCompare(String(right.frame_id)));
}

const EVENT_HEADERS = [
  "event_id", "sequence", "period", "period_ms", "match_ms", "match_second", "clock_label", "minute_label", "period_added_seconds", "phase", "frame_id",
  "chain_id", "parent_event_id", "event_type", "action", "outcome", "team_code", "awarded_team_code", "player_id", "related_player_id", "target_player_id", "goalkeeper_id", "referee_id", "participant_ids",
  "decision", "decision_type", "decision_label", "decision_detail", "restart_type", "score", "score_home", "score_away", "score_delta", "is_shot", "count_in_stats", "shot_on_target", "big_chance", "xg", "pass_completed", "duel_won", "counts_as_foul", "counts_as_save", "incident_id", "is_timeline_event", "show_in_commentary", "commentary", "detail", "location_x", "location_y", "target_x", "target_y", "possession_after_player_id", "possession_after_team_code",
];
const FRAME_HEADERS = [
  "frame_id", "match_ms", "match_second", "period", "period_ms", "clock_label", "ball_x", "ball_y", "ball_z", "ball_motion", "ball_interaction_event_id", "ball_from_player_id", "ball_to_player_id", "possession_team", "possession_player_id", "possession_no", "event_ids", "actors",
];

function assertDataset(events, frames, people, half1Seconds, half2Seconds, home, away) {
  const frameById = new Map(frames.map((frame) => [frame.frame_id, frame]));
  const personIds = new Set(people.filter((person) => !person.role).map((person) => playerId(person.team, person.no)));
  const priorLocations = new Map();
  const eventIds = new Set();
  const eventsById = new Map(events.map((event) => [event.event_id, event]));
  for (const event of events) {
    if (eventIds.has(event.event_id)) throw new Error(`Duplicate event_id ${event.event_id}`);
    eventIds.add(event.event_id);
    if (event.event_type === "pass") {
      const completed = event.pass_completed === true;
      if (completed && teamForPlayerId(event.related_player_id) !== event.team_code) {
        throw new Error(`${event.event_id} completed pass changes team without a recovery event`);
      }
      if (!completed && event.outcome === "intercepted"
        && (teamForPlayerId(event.related_player_id) === event.team_code
          || event.possession_after_player_id !== event.related_player_id)) {
        throw new Error(`${event.event_id} intercepted pass does not assign the ball to its interceptor`);
      }
    }
    if (event.event_type === "carry"
      && (event.possession_after_player_id !== event.player_id || event.possession_after_team_code !== event.team_code)) {
      throw new Error(`${event.event_id} carry does not preserve the carrier's possession`);
    }
    if (event.event_type === "ball_recovery"
      && (!event.player_id || !event.related_player_id || teamForPlayerId(event.player_id) === teamForPlayerId(event.related_player_id)
        || event.possession_after_player_id !== event.player_id || event.possession_after_team_code !== event.team_code)) {
      throw new Error(`${event.event_id} recovery does not transfer possession from an opponent to the winner`);
    }
    const frame = frameById.get(event.frame_id);
    if (!frame) throw new Error(`${event.event_id} has no frame ${event.frame_id}`);
    if (frame.match_ms !== event.match_ms) throw new Error(`${event.event_id} and ${frame.frame_id} have different timestamps`);
    if (!JSON.parse(frame.event_ids).includes(event.event_id)) throw new Error(`${event.event_id} is absent from its linked frame`);
    if (["foul_decision", "corner_awarded", "penalty_awarded", "offside_decision"].includes(event.event_type)
      && (frame.ball_motion !== "stopped" || frame.possession_player_id)) {
      throw new Error(`${event.event_id} whistle frame must have a stationary ball and no live possession`);
    }
    if (event.event_type === "goal" && event.outcome === "scored"
      && (frame.ball_motion !== "goal" || frame.possession_player_id)) {
      throw new Error(`${event.event_id} scored goal is not reflected by a goal frame`);
    }
    if (event.event_type === "ball_recovery" && frame.ball_motion !== "stopped" && frame.ball_motion !== "out"
      && frame.possession_player_id && frame.possession_player_id !== event.possession_after_player_id) {
      const laterSameSecondAction = JSON.parse(frame.event_ids).map((id) => eventsById.get(id)).filter(Boolean)
        .some((later) => later.sequence > event.sequence && (later.possession_after_player_id || ["foul_decision", "corner_awarded", "penalty_awarded", "offside_decision"].includes(later.event_type)));
      if (!laterSameSecondAction) throw new Error(`${event.event_id} recovery does not give possession to its winner in ${frame.frame_id}`);
    }
    for (const id of JSON.parse(event.participant_ids)) {
      const actor = JSON.parse(frame.actors).find((item) => item.person_id === id);
      if (!actor) throw new Error(`${event.event_id} participant ${id} is absent from frame ${frame.frame_id}`);
      if (personIds.has(id)) {
        const outgoingSubstitute = event.event_type === "substitution" && id === event.related_player_id && actor.status === "subbed_off";
        if (actor.status !== "active" && !outgoingSubstitute) {
          throw new Error(`${event.event_id} participant ${id} has status ${actor.status}`);
        }
      }
    }
  }
  const secondFrames = frames.filter((frame) => Number.isInteger(Number(frame.match_second)));
  if (secondFrames.length !== half1Seconds + half2Seconds + 1) throw new Error("Frame table does not cover every whole second through full time");
  for (let index = 1; index < secondFrames.length; index += 1) {
    if (Number(secondFrames[index].match_second) !== Number(secondFrames[index - 1].match_second) + 1) {
      throw new Error("Whole-second frame timestamps contain a gap");
    }
  }
  for (let index = 1; index < frames.length; index += 1) {
    const previousFrame = frames[index - 1];
    const currentFrame = frames[index];
    if (currentFrame.possession_player_id && currentFrame.possession_player_id !== previousFrame.possession_player_id) {
      const nextHolder = currentFrame.possession_player_id;
      const frameEvents = JSON.parse(currentFrame.event_ids).map((id) => eventsById.get(id)).filter(Boolean);
      const holderWasInvolved = frameEvents.some((event) => JSON.parse(event.participant_ids).includes(nextHolder));
      const wasKickoff = frameEvents.some((event) => event.event_type === "phase" && ["kick_off", "second_half"].includes(event.phase));
      const previousRoute = eventsById.get(previousFrame.ball_interaction_event_id);
      const arrivedFromLinkedPass = previousFrame.ball_to_player_id === nextHolder
        && (["pass", "restart_delivery"].includes(previousRoute?.event_type)
          || previousRoute?.event_type === "shot" && previousRoute.outcome === "saved");
      const currentInteraction = eventsById.get(currentFrame.ball_interaction_event_id);
      const linkedRecovery = currentInteraction?.event_type === "ball_recovery"
        && currentInteraction.possession_after_player_id === nextHolder;
      const linkedReception = currentInteraction?.event_type === "pass"
        && currentInteraction.related_player_id === nextHolder;
      if (!holderWasInvolved && !wasKickoff && !arrivedFromLinkedPass && !linkedRecovery && !linkedReception) {
        throw new Error(`${currentFrame.frame_id} changes possession to ${nextHolder} without a linked player interaction`);
      }
    }
    if (Number(previousFrame.period) === Number(currentFrame.period)) {
      const ballSpeed = Math.hypot(Number(currentFrame.ball_x) - Number(previousFrame.ball_x), Number(currentFrame.ball_y) - Number(previousFrame.ball_y));
      const frameEvents = JSON.parse(currentFrame.event_ids).map((id) => eventsById.get(id)).filter(Boolean);
      if (ballSpeed > 0.05) {
        const touch = eventsById.get(currentFrame.ball_interaction_event_id);
        const touchTypes = new Set(["phase", "pass", "carry", "ball_recovery", "challenge", "shot", "penalty_attempt", "save", "block", "aerial_duel", "restart_delivery", "restart_resolution", "handball_contact", "substitution", "goal", "ball_out", "foul_decision", "offside_decision", "corner_awarded", "penalty_awarded"]);
        if (!touch || !touchTypes.has(touch.event_type)) {
          throw new Error(`${currentFrame.frame_id} ball moved without a linked touch, restart, goal, or out-of-play event`);
        }
      }
      const shotExit = frameEvents.some((event) => ["shot", "penalty_attempt"].includes(event.event_type)
        && ["wide", "goal_disallowed"].includes(event.outcome));
      const allowedBallExit = frameEvents.some((event) => event.event_type === "ball_out"
        || event.event_type === "goal" && event.outcome === "scored") || shotExit;
      if (ballSpeed > 18.01 && !allowedBallExit) {
        const eventTypes = frameEvents.map((event) => event.event_type).join(",") || "none";
        throw new Error(`${currentFrame.frame_id} ball moves ${ballSpeed.toFixed(1)}m in one sample without an exit or goal event (from=${previousFrame.ball_x},${previousFrame.ball_y} to=${currentFrame.ball_x},${currentFrame.ball_y}, motion=${previousFrame.ball_motion}->${currentFrame.ball_motion}, interaction=${currentFrame.ball_interaction_event_id || "none"}, events=${frameEvents.map((event) => `${event.event_id}:${event.event_type}:${event.player_id}:${event.related_player_id}`).join("|")})`);
      }
      const strictMotionSpan = Number(currentFrame.match_second) >= LIVE_CUTOFF_SECONDS
        || Number(currentFrame.match_second) >= 1600 && Number(currentFrame.match_second) <= 1645
        || Number(currentFrame.match_second) >= 4635 && Number(currentFrame.match_second) <= 4680;
      if (strictMotionSpan && shotExit && ballSpeed > 35.01) {
        throw new Error(`${currentFrame.frame_id} shot exits at ${ballSpeed.toFixed(1)}m/s, above the 35m/s shot-speed ceiling (from=${previousFrame.ball_x},${previousFrame.ball_y} to=${currentFrame.ball_x},${currentFrame.ball_y}; ${frameEvents.map((event) => `${event.event_id}:${event.event_type}:${event.player_id}:${event.outcome}`).join("|")})`);
      }
    }
  }
  for (const frame of frames) {
    const actorRows = JSON.parse(frame.actors);
    const actorsById = new Map(actorRows.map((actor) => [actor.person_id, actor]));
    const ids = actorRows.map((actor) => actor.person_id);
    if (new Set(ids).size !== ids.length) throw new Error(`${frame.frame_id} has duplicate actors`);
    const activeActors = actorRows.filter((actor) => actor.status === "active");
    const active = activeActors.filter((actor) => actor.team);
    const homeCount = active.filter((actor) => actor.team === home).length;
    const awayCount = active.filter((actor) => actor.team === away).length;
    if (frame.match_second < half1Seconds + half2Seconds && (homeCount !== 11 || awayCount !== 11)) {
      throw new Error(`${frame.frame_id} active-player count is ${homeCount}-${awayCount}`);
    }
    if (Number(frame.ball_x) < -52.5 || Number(frame.ball_x) > 52.5 || Number(frame.ball_y) < -34 || Number(frame.ball_y) > 34) {
      throw new Error(`${frame.frame_id} ball is outside the pitch`);
    }
    if (!["controlled", "transfer", "shot", "stopped", "goal", "out"].includes(frame.ball_motion)) {
      throw new Error(`${frame.frame_id} has unknown ball motion ${frame.ball_motion}`);
    }
    if (["transfer", "shot"].includes(frame.ball_motion)) {
      const interaction = eventsById.get(frame.ball_interaction_event_id);
      if (!interaction) throw new Error(`${frame.frame_id} ball route has no linked interaction event`);
      if (frame.ball_to_player_id && !frame.ball_to_player_id.startsWith("GOAL-")
        && frame.ball_to_player_id !== "OUT" && !actorsById.has(frame.ball_to_player_id)) {
        throw new Error(`${frame.frame_id} ball route ends at missing player ${frame.ball_to_player_id}`);
      }
      const isPhaseRestart = interaction.event_type === "phase" && ["kick_off", "second_half"].includes(interaction.phase);
      if (frame.ball_to_player_id && !frame.ball_to_player_id.startsWith("GOAL-")
        && frame.ball_to_player_id !== "OUT" && !isPhaseRestart
        && !JSON.parse(interaction.participant_ids).includes(frame.ball_to_player_id)) {
        throw new Error(`${frame.frame_id} ball route target ${frame.ball_to_player_id} is not linked to ${interaction.event_id}`);
      }
    }
    if (frame.ball_motion === "controlled" && frame.possession_player_id) {
      const holder = actorsById.get(frame.possession_player_id);
      if (!holder || Math.hypot(Number(frame.ball_x) - holder.x, Number(frame.ball_y) - holder.y) > 1.1) {
        throw new Error(`${frame.frame_id} controlled ball is detached from ${frame.possession_player_id}: ball=${frame.ball_x},${frame.ball_y} actor=${holder?.x},${holder?.y} touch=${frame.ball_interaction_event_id}`);
      }
    }
    for (const actor of activeActors) {
      const prior = priorLocations.get(actor.person_id);
      const elapsedSeconds = prior ? (Number(frame.match_ms) - prior.matchMs) / 1000 : 0;
      if (prior && elapsedSeconds > 0 && prior.period === frame.period) {
        const speed = Math.hypot(actor.x - prior.x, actor.y - prior.y) / elapsedSeconds;
        if (speed > 10.51) throw new Error(`${frame.frame_id} ${actor.person_id} moves at ${speed.toFixed(1)}m/s (above the 10.5m/s match-speed ceiling)`);
      }
      priorLocations.set(actor.person_id, { x: actor.x, y: actor.y, matchMs: Number(frame.match_ms), period: frame.period });
    }
    const poss = actorRows.find((actor) => actor.person_id === frame.possession_player_id);
    if (frame.possession_player_id && (!poss || poss.status !== "active" || poss.team !== frame.possession_team)) {
      throw new Error(`${frame.frame_id} possession points to an inactive or mismatched actor`);
    }
    for (const id of JSON.parse(frame.event_ids)) {
      if (!eventIds.has(id)) throw new Error(`${frame.frame_id} references unknown event ${id}`);
    }
  }
  for (const event of events.filter((item) => item.event_type === "pass")) {
    const frame = frameById.get(event.frame_id);
    const actorRows = JSON.parse(frame.actors);
    const passer = actorRows.find((actor) => actor.person_id === event.player_id);
    const receiver = actorRows.find((actor) => actor.person_id === event.related_player_id);
    if (!passer || !receiver
      || Math.hypot(Number(event.location_x) - passer.x, Number(event.location_y) - passer.y) > 0.02
      || Math.hypot(Number(event.target_x) - receiver.x, Number(event.target_y) - receiver.y) > 0.02) {
      throw new Error(`${event.event_id} pass coordinates do not align with the passer and receiver in ${frame.frame_id}`);
    }
  }
  const incidentIds = new Set(events.map((event) => event.incident_id).filter(Boolean));
  for (const required of ["offside", "handball", "tackle", "conflict"]) {
    if (!incidentIds.has(required)) throw new Error(`Missing incident chain ${required}`);
  }
  let previousMatchMs = -1;
  for (const event of events) {
    if (event.match_ms < previousMatchMs) throw new Error("Events are not in chronological order");
    previousMatchMs = event.match_ms;
    if (event.parent_event_id && !eventIds.has(event.parent_event_id)) throw new Error(`${event.event_id} references missing parent ${event.parent_event_id}`);
    if (event.event_type === "corner_awarded") {
      const chain = events.filter((item) => item.chain_id === event.chain_id);
      const shot = chain.find((item) => item.event_type === "shot" && item.outcome === "blocked_out_for_corner");
      const block = chain.find((item) => item.event_type === "block");
      const ballOut = chain.find((item) => item.event_type === "ball_out" && item.outcome === "corner");
      const delivery = chain.find((item) => item.event_type === "restart_delivery" && item.restart_type === "corner");
      const resolution = chain.find((item) => item.event_type === "aerial_duel");
      const sequence = [shot, block, ballOut, event, delivery, resolution];
      if (sequence.some((item) => !item || !item.detail)
        || !event.decision || !delivery.is_timeline_event || !resolution.is_timeline_event) {
        throw new Error(`${event.chain_id} is missing a detailed, timeline-visible corner sequence`);
      }
    }
    if (event.event_type === "foul_decision" && event.restart_type !== "penalty") {
      const chain = events.filter((item) => item.chain_id === event.chain_id);
      const challenge = chain.find((item) => item.event_type === "challenge");
      const delivery = chain.find((item) => item.event_type === "restart_delivery");
      const resolution = chain.find((item) => item.event_type === "restart_resolution");
      if ([challenge, event, delivery, resolution].some((item) => !item || !item.detail)
        || !event.decision || !delivery.is_timeline_event || !resolution.is_timeline_event) {
        throw new Error(`${event.chain_id} is missing a detailed, timeline-visible free-kick sequence`);
      }
    }
    if (event.event_type === "penalty_awarded") {
      const chain = events.filter((item) => item.chain_id === event.chain_id);
      const attempt = chain.find((item) => item.event_type === "penalty_attempt");
      const outcome = chain.find((item) => item.event_type === "goal" || item.event_type === "save");
      if (!event.decision || !event.detail || !attempt?.detail || !attempt.is_timeline_event || !outcome?.detail) {
        throw new Error(`${event.chain_id} has an incomplete penalty decision, kick, or outcome`);
      }
    }
    if (event.event_type === "penalty_attempt" && event.decision) throw new Error(`${event.event_id} treats a penalty result as a decision`);
    if (event.event_type === "offside_decision" && event.restart_type) {
      const chain = events.filter((item) => item.chain_id === event.chain_id);
      const delivery = chain.find((item) => item.event_type === "restart_delivery");
      const resolution = chain.find((item) => item.event_type === "restart_resolution");
      if (!event.detail || !delivery?.detail || !resolution?.detail
        || !delivery.is_timeline_event || !resolution.is_timeline_event) {
        throw new Error(`${event.chain_id} has an incomplete indirect-free-kick restart`);
      }
    }
    if (event.decision && (!event.decision_type || !event.decision_detail)) throw new Error(`${event.event_id} has an incomplete decision record`);
    if (event.event_type === "card_shown" && !event.parent_event_id) throw new Error(`${event.event_id} card has no preceding foul decision`);
  }
}

function assertCriticalTimelines(events, frames, people, home, away) {
  const bySecond = new Map(frames.map((frame) => [Number(frame.match_second), frame]));
  const byMatchMs = new Map(frames.map((frame) => [Number(frame.match_ms), frame]));
  const byEventId = new Map(events.map((event) => [event.event_id, event]));
  const incidentEvent = (chainId, eventType, second) => {
    const event = events.find((item) => item.chain_id === chainId && item.event_type === eventType
      && Number(item.match_second) === second);
    if (!event) throw new Error(`${chainId} is missing ${eventType} at ${second}`);
    return event;
  };
  const close = (a, b, tolerance = 0.03) => Math.abs(Number(a) - Number(b)) <= tolerance;
  const assertControlled = (second, playerId, eventId) => {
    const frame = bySecond.get(second);
    const actor = JSON.parse(frame.actors).find((item) => item.person_id === playerId);
    if (frame.ball_motion !== "controlled" || frame.possession_player_id !== playerId
      || frame.ball_interaction_event_id !== eventId || !actor
      || Math.hypot(Number(frame.ball_x) - Number(actor.x), Number(frame.ball_y) - Number(actor.y)) > 1.1) {
      throw new Error(`Critical frame ${second} does not show ${playerId} controlling the ball after ${eventId}`);
    }
  };
  const assertRoute = (second, event, receiverId) => {
    const frame = bySecond.get(second);
    if (frame.ball_motion !== "transfer" || frame.ball_interaction_event_id !== event.event_id
      || frame.ball_from_player_id !== event.player_id || frame.ball_to_player_id !== receiverId
      || frame.possession_player_id || !JSON.parse(event.participant_ids).includes(receiverId)
      || Math.hypot(Number(frame.ball_x) - Number(event.location_x), Number(frame.ball_y) - Number(event.location_y)) > 1.1) {
      throw new Error(`${event.event_id} route is not represented at frame ${second}`);
    }
  };
  const assertStopped = (start, end, point, interactionBySecond) => {
    for (let second = start; second <= end; second += 1) {
      const frame = bySecond.get(second);
      if (!frame || frame.ball_motion !== "stopped" || frame.possession_player_id
        || !close(frame.ball_x, point.x) || !close(frame.ball_y, point.y)
        || frame.ball_interaction_event_id !== interactionBySecond(second)) {
        throw new Error(`Critical stoppage is not stationary and unpossessed at frame ${second}`);
      }
    }
  };
  const assertIncidentSamples = (kind, simulation, sampler) => {
    const track = INCIDENT_TRACKING[kind];
    const expectedDenseIds = new Set();
    const stepCount = Math.round(simulation.duration / INCIDENT_TRACKING_SAMPLE_STEP);
    for (let index = 0; index <= stepCount; index += 1) {
      const time = Math.min(simulation.duration, index * INCIDENT_TRACKING_SAMPLE_STEP);
      const matchMs = simulationMatchMilliseconds(kind, simulation, time);
      const frame = byMatchMs.get(matchMs);
      if (!frame) throw new Error(`${kind} simulation sample ${index} at ${matchMs}ms is missing from frames.csv`);
      if (matchMs % 1000 !== 0) expectedDenseIds.add(frame.frame_id);
      const state = sampler(simulation, time);
      const actors = new Map(JSON.parse(frame.actors).map((actor) => [actor.person_id, actor]));
      for (const [role, id] of Object.entries(track.actors)) {
        const expected = incidentActorMatchPoint(kind, state[role]);
        const actual = actors.get(id);
        if (!actual || Math.abs(Number(actual.x) - roundPitchCoordinate(expected.x)) > 0.0051
          || Math.abs(Number(actual.y) - roundPitchCoordinate(expected.y)) > 0.0051) {
          throw new Error(`${kind} ${role} coordinates at ${matchMs}ms differ from Tactical Eye`);
        }
      }
      const expectedBall = incidentBallMatchPoint(kind, state.ball);
      if (Math.abs(Number(frame.ball_x) - roundPitchCoordinate(expectedBall.x)) > 0.0051
        || Math.abs(Number(frame.ball_y) - roundPitchCoordinate(expectedBall.y)) > 0.0051
        || Math.abs(Number(frame.ball_z) - roundPitchCoordinate(expectedBall.z)) > 0.0051) {
        throw new Error(`${kind} ball coordinates at ${matchMs}ms differ from Tactical Eye`);
      }
    }
    const actualDenseIds = new Set(frames.filter((frame) => frame.frame_id.startsWith(`frame-incident-${kind}-`))
      .map((frame) => frame.frame_id));
    if (actualDenseIds.size !== expectedDenseIds.size
      || [...expectedDenseIds].some((id) => !actualDenseIds.has(id))) {
      throw new Error(`${kind} incident frames are not a complete 120 Hz Tactical Eye track`);
    }
  };
  const assertAnchor = (kind, eventType, matchSecond) => {
    const chainId = kind === "tackle" ? "incident-tackle-77" : "incident-offside";
    const event = events.find((item) => item.chain_id === chainId && item.event_type === eventType);
    if (!event || Number(event.match_ms) !== matchSecond * 1000
      || Number(event.match_second) !== matchSecond) {
      throw new Error(`${kind} ${eventType} event is not anchored to ${matchSecond}s`);
    }
  };
  const offsideSimulation = buildOffsideSimulation();
  const tackleSimulation = buildSimulation();
  assertIncidentSamples("offside", offsideSimulation, sampleOffsideFrame);
  assertIncidentSamples("tackle", tackleSimulation, sampleFrame);
  assertAnchor("offside", "ball_recovery", INCIDENT_TRACKING.offside.anchorSecond - 1);
  assertAnchor("offside", "pass", INCIDENT_TRACKING.offside.anchorSecond);
  assertAnchor("tackle", "challenge", INCIDENT_TRACKING.tackle.anchorSecond);
  assertAnchor("tackle", "foul_decision", INCIDENT_TRACKING.tackle.anchorSecond + 1);

  // The offside incident has a complete turnover -> pass -> offside shot ->
  // whistle/VAR -> restart chain, with no live possession during the review.
  const offsideRecovery = incidentEvent("incident-offside", "ball_recovery", 1626);
  const offsidePass = incidentEvent("incident-offside", "pass", 1627);
  const offsideTouch = incidentEvent("incident-offside", "carry", 1628);
  const offsideShot = incidentEvent("incident-offside", "shot", 1629);
  const disallowedGoal = events.find((item) => item.chain_id === "incident-offside"
    && item.event_type === "goal" && item.outcome === "disallowed" && Number(item.match_second) === 1629);
  const offsideCall = incidentEvent("incident-offside", "offside_decision", 1630);
  const offsideReview = incidentEvent("incident-offside", "var_review", 1633);
  const offsideDelivery = incidentEvent("incident-offside", "restart_delivery", 1637);
  const offsideResolution = incidentEvent("incident-offside", "restart_resolution", 1639);
  if (!disallowedGoal || offsideShot.outcome !== "goal_disallowed" || disallowedGoal.parent_event_id !== offsideShot.event_id) {
    throw new Error("Offside shot, disallowed goal, and incident chain do not agree");
  }
  assertControlled(1626, offsideRecovery.player_id, offsideRecovery.event_id);
  assertRoute(1627, offsidePass, offsidePass.related_player_id);
  assertControlled(1628, offsideTouch.player_id, offsideTouch.event_id);
  const offsideShotFrame = bySecond.get(1629);
  if (offsideShotFrame.ball_motion !== "goal" || offsideShotFrame.ball_interaction_event_id !== offsideShot.event_id
    || offsideShotFrame.ball_to_player_id !== `GOAL-${offsideShot.team_code}`
    || !close(offsideShotFrame.ball_x, offsideShot.target_x) || !close(offsideShotFrame.ball_y, 0)
    || !close(disallowedGoal.location_x, offsideShotFrame.ball_x) || !close(disallowedGoal.location_y, offsideShotFrame.ball_y)) {
    throw new Error("Offside shot does not reach the disallowed goal recorded by the event table");
  }
  const whistlePoint = JSON.parse(bySecond.get(1630).actors).find((actor) => actor.person_id === offsideCall.player_id);
  if (!whistlePoint || !close(offsideCall.location_x, whistlePoint.x) || !close(offsideCall.location_y, whistlePoint.y)
    || !close(offsideReview.location_x, whistlePoint.x) || !close(offsideReview.location_y, whistlePoint.y)) {
    throw new Error("Offside decision and VAR coordinates do not match the flagged runner");
  }
  assertStopped(1630, 1636, { x: offsideShotFrame.ball_x, y: offsideShotFrame.ball_y },
    (second) => second <= 1632 ? offsideCall.event_id : offsideReview.event_id);
  assertRoute(1637, offsideDelivery, offsideDelivery.related_player_id);
  assertControlled(1639, offsideResolution.possession_after_player_id, offsideResolution.event_id);

  // The tackle chain requires a real lead-in pass, recovery and carries, contact,
  // frozen foul review, then the awarded team's restart and first control.
  const leadPass = events.find((item) => item.event_type === "pass" && Number(item.match_second) === 4645
    && item.player_id === "MCI-20" && item.related_player_id === "MCI-8");
  const leadCarry = events.find((item) => item.event_type === "carry" && Number(item.match_second) === 4651
    && item.player_id === "MCI-8");
  if (!leadPass || !leadCarry) throw new Error("Tackle incident is missing its linked lead-in pass or control");
  assertRoute(4645, leadPass, leadPass.related_player_id);
  let receptionSecond = null;
  for (let second = 4646; second < 4651; second += 1) {
    const frame = bySecond.get(second);
    if (frame.possession_player_id === "MCI-8") { receptionSecond = second; break; }
  }
  if (receptionSecond === null) throw new Error("MCI-8 never receives the lead-in pass before the carry");
  for (let second = 4646; second <= 4650; second += 1) {
    const frame = bySecond.get(second);
    if (frame.ball_interaction_event_id !== leadPass.event_id
      || (second < receptionSecond && frame.possession_player_id)
      || (second >= receptionSecond && frame.possession_player_id !== "MCI-8")) {
      throw new Error(`Tackle lead-in pass has an invalid flight or reception at ${second}`);
    }
  }
  assertControlled(4651, leadCarry.player_id, leadCarry.event_id);
  for (const [second, type] of [[4654, "ball_recovery"], [4655, "carry"], [4656, "carry"]]) {
    const event = incidentEvent("incident-tackle-77", type, second);
    assertControlled(second, "ARS-7", event.event_id);
  }
  const tackle = incidentEvent("incident-tackle-77", "challenge", 4657);
  const foulCall = incidentEvent("incident-tackle-77", "foul_decision", 4658);
  const card = incidentEvent("incident-tackle-77", "card_shown", 4659);
  const tackleReview = incidentEvent("incident-tackle-77", "var_review", 4663);
  const tackleDelivery = incidentEvent("incident-tackle-77", "restart_delivery", 4672);
  const tackleResolution = incidentEvent("incident-tackle-77", "restart_resolution", 4674);
  const tacklePoint = { x: Number(tackle.location_x), y: Number(tackle.location_y) };
  const contactFrame = bySecond.get(4657);
  const contactState = sampleFrame(tackleSimulation, tackleSimulation.contactT);
  const expectedContactBall = incidentBallMatchPoint("tackle", contactState.ball);
  const whistleTime = tackleSimulation.events.find((item) => item.id === "whistle").t;
  const whistleState = sampleFrame(tackleSimulation, whistleTime);
  const expectedWhistleBall = incidentBallMatchPoint("tackle", whistleState.ball);
  const expectedImpact = incidentActorMatchPoint("tackle", tackleSimulation.impact.point);
  if (contactFrame.ball_motion !== "controlled" || contactFrame.possession_player_id !== "ARS-7"
    || !close(contactFrame.ball_x, expectedContactBall.x) || !close(contactFrame.ball_y, expectedContactBall.y)
    || !close(tacklePoint.x, expectedImpact.x) || !close(tacklePoint.y, expectedImpact.y)
    || !close(foulCall.location_x, tacklePoint.x) || !close(foulCall.location_y, tacklePoint.y)
    || !close(card.location_x, tacklePoint.x) || !close(card.location_y, tacklePoint.y)
    || !close(tackleReview.location_x, tacklePoint.x) || !close(tackleReview.location_y, tacklePoint.y)) {
    throw new Error("Tackle actors, contact point, foul/card/VAR locations, or simulation ball are not aligned");
  }
  assertStopped(4658, 4671, expectedWhistleBall, () => foulCall.event_id);
  assertRoute(4672, tackleDelivery, tackleDelivery.related_player_id);
  assertControlled(4674, tackleResolution.possession_after_player_id, tackleResolution.event_id);

  // From 78:32 to full time, validate every shot's shooter location and its
  // paired outcome, every whistle's frozen interval, and each goalkeeper's end.
  const fullTime = events.find((event) => event.event_type === "phase" && event.phase === "full_time");
  if (!fullTime || Number(fullTime.match_second) !== Number(frames.at(-1).match_second)) {
    throw new Error("Full-time event does not coincide with the final frame");
  }
  const finalFrame = bySecond.get(Number(fullTime.match_second));
  if (finalFrame.ball_motion !== "stopped" || finalFrame.possession_player_id
    || JSON.parse(finalFrame.event_ids).some((id) => id !== fullTime.event_id)) {
    throw new Error("Full-time frame still contains live possession or post-whistle actions");
  }
  for (const event of events.filter((item) => Number(item.match_second) >= LIVE_CUTOFF_SECONDS)) {
    const frame = bySecond.get(Number(event.match_second));
    if (!JSON.parse(frame.event_ids).includes(event.event_id)) throw new Error(`${event.event_id} is missing from its closing frame`);
    if (["pass", "restart_delivery", "shot", "penalty_attempt", "carry", "ball_recovery", "save", "restart_resolution"].includes(event.event_type)
      && frame.ball_interaction_event_id !== event.event_id) {
      const linkedLaterAction = JSON.parse(frame.event_ids).map((id) => byEventId.get(id)).some((later) => later
        && later.sequence > event.sequence && later.event_id === frame.ball_interaction_event_id);
      if (!linkedLaterAction) throw new Error(`${event.event_id} is not the ball interaction represented at frame ${event.match_second}`);
    }
    if (event.event_type === "restart_delivery"
      && (!close(frame.ball_x, event.location_x) || !close(frame.ball_y, event.location_y)
        || frame.ball_from_player_id !== event.player_id || frame.ball_to_player_id !== event.related_player_id)) {
      throw new Error(`${event.event_id} restart delivery does not launch from the taker's location toward its receiver`);
    }
    if (event.event_type === "shot") {
      const shooter = JSON.parse(frame.actors).find((actor) => actor.person_id === event.player_id);
      if (!shooter || !close(event.location_x, shooter.x) || !close(event.location_y, shooter.y)) {
        throw new Error(`${event.event_id} shot location is detached from its shooter`);
      }
      if (event.outcome === "wide") {
        const out = events.find((candidate) => candidate.event_type === "ball_out" && candidate.parent_event_id === event.event_id);
        if (!out || Number(out.match_second) < Number(event.match_second)
          || Number(out.match_second) > Number(event.match_second) + 2
          || frame.ball_motion !== "out" || frame.ball_to_player_id !== "OUT") {
          throw new Error(`${event.event_id} wide shot has no timely, visible ball-out event`);
        }
      } else if (event.outcome === "saved") {
        const save = events.find((candidate) => candidate.event_type === "save" && candidate.parent_event_id === event.event_id);
        if (!save) throw new Error(`${event.event_id} saved shot has no linked save`);
        assertControlled(Number(save.match_second), save.player_id, save.event_id);
      }
    }
    if (event.event_type === "ball_out" && (frame.ball_motion !== "out" || frame.possession_player_id)) {
      throw new Error(`${event.event_id} ball-out event does not stop live possession`);
    }
    if (event.event_type === "ball_out") {
      const delivery = events.find((candidate) => candidate.event_type === "restart_delivery"
        && candidate.chain_id === event.chain_id && Number(candidate.match_second) > Number(event.match_second));
      if (!delivery) throw new Error(`${event.event_id} has no linked restart after the ball leaves play`);
      const stoppedAt = { x: Number(frame.ball_x), y: Number(frame.ball_y) };
      for (let second = Number(event.match_second); second < Number(delivery.match_second); second += 1) {
        const stopped = bySecond.get(second);
        if (["transfer", "shot", "controlled", "goal"].includes(stopped.ball_motion)
          || stopped.possession_player_id || !close(stopped.ball_x, stoppedAt.x) || !close(stopped.ball_y, stoppedAt.y)) {
          throw new Error(`${event.chain_id} ball moves or regains possession between out-of-play and restart`);
        }
      }
    }
    if (["foul_decision", "offside_decision", "corner_awarded", "penalty_awarded"].includes(event.event_type)
      && (frame.ball_motion !== "stopped" || frame.possession_player_id)) {
      throw new Error(`${event.event_id} closing whistle is not stationary and unpossessed`);
    }
    if (event.event_type === "foul_decision" && event.restart_type !== "penalty") {
      const delivery = events.find((candidate) => candidate.chain_id === event.chain_id && candidate.event_type === "restart_delivery");
      if (!delivery) throw new Error(`${event.event_id} has no awarded free-kick restart`);
      for (let second = Number(event.match_second); second < Number(delivery.match_second); second += 1) {
        const stopped = bySecond.get(second);
        if (stopped.ball_motion !== "stopped" || stopped.possession_player_id
          || !close(stopped.ball_x, frame.ball_x) || !close(stopped.ball_y, frame.ball_y)) {
          throw new Error(`${event.chain_id} ball moves or gains possession before its restart`);
        }
      }
    }
  }

  const goalkeepers = people.filter((person) => !person.role && person.pos === "GK");
  for (const frame of frames) {
    const second = Number(frame.match_second);
    const strictSpan = second >= LIVE_CUTOFF_SECONDS || second >= 1600 && second <= 1645 || second >= 4635 && second <= 4680;
    if (!strictSpan) continue;
    const period = Number(frame.period);
    const actors = new Map(JSON.parse(frame.actors).map((actor) => [actor.person_id, actor]));
    for (const keeper of goalkeepers) {
      const actor = actors.get(playerId(keeper.team, keeper.no));
      if (!actor || actor.status !== "active") continue;
      const defendsPositiveGoal = (keeper.team === home) === (period === 2);
      const goalX = defendsPositiveGoal ? 52.5 : -52.5;
      if ((defendsPositiveGoal && Number(actor.x) < 0) || (!defendsPositiveGoal && Number(actor.x) > 0)
        || Math.hypot(Number(actor.x) - goalX, Number(actor.y)) > 20) {
        throw new Error(`${frame.frame_id} goalkeeper ${actor.person_id} is outside the defensive half/penalty area`);
      }
    }
  }
}

export function buildMatchTables({ people, home, away, half1Seconds, half2Seconds }) {
  const events = buildDetailedEvents({ people, home, away, half1Seconds, half2Seconds });
  const movementProfiles = buildMovementProfiles(people);
  const frames = buildFrames(events, { people, home, away, half1Seconds, half2Seconds, movementProfiles });
  reconcileCriticalFrames(events, frames, { home, away, half1Seconds });
  assertDataset(events, frames, people, half1Seconds, half2Seconds, home, away);
  assertCriticalTimelines(events, frames, people, home, away);
  const movementSummaries = summarizePlayerMovement(frames);
  const playerRatings = buildPlayerRatingsBySecond(events, frames, people);
  const movementTargets = people.filter((person) => !person.role).map((person) => {
    const id = playerId(person.team, person.no);
    const activeSeconds = playedSeconds(person, { home, half1Seconds, half2Seconds });
    const movement = movementSummaries.get(id) || { distance: 0, liveDistance: 0, seconds: 0, peakSpeed: 0, sprintSamples: 0 };
    const distancePer90 = activeSeconds ? movement.distance * (90 * 60 / activeSeconds) / 1000 : 0;
    // Short substitute spells inflate distance-per-90; allow a wider rate while
    // still checking their absolute distance and peak speed in the frame table.
    const distancePer90Ceiling = activeSeconds <= 30 * 60 ? 18 : 16.5;
    if (person.pos !== "GK" && activeSeconds >= 20 * 60 && (distancePer90 < 8 || distancePer90 > distancePer90Ceiling)) {
      throw new Error(`${id} generated ${distancePer90.toFixed(2)}km per 90, outside the 8-16.5km outfield match range`);
    }
    if (person.pos !== "GK" && movement.peakSpeed > 9.0) {
      throw new Error(`${id} generated a ${movement.peakSpeed.toFixed(1)}m/s peak above the 9.0m/s football speed ceiling`);
    }
    if (person.pos === "GK" && activeSeconds > 0 && (movement.distance < 4000 || movement.distance > 6000)) {
      throw new Error(`${id} goalkeeper movement ${Math.round(movement.distance)}m falls outside the 4-6km match range`);
    }
    return {
      person_id: id,
      team: person.team,
      shirt_number: person.no,
      player_name: person.name,
      position: person.pos,
      active_minutes: round2(activeSeconds / 60),
      distance_target_km_per_90: round2(distanceTargetKmPer90(person)),
      distance_target_km_for_match_minutes: round2(distanceTargetKmPer90(person) * activeSeconds / (90 * 60)),
      generated_distance_km: round2(movement.distance / 1000),
      generated_distance_at_78_32_km: round2(movement.liveDistance / 1000),
      generated_average_speed_mps: movement.seconds ? round2(movement.distance / movement.seconds) : 0,
      generated_peak_speed_mps: round2(movement.peakSpeed),
      sprint_samples_over_25kmh: movement.sprintSamples,
      individual_match_reference_km: PUBLISHED_MATCH_DISTANCE_KM[id] ?? "",
      target_basis: distanceSource(person),
      source_url: distanceSourceUrl(person),
    };
  });
  return {
    events: events.map((event) => Object.fromEntries(EVENT_HEADERS.map((header) => [header, event[header] ?? ""]))),
    frames,
    movementTargets,
    playerRatings: playerRatings.rows,
    eventHeaders: EVENT_HEADERS,
    frameHeaders: FRAME_HEADERS,
    movementTargetHeaders: [
      "person_id", "team", "shirt_number", "player_name", "position", "active_minutes",
      "distance_target_km_per_90", "distance_target_km_for_match_minutes", "generated_distance_km",
      "generated_distance_at_78_32_km", "generated_average_speed_mps", "generated_peak_speed_mps", "sprint_samples_over_25kmh",
      "individual_match_reference_km", "target_basis", "source_url",
    ],
    playerRatingHeaders: playerRatings.headers,
  };
}
