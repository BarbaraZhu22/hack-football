"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FootballIcon } from "@/components/ui/football-icon";
import { Whistle } from "lucide-react";
import { CardIcon } from "./event-icons";


const LIVE_EVENT_TYPES = new Set([
  "goal", "penalty-goal", "own-goal", "goal-disallowed", "penalty-missed",
  "yellow", "red", "foul", "penalty-awarded", "corner-awarded", "offside", "ball-out",
]);

function formatEventClock(event) {
  if (event.clockLabel?.includes(":")) return event.clockLabel.replace(":", "'") + "''";
  const minute = event.minuteLabel || event.minute;
  return minute == null ? "" : String(minute) + "'";
}

function opposingTeamCode(teamCode, match) {
  if (teamCode === match.home.code) return match.away.code;
  if (teamCode === match.away.code) return match.home.code;
  return null;
}

function liveEventPresentation(event, match, teamsByPersonId) {
  const teamCode = event.awardedTeamCode
    || (["penalty-awarded", "corner-awarded", "offside"].includes(event.type) ? event.teamCode : null);
  const clock = formatEventClock(event);
  if (event.type === "goal" || event.type === "penalty-goal") {
    return {
      label: event.type === "penalty-goal" ? "PENALTY GOAL" : "GOAL",
      icon: "ball",
      iconColor: event.type === "penalty-goal" ? "text-emerald-500" : undefined,
      detail: event.player,
      teamCode: event.teamCode,
      score: event.score,
      clock,
    };
  }
  if (event.type === "own-goal") {
    return {
      label: "OWN GOAL",
      icon: "ball",
      iconColor: "text-violet-400",
      detail: event.player,
      teamCode: opposingTeamCode(event.teamCode, match) || event.teamCode,
      score: event.score,
      clock,
    };
  }
  if (event.type === "goal-disallowed" || event.type === "penalty-missed") {
    const savedByTeam = teamsByPersonId.get(event.goalkeeperId);
    return {
      label: event.type === "goal-disallowed" ? "NO GOAL" : "PENALTY SAVED",
      icon: "missed-ball",
      detail: event.player
        ? `${event.player}${event.type === "goal-disallowed" && event.teamCode ? ` (${event.teamCode})` : ""} · BALL TO`
        : "BALL TO",
      teamCode: event.type === "penalty-missed"
        ? savedByTeam || opposingTeamCode(event.teamCode, match)
        : event.awardedTeamCode || opposingTeamCode(event.teamCode, match),
      clock,
    };
  }
  if (event.type === "yellow" || event.type === "red") {
    return {
      label: event.type === "yellow" ? "YELLOW CARD" : "RED CARD",
      icon: "card",
      cardColor: event.type === "yellow" ? "#f5c518" : "#e5484d",
      detail: event.player,
      teamCode: event.teamCode,
      clock,
    };
  }

  const decisionLabels = {
    foul: "FREE KICK",
    "penalty-awarded": "PENALTY",
    "corner-awarded": "CORNER",
    offside: "OFFSIDE",
  };
  if (decisionLabels[event.type] && teamCode) {
    return { label: decisionLabels[event.type], icon: "whistle", teamCode, clock };
  }
  if (event.type === "ball-out" && event.outcome !== "corner" && teamCode) {
    const restartLabels = {
      goal_kick: "GOAL KICK",
      throw_in: "THROW-IN",
    };
    const label = restartLabels[event.restartType] || restartLabels[event.outcome];
    if (label) return { label, icon: "whistle", teamCode, clock };
  }
  return null;
}

