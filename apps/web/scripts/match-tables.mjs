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

function shuffledIndices(length, seed) {
  const indexes = Array.from({ length }, (_, index) => index);
  let state = seed >>> 0;
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes;
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

function buildPassEvents({ add, people, home, away, half1Seconds, half2Seconds, reservedTimes = [] }) {
  const current = [
    { team: home, count: 611, completed: 531, seed: 781, live: true },
    { team: away, count: 485, completed: 393, seed: 1927, live: true },
  ];
  const future = [
    { team: home, count: 122, completed: 105, seed: 9011, live: false },
    { team: away, count: 98, completed: 79, seed: 6011, live: false },
  ];
  const liveTimes = new Set(reservedTimes);
  for (const plan of [...current, ...future]) {
    const endSecond = plan.live ? LIVE_CUTOFF_SECONDS : half1Seconds + half2Seconds;
    const firstSecond = plan.live ? 0 : LIVE_CUTOFF_SECONDS + 1;
    const length = endSecond - firstSecond + 1;
    const completionOrder = shuffledIndices(plan.count, plan.seed);
    const completedIndices = new Set(completionOrder.slice(0, plan.completed));
    let possessionGroup = 0;
    let lastInGroup = null;
    for (let index = 0; index < plan.count; index += 1) {
      let matchSecond = firstSecond + Math.floor(((index + 0.5) * length) / plan.count);
      matchSecond = clamp(matchSecond, firstSecond, endSecond);
      let searched = 0;
      while (liveTimes.has(matchSecond)) {
        matchSecond += 1;
        if (matchSecond > endSecond) matchSecond = firstSecond;
        searched += 1;
        if (searched > length) throw new Error(`No free second remains for ${plan.team} pass event.`);
      }
      liveTimes.add(matchSecond);
      const period = periodForMatchSecond(matchSecond, half1Seconds);
      const periodSecond = periodSecondForMatchSecond(matchSecond, period, half1Seconds);
      const active = activePlayers(people, plan.team, matchSecond, home, half1Seconds).filter((person) => person.pos !== "GK");
      if (index === 0 || index % 5 === 0 || (lastInGroup && lastInGroup.pass_completed !== true)) {
        possessionGroup += 1;
        lastInGroup = null;
      }
      const chainId = `build-up-${plan.team}-${String(possessionGroup).padStart(3, "0")}`;
      const previous = lastInGroup;
      const passer = previous?.pass_completed === true
        ? active.find((person) => playerId(person.team, person.no) === previous.related_player_id) || active[index % active.length]
        : active[index % active.length];
      const completed = completedIndices.has(index);
      const opponent = plan.team === home ? away : home;
      const recipients = completed
        ? active.filter((person) => person.no !== passer.no)
        : activePlayers(people, opponent, matchSecond, home, half1Seconds).filter((person) => person.pos !== "GK");
      const location = formationSlot(passer, passer.team, home, away, period, matchSecond, half1Seconds);
      const nearbyRecipients = recipients
        .map((person) => ({
          person,
          position: formationSlot(person, person.team, home, away, period, matchSecond, half1Seconds),
        }))
        .sort((left, right) => {
          const leftDistance = Math.hypot(left.position.x - location.x, left.position.y - location.y);
          const rightDistance = Math.hypot(right.position.x - location.x, right.position.y - location.y);
          return leftDistance - rightDistance || left.person.no - right.person.no;
        });
      const recipientPool = nearbyRecipients.slice(0, Math.min(4, nearbyRecipients.length));
      const recipient = recipientPool[(index * 7 + 3) % recipientPool.length].person;
      const target = formationSlot(recipient, recipient.team, home, away, period, matchSecond, half1Seconds);
      const event = add({
        period,
        periodSecond,
        eventType: "pass",
        action: completed ? "completed_pass" : "attempted_pass",
        outcome: completed ? "completed" : "intercepted",
        teamCode: plan.team,
        playerId: playerId(plan.team, passer.no),
        relatedPlayerId: playerId(completed ? plan.team : opponent, recipient.no),
        participantIds: [playerId(plan.team, passer.no), playerId(completed ? plan.team : opponent, recipient.no)],
        chainId,
        parentEventId: previous?.event_id || "",
        passCompleted: completed,
        detail: completed
          ? `${passer.name} completes a pass to ${recipient.name}.`
          : `${passer.name}'s pass is intercepted by ${recipient.name}.`,
        x: location.x,
        y: location.y,
        targetX: target.x,
        targetY: target.y,
        possessionAfterPlayerId: playerId(completed ? plan.team : opponent, recipient.no),
        possessionAfterTeamCode: completed ? plan.team : opponent,
      });
      lastInGroup = event;
    }
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
  const offsidePass = add({
    period: 1, periodSecond: offsideAt - 3, eventType: "pass", action: "through_ball", outcome: "completed",
    teamCode: away, playerId: playerId(away, 8), relatedPlayerId: playerId(away, 9),
    participantIds: [playerId(away, 8), playerId(away, 9)], chainId: "incident-offside",
    passCompleted: true, incidentId: "offside", detail: "Odegaard releases Jesus in behind.",
    commentary: "Odegaard threads the ball through for Jesus.", showInCommentary: true,
    x: offsideLoc.x - 4, y: offsideLoc.y, targetX: offsideLoc.x, targetY: offsideLoc.y,
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
    outcome: "defender_clears_delivery", teamCode: away, playerId: playerId(home, 3), relatedPlayerId: playerId(away, 6),
    participantIds: [playerId(home, 3), playerId(away, 6)], chainId: "incident-offside",
    parentEventId: offsideDelivery.event_id, incidentId: "offside",
    timelineEvent: true,
    detail: "Gabriel wins the aerial challenge and clears De Bruyne's delivery.",
    commentary: "Gabriel heads De Bruyne's free kick clear.", showInCommentary: true,
    x: offsideLoc.x + 4, y: offsideLoc.y + 2,
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
  add({
    period: 2, periodSecond: 46 * 60 + 10, eventType: "shot", action: "open_play_shot",
    outcome: "wide", teamCode: away, playerId: playerId(away, 7),
    participantIds: [playerId(away, 7)], chainId: "late-shot-ars",
    isShot: true, shotOnTarget: false, bigChance: false, xg: 0.04,
    detail: "Saka shoots wide from the right side of the box.", commentary: "Saka's late effort goes wide.",
    showInCommentary: true, x: -38, y: -13, targetX: 52, targetY: 0,
    possessionAfterPlayerId: playerId(home, 31), possessionAfterTeamCode: home,
  });

  // Explicit player duels make the duels-won Overview statistic derivable from event data.
  const duelWinners = [...Array(54).fill(home), ...Array(46).fill(away)];
  const duelOrder = shuffledIndices(duelWinners.length, 20917);
  const orderedWinners = duelOrder.map((index) => duelWinners[index]);
  orderedWinners.forEach((winnerTeam, index) => {
    const matchSecond = Math.floor(((index + 0.5) * LIVE_CUTOFF_SECONDS) / orderedWinners.length);
    const period = periodForMatchSecond(matchSecond, half1Seconds);
    const periodSecond = periodSecondForMatchSecond(matchSecond, period, half1Seconds);
    const opponent = winnerTeam === home ? away : home;
    const winner = activePlayers(people, winnerTeam, matchSecond, home, half1Seconds).filter((person) => person.pos !== "GK")[index % 10];
    const rival = activePlayers(people, opponent, matchSecond, home, half1Seconds).filter((person) => person.pos !== "GK")[(index * 3) % 10];
    const at = locationFor(winnerTeam, matchSecond, home, period, index % 5);
    add({
      period, periodSecond, eventType: "duel", action: "contested_duel", outcome: "won",
      teamCode: winnerTeam, playerId: playerId(winnerTeam, winner.no), relatedPlayerId: playerId(opponent, rival.no),
      participantIds: [playerId(winnerTeam, winner.no), playerId(opponent, rival.no)],
      chainId: `duel-${String(index + 1).padStart(3, "0")}`, duelWon: true,
      detail: `${winner.name} wins a duel against ${rival.name}.`, x: at.x, y: at.y,
    });
  });

  // Generate detailed pass actions after reserving the incident and set-piece timestamps.
  const reservedTimes = events.map((event) => event.match_second);
  buildPassEvents({ add, people, home, away, half1Seconds, half2Seconds, reservedTimes });
  add({ period: 2, periodSecond: half2Seconds, eventType: "phase", phase: "full_time", action: "full_time_whistle", outcome: "match_ended", teamCode: "", detail: "Full-time." , clockLabel: "90+3:00" });

  const sorted = events.sort((left, right) => left.match_ms - right.match_ms || left.sequence - right.sequence);
  sorted.forEach((event, index) => { event.sequence = index + 1; });
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
  const amplitude = 12.5;
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

function buildMovementProfiles(people, { home, away, half1Seconds, half2Seconds }) {
  const duration = half1Seconds + half2Seconds;
  const profiles = new Map();
  const distanceAtScale = (person, scale) => {
    let distance = 0;
    let previous = null;
    for (let second = 0; second <= duration; second += 1) {
      if (!activeAt(person, second, home, half1Seconds)) {
        previous = null;
        continue;
      }
      const period = periodForMatchSecond(second, half1Seconds);
      const position = outfieldPosition(person, { home, away, period, second, half1Seconds, movementScale: scale });
      if (previous && previous.period === period && previous.second === second - 1) {
        distance += Math.hypot(position.x - previous.x, position.y - previous.y);
      }
      previous = { ...position, period, second };
    }
    return distance;
  };
  for (const person of people.filter((item) => !item.role && item.pos !== "GK")) {
    const activeSeconds = playedSeconds(person, { home, half1Seconds, half2Seconds });
    const targetDistance = distanceTargetKmPer90(person) * activeSeconds / (90 * 60) * 1000;
    let low = 0;
    let high = 5;
    for (let attempt = 0; attempt < 22; attempt += 1) {
      const middle = (low + high) / 2;
      if (distanceAtScale(person, middle) < targetDistance) low = middle;
      else high = middle;
    }
    profiles.set(playerId(person.team, person.no), {
      targetKmPer90: distanceTargetKmPer90(person),
      targetDistanceKm: targetDistance / 1000,
      amplitudeScale: (low + high) / 2,
    });
  }
  return profiles;
}

function summarizePlayerMovement(frames) {
  const summaries = new Map();
  const previous = new Map();
  for (const frame of frames) {
    for (const actor of JSON.parse(frame.actors)) {
      const id = actor.person_id;
      if (!actor.team || actor.status !== "active") {
        previous.delete(id);
        continue;
      }
      const summary = summaries.get(id) || { distance: 0, liveDistance: 0, seconds: 0, peakSpeed: 0, sprintSamples: 0 };
      const prior = previous.get(id);
      if (prior && prior.period === frame.period && prior.second === frame.match_second - 1) {
        const speed = Math.hypot(actor.x - prior.x, actor.y - prior.y);
        summary.distance += speed;
        if (frame.match_second <= LIVE_CUTOFF_SECONDS) summary.liveDistance += speed;
        summary.seconds += 1;
        summary.peakSpeed = Math.max(summary.peakSpeed, speed);
        if (speed >= 25 / 3.6) summary.sprintSamples += 1;
      }
      summaries.set(id, summary);
      previous.set(id, { x: actor.x, y: actor.y, period: frame.period, second: frame.match_second });
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
  const attackingGoalX = (team, period) => (team === home) === (period === 1) ? 52.5 : -52.5;
  const stoppageTypes = new Set([
    "foul_decision", "corner_awarded", "penalty_awarded", "offside_decision", "ball_out",
  ]);
  const interactionTypes = new Set([
    "pass", "shot", "penalty_attempt", "save", "block", "challenge", "duel", "aerial_duel",
    "restart_delivery", "restart_resolution", "handball_contact",
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
          ballStopped = false;
          lastPossession = { team: home, id: playerId(home, 16) };
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
        lastPossession = { team: home, id: playerId(home, 16) };
      }
      if (event.event_type === "substitution" && lastPossession.id === event.related_player_id) {
        lastPossession = { team: event.team_code, id: event.player_id };
      }
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
    const possPerson = rosterPeople.find((person) => playerId(person.team, person.no) === lastPossession.id);
    let ball = { ...previousBall, z: 0 };
    const actors = rosterPeople.map((person) => {
      const id = playerId(person.team, person.no);
      const active = activeAt(person, second, home, half1Seconds);
      const status = active ? "active" : person.xi === "start" ? "subbed_off" : "bench";
      const baseSlot = formationSlot(person, person.team, home, away, period, second, half1Seconds);
      let pos = active ? baseSlot : { x: person.team === home ? -8 - (person.no % 9) * 2 : 8 + (person.no % 9) * 2, y: 36.5 };
      if ((active || person.team === home && person.no === 19) && person.pos !== "GK") {
        const profile = movementProfiles.get(id);
        pos = outfieldPosition(person, {
          home,
          away,
          period,
          second,
          half1Seconds,
          movementScale: profile?.amplitudeScale ?? 1,
        });
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
      const interactionEvent = [...currentEvents].reverse().find((event) => interactionTypes.has(event.event_type)
        && (["pass", "restart_delivery"].includes(event.event_type)
          || JSON.parse(event.participant_ids).includes(lastPossession.id))) || kickoffEvent;
      const targetPlayerId = ["pass", "restart_delivery"].includes(interactionEvent?.event_type)
        ? interactionEvent.related_player_id || lastPossession.id
        : shotTarget ? shotEvent.goalkeeper_id || lastPossession.id : lastPossession.id;
      const targetPosition = actorPosition(targetPlayerId) || holderPosition;
      const destination = shotTarget
        || (shotAtGoal ? { x: attackingGoalX(shotEvent.team_code, period) * 0.995, y: 0 } : targetPosition);
      const startsFlight = possessionChanged || Boolean(shotTarget) || shotAtGoal || Boolean(kickoffEvent)
        || currentEvents.some((event) => ["pass", "restart_delivery"].includes(event.event_type)
          || interactionTypes.has(event.event_type) && JSON.parse(event.participant_ids).includes(lastPossession.id));
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
          duration: Math.max(1, Math.ceil(routeLength / 5)),
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
              const bend = Math.min(1.7, Math.max(0.25, span * 0.035)) * side;
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
                duration: Math.max(1, Math.ceil(routeLength / 5)),
              };
            } else {
              if (holderPosition) {
                const attackDirection = lastPossession.team === home
                  ? (period === 1 ? 1 : -1)
                  : (period === 1 ? -1 : 1);
                ball = { x: holderPosition.x + attackDirection * 0.65, y: holderPosition.y, z: 0 };
                ballMotion = "controlled";
              }
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
      } else if (playerPosition && event.location_x !== "" && event.location_y !== "") {
        event.location_x = playerPosition.x;
        event.location_y = playerPosition.y;
      }
    }
    previousBall = ball;
    const officialTargets = {
      main: { x: clamp(ball.x - 4, -48, 48), y: clamp(ball.y * 0.35, -31, 31) },
      ar1: { x: clamp(ball.x + 4, -48, 48), y: -34 },
      ar2: { x: clamp(ball.x - 2, -48, 48), y: 34 },
    };
    const officials = Object.entries(officialTargets).map(([role, target]) => {
      const previous = previousOfficials[role];
      const dx = target.x - previous.x;
      const dy = target.y - previous.y;
      const distance = Math.hypot(dx, dy);
      const scale = distance > 7.2 ? 7.2 / distance : 1;
      const position = { x: round2(previous.x + dx * scale), y: round2(previous.y + dy * scale) };
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
  for (const [id, profile] of movementProfiles) {
    let totalDistance = 0;
    let previous = null;
    for (const frame of frames) {
      const actor = JSON.parse(frame.actors).find((item) => item.person_id === id && item.status === "active");
      if (!actor) {
        previous = null;
        continue;
      }
      if (previous && previous.period === frame.period && previous.second === frame.match_second - 1) {
        totalDistance += Math.hypot(actor.x - previous.x, actor.y - previous.y);
      }
      previous = { x: actor.x, y: actor.y, period: frame.period, second: frame.match_second };
    }
    if (Math.abs(totalDistance / 1000 - profile.targetDistanceKm) > 0.015) {
      throw new Error(`${id} generated ${(totalDistance / 1000).toFixed(3)}km; expected ${profile.targetDistanceKm.toFixed(3)}km`);
    }
  }
  return frames;
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
    const frame = frameById.get(event.frame_id);
    if (!frame) throw new Error(`${event.event_id} has no frame ${event.frame_id}`);
    if (frame.match_ms !== event.match_ms) throw new Error(`${event.event_id} and ${frame.frame_id} have different timestamps`);
    if (!JSON.parse(frame.event_ids).includes(event.event_id)) throw new Error(`${event.event_id} is absent from its linked frame`);
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
  if (frames.length !== half1Seconds + half2Seconds + 1) throw new Error("Frame table does not cover every second through full time");
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index].match_second !== frames[index - 1].match_second + 1) throw new Error("Frame timestamps contain a gap");
    if (frames[index].possession_player_id && frames[index].possession_player_id !== frames[index - 1].possession_player_id) {
      const nextHolder = frames[index].possession_player_id;
      const frameEvents = JSON.parse(frames[index].event_ids).map((id) => eventsById.get(id)).filter(Boolean);
      const holderWasInvolved = frameEvents.some((event) => JSON.parse(event.participant_ids).includes(nextHolder));
      const wasKickoff = frameEvents.some((event) => event.event_type === "phase" && ["kick_off", "second_half"].includes(event.phase));
      if (!holderWasInvolved && !wasKickoff) throw new Error(`${frames[index].frame_id} changes possession to ${nextHolder} without a linked player interaction`);
    }
    if (Number(frames[index - 1].period) === Number(frames[index].period)) {
      const ballSpeed = Math.hypot(Number(frames[index].ball_x) - Number(frames[index - 1].ball_x), Number(frames[index].ball_y) - Number(frames[index - 1].ball_y));
      const frameEvents = JSON.parse(frames[index].event_ids).map((id) => eventsById.get(id)).filter(Boolean);
      const allowedBallExit = frameEvents.some((event) => event.event_type === "ball_out"
        || event.event_type === "goal" && event.outcome === "scored"
        || ["shot", "penalty_attempt"].includes(event.event_type) && event.outcome === "wide");
      if (ballSpeed > 18.01 && !allowedBallExit) {
        const eventTypes = frameEvents.map((event) => event.event_type).join(",") || "none";
        throw new Error(`${frames[index].frame_id} ball moves ${ballSpeed.toFixed(1)}m in one second without an exit or goal event (motion=${frames[index - 1].ball_motion}->${frames[index].ball_motion}, interaction=${frames[index].ball_interaction_event_id || "none"}, events=${eventTypes})`);
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
        throw new Error(`${frame.frame_id} controlled ball is detached from its player`);
      }
    }
    for (const actor of activeActors) {
      const prior = priorLocations.get(actor.person_id);
      if (prior && prior.second === frame.match_second - 1 && prior.period === frame.period) {
        const speed = Math.hypot(actor.x - prior.x, actor.y - prior.y);
        if (speed > 10.51) throw new Error(`${frame.frame_id} ${actor.person_id} moves ${speed.toFixed(1)}m in one second (above the 10.5m/s match-speed ceiling)`);
      }
      priorLocations.set(actor.person_id, { x: actor.x, y: actor.y, second: frame.match_second, period: frame.period });
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

export function buildMatchTables({ people, home, away, half1Seconds, half2Seconds }) {
  const events = buildDetailedEvents({ people, home, away, half1Seconds, half2Seconds });
  const movementProfiles = buildMovementProfiles(people, { home, away, half1Seconds, half2Seconds });
  const frames = buildFrames(events, { people, home, away, half1Seconds, half2Seconds, movementProfiles });
  assertDataset(events, frames, people, half1Seconds, half2Seconds, home, away);
  const movementSummaries = summarizePlayerMovement(frames);
  const playerRatings = buildPlayerRatings(events, frames, people);
  const movementTargets = people.filter((person) => !person.role).map((person) => {
    const id = playerId(person.team, person.no);
    const activeSeconds = playedSeconds(person, { home, half1Seconds, half2Seconds });
    const movement = movementSummaries.get(id) || { distance: 0, liveDistance: 0, seconds: 0, peakSpeed: 0, sprintSamples: 0 };
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