function liveMatchSituation(frame, match, teamsByPersonId) {
  const ball = frame?.ball;
  if (!ball) return null;
  if (ball.motion === "out") return { label: "BALL OUT" };
  if (ball.motion === "stopped") return { label: "PLAY STOPPED" };

  const fromTeam = teamsByPersonId.get(ball.fromPlayerId);
  const toTeam = teamsByPersonId.get(ball.toPlayerId);
  const teamCode = ball.motion === "shot" || ball.motion === "goal"
    ? fromTeam || frame.possession?.teamCode || toTeam
    : frame.possession?.teamCode || fromTeam || toTeam;
  if (ball.motion === "goal") return { label: "GOAL", teamCode };
  if (ball.motion === "shot") return { label: "SHOT", teamCode };
  if (!teamCode || (teamCode !== match.home.code && teamCode !== match.away.code)) {
    return { label: "LOOSE BALL" };
  }

  const isHome = teamCode === match.home.code;
  const homeAttacksRight = frame.period === 1;
  const attacksRight = isHome ? homeAttacksRight : !homeAttacksRight;
  const attackingProgress = (Number(ball.x) || 0) * (attacksRight ? 1 : -1);
  const label = attackingProgress < 0
    ? "BALL SAFE"
    : attackingProgress >= 35
      ? "DANGEROUS ATTACK"
      : "ATTACKING";
  return { label, teamCode };
}

export default function LiveTrackingFrame({
  frame,
  match,
  people = [],
  mode = "live",
  emptyMessage,
  pitchEvents = [],
  clockSeconds = null,
}) {
  const actors = frame?.actors?.filter((actor) => actor.status === "active") || [];
  const positionsByPersonId = new Map(people.map((person) => [person.personId, person.position]));
  const namesByPersonId = new Map(people.map((person) => [person.personId, person.name]));
  const teamsByPersonId = new Map(people.map((person) => [person.personId, person.teamCode || person.team]));
  const holderId = frame?.possession?.playerId;
  const ballControlled = frame?.ball?.motion === "controlled";
  const [animatedBall, setAnimatedBall] = useState(frame?.ball || null);
  const ballPositionRef = useRef(null);
  const displayedFrameRef = useRef(null);
  const previousActorPositionsRef = useRef(new Map());
  const actorTransitionRef = useRef(null);
  const [eventQueue, setEventQueue] = useState([]);
  const seenEventIdsRef = useRef(new Set());
  const prevClockSecondsRef = useRef(null);
  const frameKey = frame?.frameId || frame?.timeMilliseconds;
  useEffect(() => {
    if (!frameKey) return;
    const nextPositions = new Map(actors.map((actor) => [actor.person_id || actor.personId, { x: actor.x, y: actor.y }]));
    actorTransitionRef.current = {
      frameKey,
      from: previousActorPositionsRef.current,
      startedAt: performance.now(),
    };
    previousActorPositionsRef.current = nextPositions;
  }, [frameKey]);
  useEffect(() => {
    if (mode !== "live" || clockSeconds == null) return;
    const prev = prevClockSecondsRef.current;
    if (prev == null) {
      prevClockSecondsRef.current = clockSeconds;
      return;
    }
    if (clockSeconds <= prev) {
      prevClockSecondsRef.current = clockSeconds;
      return;
    }
    const fromMs = prev * 1000;
    const toMs = clockSeconds * 1000;
    prevClockSecondsRef.current = clockSeconds;
    const incoming = pitchEvents.filter((event) =>
      event.timeMilliseconds > fromMs
      && event.timeMilliseconds <= toMs
      && LIVE_EVENT_TYPES.has(event.type)
      && event.id
      && !seenEventIdsRef.current.has(event.id)
      && liveEventPresentation(event, match, teamsByPersonId),
    );
    if (!incoming.length) return;
    incoming.forEach((event) => seenEventIdsRef.current.add(event.id));
    setEventQueue((current) => [...current, ...incoming]);
  }, [clockSeconds, pitchEvents, mode, match, teamsByPersonId]);

  const activeEvent = mode === "live" ? eventQueue[0] || null : null;
  const activeEventPresentation = activeEvent ? liveEventPresentation(activeEvent, match, teamsByPersonId) : null;
  useEffect(() => {
    if (!activeEvent) return undefined;
    const activeEventId = activeEvent.id;
    const timeout = window.setTimeout(() => {
      setEventQueue((current) => current[0]?.id === activeEventId ? current.slice(1) : current);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [activeEvent?.id]);

  useEffect(() => {
    if (!frame?.ball) return undefined;
    const frameKey = frame.frameId || frame.timeMilliseconds;
    if (frameKey === displayedFrameRef.current) return undefined;
    displayedFrameRef.current = frameKey;

    const target = { x: frame.ball.x, y: frame.ball.y };
    const from = ballPositionRef.current;
    if (mode === "incident") {
      ballPositionRef.current = target;
      setAnimatedBall(target);
      return undefined;
    }
    if (!from) {
      ballPositionRef.current = target;
      setAnimatedBall(target);
      return undefined;
    }

    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const span = Math.hypot(dx, dy);
    const bend = Math.min(1.8, span * 0.045) * (frame.possession?.teamCode === match.home.code ? 1 : -1);
    const control = span > 0
      ? { x: (from.x + target.x) / 2 - (dy / span) * bend, y: (from.y + target.y) / 2 + (dx / span) * bend }
      : target;
    const startedAt = performance.now();
    const duration = 900;
    let animationFrame = 0;
    const animate = (now) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const inverse = 1 - progress;
      const position = {
        x: inverse * inverse * from.x + 2 * inverse * progress * control.x + progress * progress * target.x,
        y: inverse * inverse * from.y + 2 * inverse * progress * control.y + progress * progress * target.y,
      };
      ballPositionRef.current = position;
      setAnimatedBall(position);
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [frame?.frameId, frame?.timeMilliseconds, frame?.ball?.x, frame?.ball?.y, frame?.possession?.teamCode, match.home.code, mode]);
  const viewWidth = 111;
  const viewHeight = 68;
  const pitchWidthRatio = (viewWidth / viewHeight) / (16 / 9);
  const pitchSideGutter = (1 - pitchWidthRatio) / 2;
  const point = (x, y) => mode === "incident"
    ? {
      left: `${((34 - y) / 68) * 100}%`,
      top: `${((x + 58.5) / 111) * 100}%`,
    }
    : {
      left: `${(pitchSideGutter + ((x + 55.5) / viewWidth) * pitchWidthRatio) * 100}%`,
      top: `${Math.max(1, Math.min(99, ((y + 34) / 68) * 100))}%`,
    };
  const actorTransition = actorTransitionRef.current?.frameKey === frameKey ? actorTransitionRef.current : null;
  const actorTransitionProgress = mode === "incident" || !actorTransition
    ? 1
    : Math.max(0, Math.min(1, (performance.now() - actorTransition.startedAt) / 1000));
  const situation = mode === "live" ? liveMatchSituation(frame, match, teamsByPersonId) : null;
  const displayedStatus = activeEventPresentation || situation;
  const situationTeamColor = displayedStatus?.teamCode === match.home.code
    ? match.home.color
    : displayedStatus?.teamCode === match.away.code
      ? match.away.color
      : null;
  return (
    <Card className={mode === "incident" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "shrink-0 overflow-hidden"}>
      <CardHeader className="flex-row shrink-0 items-center justify-between gap-2 space-y-0 py-2">
        <CardTitle className={`text-sm ${mode === "incident" ? "shrink-0 whitespace-nowrap" : ""}`}>{mode === "incident" ? "2D live" : "Live tracking"}</CardTitle>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap desk-type-meta font-semibold tabular-nums text-muted-foreground">
          <span className={`size-1.5 rounded-full bg-primary ${mode === "incident" ? "" : "animate-pulse"}`} />
          {frame?.clockLabel || (mode === "incident" ? "—" : "Waiting for frame")}
        </span>
      </CardHeader>
      <CardContent className={mode === "incident" ? "flex min-h-0 flex-1 flex-col px-2 pb-2 pt-0" : "py-2"}>
        <div className={`relative w-full overflow-hidden rounded-panel border bg-emerald-800 ${mode === "incident" ? "flex min-h-0 flex-1 items-center justify-center" : "aspect-video"}`} aria-label={mode === "incident" ? "Incident-time 2D player and ball tracking frame" : "Live player and ball tracking frame"}>
          <div className={mode === "incident" ? "relative h-full aspect-[68/111] max-w-full" : "absolute inset-0"}>
          {mode === "live" && frame ? (
            <>
              {displayedStatus ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-2 z-40 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-white/20 bg-black/75 px-2 py-1 text-white shadow-sm backdrop-blur-sm"
                  role="status"
                  aria-label={[displayedStatus.clock, displayedStatus.label, displayedStatus.detail, displayedStatus.teamCode, displayedStatus.score].filter(Boolean).join(" · ")}
                >
                  {activeEventPresentation?.clock ? (
                    <span className="shrink-0 desk-type-meta font-semibold text-white/65">{activeEventPresentation.clock}</span>
                  ) : null}
                  {activeEventPresentation?.icon === "card" ? (
                    <CardIcon color={activeEventPresentation.cardColor} size={14} />
                  ) : activeEventPresentation?.icon === "ball" || activeEventPresentation?.icon === "missed-ball" ? (
                    <FootballIcon
                      size={14}
                      className={activeEventPresentation.iconColor}
                      missed={activeEventPresentation.icon === "missed-ball"}
                    />
                  ) : activeEventPresentation?.icon === "whistle" ? (
                    <Whistle className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : situationTeamColor ? (
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: situationTeamColor }} />
                  ) : null}
                  <span className="shrink-0 desk-type-meta font-bold tracking-[0.08em]">{displayedStatus.label}</span>
                  {displayedStatus.detail ? (
                    <span className="min-w-0 truncate desk-type-meta font-medium text-white/85">{displayedStatus.detail}</span>
                  ) : null}
                  {displayedStatus.teamCode ? (
                    <span className="shrink-0 desk-type-meta font-bold" style={{ color: situationTeamColor }}>
                      {displayedStatus.teamCode}
                    </span>
                  ) : null}
                  {displayedStatus.score ? (
                    <span className="shrink-0 rounded bg-white/15 px-1 py-0.5 desk-type-meta font-bold text-white">
                      {displayedStatus.score}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          <svg
            className="absolute inset-0 size-full"
            viewBox={mode === "incident" ? "0 -3 68 111" : "-3 0 111 68"}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <g transform={mode === "incident" ? "translate(68 0) rotate(90)" : undefined}>
            <g fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="0.28">
              <rect x="0.85" y="0.85" width="103.3" height="66.3" />
              <line x1="52.5" y1="0.85" x2="52.5" y2="67.15" />
              <circle cx="52.5" cy="34" r="9.15" />
              <rect x="0.85" y="13.84" width="16.5" height="40.32" />
              <rect x="87.65" y="13.84" width="16.5" height="40.32" />
              <rect x="0.85" y="24.84" width="5.5" height="18.32" />
              <rect x="98.65" y="24.84" width="5.5" height="18.32" />
              <path d="M 17.35 26.69 A 9.15 9.15 0 0 1 17.35 41.31" />
              <path d="M 87.65 26.69 A 9.15 9.15 0 0 0 87.65 41.31" />
              <path d="M 0.85 1.85 A 1 1 0 0 0 1.85 0.85" />
              <path d="M 103.15 0.85 A 1 1 0 0 0 104.15 1.85" />
              <path d="M 0.85 66.15 A 1 1 0 0 1 1.85 67.15" />
              <path d="M 103.15 67.15 A 1 1 0 0 1 104.15 66.15" />
              <rect x="-1.59" y="30.34" width="2.44" height="7.32" />
              <rect x="104.15" y="30.34" width="2.44" height="7.32" />
            </g>
            <g fill="rgba(255,255,255,0.82)">
              <circle cx="52.5" cy="34" r="0.24" />
              <circle cx="11.85" cy="34" r="0.24" />
              <circle cx="93.15" cy="34" r="0.24" />
            </g>
            </g>
          </svg>
          {actors.map((actor) => {
            const isOfficial = !actor.team;
            const personId = actor.person_id || actor.personId;
            const isGoalkeeper = positionsByPersonId.get(personId) === "GK";
            const previousPosition = actorTransition?.from.get(personId);
            const visibleActorPosition = previousPosition
              ? {
                x: previousPosition.x + (actor.x - previousPosition.x) * actorTransitionProgress,
                y: previousPosition.y + (actor.y - previousPosition.y) * actorTransitionProgress,
              }
              : { x: actor.x, y: actor.y };
            const ballDistance = animatedBall
              ? Math.hypot(animatedBall.x - visibleActorPosition.x, animatedBall.y - visibleActorPosition.y)
              : Number.POSITIVE_INFINITY;
            const isReleasing = !isOfficial
              && frame?.ball?.motion === "transfer"
              && frame.ball.fromPlayerId === personId
              && ballDistance <= 3;
            const isPossessing = !isOfficial && (ballControlled && personId === holderId || isReleasing);
            const color = isOfficial
              ? "#facc15"
              : actor.team === "MCI"
                ? match.home.color
                : match.away.color;
            const roleLabel = actor.role === "main"
              ? "Referee"
              : actor.role === "ar1"
                ? "Assistant referee 1"
                : actor.role === "ar2"
                  ? "Assistant referee 2"
                  : `${actor.team} #${actor.no}`;
            const personName = namesByPersonId.get(personId) || roleLabel;
            const positionStyle = {
              ...point(actor.x, actor.y),
              transition: mode === "incident" ? "none" : "left 1000ms linear, top 1000ms linear",
              willChange: "left, top",
            };
            return (
              <span
                key={personId || actor.role}
                className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center ${isPossessing ? "z-40 size-8" : "z-30 size-3"}`}
                style={positionStyle}
                role="img"
                aria-label={isPossessing ? `${personName} has the ball` : roleLabel}
                title={isPossessing ? `${personName} · In possession` : roleLabel}
              >
                {isPossessing ? (
                  <span
                    aria-hidden="true"
                    className="absolute size-7 animate-pulse rounded-full blur-[3px]"
                    style={{ backgroundColor: color, opacity: 0.65 }}
                  />
                ) : null}
                {isGoalkeeper ? (
                  <svg
                    viewBox="0 0 12 12"
                    className={`relative drop-shadow-sm ${isPossessing ? "size-4" : "size-3"}`}
                    aria-hidden="true"
                  >
                    <path d="M6 0.8 11.2 11H0.8Z" fill={color} stroke="white" strokeWidth={isPossessing ? "1.5" : "1.2"} />
                  </svg>
                ) : (
                  <span
                    aria-hidden="true"
                    className={`relative block rounded-full ${isPossessing
                      ? "size-4 border-2 border-white shadow-[0_0_9px_3px_rgba(255,255,255,0.8)]"
                      : `size-2.5 border shadow-sm ${isOfficial ? "border-amber-100" : "border-white"}`}`}
                    style={{ backgroundColor: color }}
                  />
                )}
                {isPossessing ? (
                  <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-white/40 bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow-md">
                    {personName}
                  </span>
                ) : null}
              </span>
            );
          })}
          {animatedBall ? (
            <FootballIcon
              size={14}
              className="absolute z-20 size-3.5 -translate-x-1/2 -translate-y-1/2 drop-shadow text-foreground"
              style={{
                ...point(animatedBall.x, animatedBall.y),
                willChange: "left, top",
              }}
              role="img"
              aria-label="Ball"
              title="Ball"
            />
          ) : null}
          {!frame ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 px-2 text-center desk-type-meta text-white">
              {emptyMessage || "Waiting for frame"}
            </div>
          ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
