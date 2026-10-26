"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Whistle } from "lucide-react";

import AgentPanel from "@/components/overview/AgentPanel";
import EventTimeline, { EventTimelineLegend } from "@/components/overview/EventTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH } from "@/lib/incident";
import { getIncident, RATINGS } from "@/lib/incidents";
import { cn } from "@/lib/utils";

const AXIS_MINUTES = 95;
const HALFTIME = 45;

// Left column: the decision timeline used to be 5fr against a 6fr stats panel.
// It is now 4.25fr (= 0.85 x 5fr, i.e. 15% narrower) while the stats panel
// keeps its 6fr, so its rendered width does not change. The 4fr column in the
// middle is the new 3D playback / agent stack.
const DESK_GRID = "xl:grid-cols-[minmax(0,4.25fr)_minmax(0,4fr)_minmax(0,6fr)]";

const TIMELINE_TABS = [
  { id: "decisions", label: "Decisions" },
  { id: "events", label: "Events" },
];

const INITIAL_CLOCK = { seconds: 78 * 60 + 32, minute: 78, second: 32, label: "78:32", finished: false };

function mergeById(current, incoming = []) {
  if (!incoming.length) return current;
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

function LiveClock({ clock, connection }) {
  const label = connection === "live"
    ? "Live"
    : connection === "finished"
      ? "Full time"
      : connection === "offline"
        ? "Offline"
        : "Connecting";
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1">
      <span className={cn("size-1.5 rounded-full bg-red-500", connection === "live" ? "animate-pulse" : "")} />
      <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-red-600 dark:text-red-400">
        {clock.label}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-red-600/80 dark:text-red-400/80">
        {label}
      </span>
    </span>
  );
}

const LINEUP_X = {
  GK: [50],
  RB: [13],
  CB: [37, 63],
  LB: [87],
  CM: [24, 76],
  CDM: [50],
  LW: [17],
  ST: [50],
  RW: [83],
};

function buildLineup(people = [], frame = null) {
  const peopleById = new Map(people.filter((person) => person.personId).map((person) => [person.personId, person]));
  const livePlayers = frame?.actors
    ?.filter((actor) => actor.team && actor.status === "active")
    .map((actor) => {
      const person = peopleById.get(actor.personId);
      if (!person) return null;
      return {
        personId: person.personId,
        team: person.team,
        number: person.number,
        name: person.name,
        position: person.position,
        x: Math.max(3, Math.min(97, ((actor.y + 34) / 68) * 100)),
        y: Math.max(3, Math.min(97, ((52.5 - actor.x) / 105) * 100)),
      };
    })
    .filter(Boolean);
  if (livePlayers?.length) return livePlayers;

  const slots = new Map();
  return people
    .filter((person) => person.squadRole === "start" && person.team)
    .map((person) => {
      const key = person.team + "-" + person.position;
      const index = slots.get(key) || 0;
      slots.set(key, index + 1);
      const isHome = person.team === "home";
      const position = person.position;
      const y = position === "GK"
        ? (isHome ? 92 : 8)
        : ["RB", "CB", "LB"].includes(position)
          ? (isHome ? 83 : 18)
          : ["CM", "CDM"].includes(position)
            ? (isHome ? 72 : 29)
            : (isHome ? 58 : 43);
      return { personId: person.personId, team: person.team, number: person.number, name: person.name, position, x: LINEUP_X[position]?.[index] ?? 50, y };
    });
}

const teamColor = (team, match) => (team === "home" ? match.home.color : match.away.color);

function playerRatingColor(rating) {
  if (rating < 6) return "#ef4444";
  if (rating < 6.5) return "#f97316";
  if (rating < 7) return "#eab308";
  return "#22c55e";
}

function formatStat(value, unit) {
  return unit ? `${value}${unit}` : String(value);
}

function DecisionRow({ decision }) {
  const rating = {
    correct: RATINGS.green,
    questionable: RATINGS.amber,
    controversial: RATINGS.red,
  }[decision.type] || RATINGS.green;
  const incident = decision.incidentId ? getIncident(decision.incidentId) : null;
  const reconstructed = incident?.status === "active";
  const minuteLabel = (decision.minuteLabel || decision.minute) + "'";

  const body = (
    <div className="relative flex gap-2 py-0.5">
      <span
        className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 bg-card"
        style={{ borderColor: rating.color }}
      >
        <Whistle className="size-3" style={{ color: rating.color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-xs font-medium">{minuteLabel}</span>
          <span className="text-xs font-medium">{decision.label}</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
            style={{ color: rating.color, backgroundColor: `${rating.color}1f` }}
          >
            {rating.label}
          </span>
          {incident ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
              {reconstructed ? "Open 3D review" : "Open review"} <ArrowUpRight className="size-3" />
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
          {decision.meta ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {decision.meta}
            </span>
          ) : null}
          {decision.meta && decision.detail ? " · " : ""}
          {decision.detail}
        </p>
      </div>
    </div>
  );

  if (incident) {
    return (
      <Link href={`/pitch?incident=${incident.id}`} className="group block rounded-lg px-1 transition hover:bg-muted/40">
        {body}
      </Link>
    );
  }
  return <div className="px-1">{body}</div>;
}

function StatBarRow({ row, match }) {
  const homeLeads = row.home >= row.away;
  const share = (homeLeads ? row.home : row.away) / Math.max(1, row.home + row.away);
  const color = homeLeads ? match.home.color : match.away.color;
  return (
    <div className="py-0.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-mono font-medium">{formatStat(row.home, row.unit)}</span>
        <span className="truncate text-muted-foreground">{row.label}</span>
        <span className="font-mono font-medium">{formatStat(row.away, row.unit)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function BallIcon({ missed }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={missed ? "#c9cfc9" : "#f8faf6"} stroke="#16241c" strokeWidth="1.6" />
      <path d="M12 6.8 L16 9.8 L14.3 14.8 L9.7 14.8 L8 9.8 Z" fill="#16241c" />
      {missed ? <path d="M4 4 L20 20 M20 4 L4 20" stroke="#e24b4a" strokeWidth="2.6" strokeLinecap="round" /> : null}
    </svg>
  );
}

function PenaltyIcon({ missed }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f8faf6" stroke="#16241c" strokeWidth="1.6" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#16241c">P</text>
      {missed ? <path d="M4.5 4.5 L19.5 19.5 M19.5 4.5 L4.5 19.5" stroke="#e24b4a" strokeWidth="2.4" strokeLinecap="round" /> : null}
    </svg>
  );
}

function CardIcon({ color }) {
  return (
    <span
      className="block h-3.5 w-2.5 rounded-[2px]"
      style={{ backgroundColor: color, boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}
    />
  );
}

function SubIcon({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 14 L8 5 M8 5 L4.8 8.2 M8 5 L11.2 8.2" />
      <path d="M16 10 L16 19 M16 19 L12.8 15.8 M16 19 L19.2 15.8" />
    </svg>
  );
}

function VarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" fill="#f8faf6" stroke="#16241c" strokeWidth="1.6" />
      <path d="M9 9.5 h5 v3.2 h-5 z" fill="none" stroke="#16241c" strokeWidth="1.3" />
      <path d="M12 17 v2.4 M8.5 21 h7" stroke="#16241c" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EventIcon({ event, match }) {
  const color = teamColor(event.team, match);
  const left = (event.minute / AXIS_MINUTES) * 100;
  let icon = null;
  if (event.type === "goal") icon = <BallIcon />;
  else if (event.type === "penalty-goal") icon = <PenaltyIcon />;
  else if (event.type === "penalty-missed") icon = <PenaltyIcon missed />;
  else if (event.type === "yellow") icon = <CardIcon color="#f3c847" />;
  else if (event.type === "red") icon = <CardIcon color="#e24b4a" />;
  else if (event.type === "sub") icon = <SubIcon color={color} />;
  else if (event.type === "var") icon = <VarIcon />;
  const marker = (
    <span
      className="absolute top-0 -translate-x-1/2 transition hover:scale-125"
      style={{ left: `${left}%` }}
      title={`${event.minute}' ${event.label}`}
    >
      {icon}
    </span>
  );
  if (event.incidentId) {
    return (
      <Link
      href={"/pitch?incident=" + event.incidentId}
        className="absolute top-0 -translate-x-1/2 transition hover:scale-125"
        style={{ left: `${left}%` }}
        title={`${event.minute}' ${event.label}`}
      >
        {icon}
      </Link>
    );
  }
  return marker;
}

function MomentumChart({ match, events, values }) {
  const homeEvents = events.filter((event) => event.team === "home");
  const awayEvents = events.filter((event) => event.team === "away");
  const momentum = values;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Momentum</span>
        <span className="font-mono text-muted-foreground">0 – 90+</span>
      </div>
      <div className="relative mt-2.5">
        <div className="relative h-3.5">
          {homeEvents.map((event) => (
            <EventIcon key={event.id} event={event} match={match} />
          ))}
        </div>
        <div className="relative flex h-[76px] overflow-hidden rounded-md border">
          <div className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: match.home.color + "14" }} />
          <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundColor: match.away.color + "14" }} />
          <div className="absolute inset-x-0 top-0 flex h-1/2 items-end gap-px px-1">
            {momentum.map((value, index) => (
              <div key={"up-" + index} className="flex h-full flex-1 items-end justify-center">
                {value >= 0 ? (
                  <div
                    className="w-full max-w-[7px] rounded-t-sm"
                    style={{ height: `${Math.max(6, value * 100)}%`, backgroundColor: match.home.color }}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-1/2 items-start gap-px border-t border-border/70 px-1">
            {momentum.map((value, index) => (
              <div key={"down-" + index} className="flex h-full flex-1 items-start justify-center">
                {value < 0 ? (
                  <div
                    className="w-full max-w-[7px] rounded-b-sm"
                    style={{ height: `${Math.max(6, -value * 100)}%`, backgroundColor: match.away.color }}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div
            className="absolute bottom-0 top-0 w-px bg-border"
            style={{ left: `${(HALFTIME / AXIS_MINUTES) * 100}%` }}
          />
          <span className="absolute left-1.5 top-1 flex items-center gap-1 rounded-full bg-card/85 px-1.5 py-0.5 text-[9px] font-semibold">
            <span className="size-2 rounded-full" style={{ backgroundColor: match.home.color }} />
            {match.home.code}
          </span>
          <span className="absolute bottom-1 left-1.5 flex items-center gap-1 rounded-full bg-card/85 px-1.5 py-0.5 text-[9px] font-semibold">
            <span className="size-2 rounded-full" style={{ backgroundColor: match.away.color }} />
            {match.away.code}
          </span>
        </div>
        <div className="relative h-3.5">
          {awayEvents.map((event) => (
            <EventIcon key={event.id} event={event} match={match} />
          ))}
        </div>
        <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>0&apos;</span>
          <span>45&apos;</span>
          <span>90+&apos;</span>
        </div>
      </div>
    </div>
  );
}

function LineupPitch({ match, players }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Lineups</span>
        <span className="text-muted-foreground">Rating / 10</span>
      </div>
      <div
        className="relative mt-1.5 aspect-[2/3] overflow-hidden rounded-lg border"
        style={{ backgroundColor: "#166534" }}
      >
        <div className="absolute inset-1.5 rounded border border-white/35" />
        <div className="absolute inset-x-1.5 top-1/2 h-px bg-white/35" />
        <div className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
        <div className="absolute left-1/2 top-1.5 h-[13%] w-[42%] -translate-x-1/2 border-x border-b border-white/35" />
        <div className="absolute left-1/2 top-1.5 h-[6%] w-[18%] -translate-x-1/2 border-x border-b border-white/35" />
        <div className="absolute left-1/2 bottom-1.5 h-[13%] w-[42%] -translate-x-1/2 border-x border-t border-white/35" />
        <div className="absolute left-1/2 bottom-1.5 h-[6%] w-[18%] -translate-x-1/2 border-x border-t border-white/35" />
        {players.map((player) => {
          const hasRating = Number.isFinite(player.rating);
          const ratingLabel = hasRating ? ` · Rating ${player.rating.toFixed(1)}/10` : "";
          const changeLabel = player.ratingDelta ? ` (${player.ratingDelta > 0 ? "+" : ""}${player.ratingDelta.toFixed(2)})` : "";
          return (
            <div
              key={`${player.team}-${player.number}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${player.x}%`, top: `${player.y}%` }}
              title={player.name + " · " + player.position + ratingLabel + changeLabel}
            >
              <span
                className="grid size-5 place-items-center rounded-full border-2 text-[9px] font-bold text-white"
                style={{ backgroundColor: teamColor(player.team, match), borderColor: "rgba(255,255,255,0.9)" }}
              >
                {player.number}
              </span>
              {hasRating ? (
                <span
                  className="-mt-0.5 grid h-[11px] min-w-[20px] place-items-center rounded-[2px] px-0.5 font-mono text-[7px] font-bold leading-none text-white shadow-sm"
                  style={{ backgroundColor: playerRatingColor(player.rating) }}
                >
                  {player.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="mt-0.5 whitespace-nowrap text-[9px] font-medium leading-none text-white/95">
                {player.name}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: match.away.color }} />
          {match.away.code} 4-3-3
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: match.home.color }} />
          {match.home.code} 4-3-3
        </span>
      </div>
    </div>
  );
}

function TabSwitch({ value, onChange, options }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border bg-muted/50 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "rounded px-2 py-1 text-[11px] font-medium transition-colors",
            value === option.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PlaybackFrame({ frame, match, people = [] }) {
  const actors = frame?.actors?.filter((actor) => actor.status === "active") || [];
  const positionsByPersonId = new Map(people.map((person) => [person.personId, person.position]));
  const [animatedBall, setAnimatedBall] = useState(frame?.ball || null);
  const ballPositionRef = useRef(null);
  const displayedFrameRef = useRef(null);
  useEffect(() => {
    if (!frame?.ball) return undefined;
    const frameKey = frame.frameId || frame.timeMilliseconds;
    if (frameKey === displayedFrameRef.current) return undefined;
    displayedFrameRef.current = frameKey;

    const target = { x: frame.ball.x, y: frame.ball.y };
    const from = ballPositionRef.current;
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
  }, [frame?.frameId, frame?.timeMilliseconds, frame?.ball?.x, frame?.ball?.y, frame?.possession?.teamCode, match.home.code]);
  const viewWidth = 111;
  const viewHeight = 68;
  const pitchWidthRatio = (viewWidth / viewHeight) / (16 / 9);
  const pitchSideGutter = (1 - pitchWidthRatio) / 2;
  const point = (x, y) => ({
    left: `${(pitchSideGutter + ((x + 55.5) / viewWidth) * pitchWidthRatio) * 100}%`,
    top: `${Math.max(1, Math.min(99, ((y + 34) / 68) * 100))}%`,
  });
  return (
    <Card className="shrink-0 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-2">
        <CardTitle className="text-sm">Live tracking</CardTitle>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
          {frame?.clockLabel || "Waiting for frame"}
        </span>
      </CardHeader>
      <CardContent className="py-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-emerald-800" aria-label="Live player and ball tracking frame">
          <svg
            className="absolute inset-0 size-full"
            viewBox="-3 0 111 68"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
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
          </svg>
          {actors.map((actor) => {
            const isOfficial = !actor.team;
            const isGoalkeeper = positionsByPersonId.get(actor.person_id || actor.personId) === "GK";
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
            const positionStyle = {
              ...point(actor.x, actor.y),
              transition: "left 1000ms linear, top 1000ms linear",
              willChange: "left, top",
            };
            return isGoalkeeper ? (
              <svg
                key={actor.person_id || actor.personId || actor.role}
                viewBox="0 0 12 12"
                className="absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm"
                style={positionStyle}
                role="img"
                aria-label={roleLabel}
                title={roleLabel}
              >
                <path d="M6 0.8 11.2 11H0.8Z" fill={color} stroke="white" strokeWidth="1.2" />
              </svg>
            ) : (
              <span
                key={actor.person_id || actor.personId || actor.role}
                className={`absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm ${isOfficial ? "border-amber-100" : "border-white"}`}
                style={{ ...positionStyle, backgroundColor: color }}
                title={roleLabel}
              />
            );
          })}
          {animatedBall ? (
            <svg
              viewBox="0 0 20 20"
              className="absolute z-20 size-3.5 -translate-x-1/2 -translate-y-1/2 drop-shadow"
              style={{
                ...point(animatedBall.x, animatedBall.y),
                willChange: "left, top",
              }}
              role="img"
              aria-label="Ball"
              title="Ball"
            >
              <circle cx="10" cy="10" r="8.5" fill="white" stroke="#172018" strokeWidth="1.2" />
              <path d="m10 5.8 3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="#172018" />
              <path d="m6.6 8.3-2.7-.9M13.4 8.3l2.7-.9M7.9 12.3l-1.5 2.4M12.1 12.3l1.5 2.4M10 5.8V2.3" fill="none" stroke="#172018" strokeWidth="1.1" />
            </svg>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewTab() {
  const [timeline, setTimeline] = useState("decisions");
  const [snapshot, setSnapshot] = useState(null);
  const [clock, setClock] = useState(INITIAL_CLOCK);
  const [connection, setConnection] = useState("connecting");
  const [apiError, setApiError] = useState("");
  const [currentFrame, setCurrentFrame] = useState(null);
  const framesRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    let stream;

    async function connect() {
      try {
        const response = await fetch("/api/match?through=78:32", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Match API request failed.");
        if (cancelled) return;

        setSnapshot(data);
        setClock(data.clock);
        framesRef.current = data.frames || [];
        setCurrentFrame(framesRef.current.at(-1) || null);
        setConnection(data.clock.finished ? "finished" : "connecting");
        if (data.clock.finished) return;

        stream = new EventSource("/api/match/stream?after=" + encodeURIComponent(data.cursor));
        stream.onopen = () => {
          if (!cancelled) setConnection("live");
        };
        stream.onerror = () => {
          if (!cancelled) setConnection("reconnecting");
        };
        stream.addEventListener("tick", (message) => {
          if (cancelled) return;
          const tick = JSON.parse(message.data);
          if (tick.frame) {
            framesRef.current.push(tick.frame);
            setCurrentFrame(tick.frame);
          }
          setClock(tick.clock);
          setSnapshot((current) => current ? {
            ...current,
            match: tick.match || current.match,
            stats: tick.stats || current.stats,
            cursor: tick.clock.seconds,
            events: mergeById(current.events, tick.events),
            timelineEvents: mergeById(current.timelineEvents, tick.timelineEvents),
            decisions: mergeById(current.decisions, tick.decisions),
            phases: mergeById(current.phases, tick.phases),
            ratings: mergeById(current.ratings || [], tick.ratings),
            momentum: tick.momentum || current.momentum,
          } : current);
          if (tick.clock.finished) {
            stream?.close();
            setConnection("finished");
          }
        });
      } catch (error) {
        if (!cancelled) {
          setConnection("offline");
          setApiError(error instanceof Error ? error.message : "Match API unavailable.");
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      stream?.close();
    };
  }, []);

  const matchData = snapshot || {};
  const match = matchData.match || MATCH;
  const events = matchData.events || [];
  const timelineEvents = matchData.timelineEvents || [];
  const decisions = matchData.decisions || [];
  const phases = matchData.phases || [];
  const statRows = matchData.stats || [];
  const momentum = matchData.momentum || [];
  const lineupPlayers = buildLineup(matchData.people || [], currentFrame);
  const lineupIds = new Set(lineupPlayers.map((player) => player.personId).filter(Boolean));
  const latestRatings = new Map();
  const lineupSecond = currentFrame?.timeSeconds ?? Number.MAX_SAFE_INTEGER;
  const ratingRows = matchData.ratings || [];
  for (let index = ratingRows.length - 1; index >= 0 && latestRatings.size < lineupIds.size; index -= 1) {
    const rating = ratingRows[index];
    if (rating.timeSeconds > lineupSecond || !lineupIds.has(rating.playerId) || latestRatings.has(rating.playerId)) continue;
    latestRatings.set(rating.playerId, rating);
  }
  const ratedLineupPlayers = lineupPlayers.map((player) => {
    const rating = latestRatings.get(player.personId);
    return {
      ...player,
      rating: rating?.rating ?? null,
      ratingDelta: rating?.ratingDelta ?? 0,
    };
  });
  const decisionCounts = decisions.reduce((counts, decision) => {
    if (decision.type in counts) counts[decision.type] += 1;
    return counts;
  }, { correct: 0, questionable: 0, controversial: 0 });

  return (
    <div className="flex h-full flex-col gap-3">
      <Card className="shrink-0">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {match.competition} · {match.round}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: match.home.color }} />
            {match.home.code}
            <span className="mx-0.5 font-mono text-base font-bold tracking-tight">
              {match.score[0]} – {match.score[1]}
            </span>
            {match.away.code}
            <span className="size-2.5 rounded-full" style={{ backgroundColor: match.away.color }} />
          </span>
          <span className="text-muted-foreground">{match.stadium}</span>
          <span className="text-muted-foreground">Att {match.attendance}</span>
          <span className="text-muted-foreground">Incident {match.incidentId}</span>
          <span className="text-muted-foreground">
            {apiError
              ? "Match data unavailable"
              : snapshot?.dataSource?.ok
                ? "Match data · PostgreSQL connected"
                : snapshot
                  ? "Match data connected"
                  : "Loading match data…"}
          </span>
          <LiveClock clock={clock} connection={connection} />
        </CardContent>
      </Card>

      <div className={cn("grid min-h-0 flex-1 items-stretch gap-3", DESK_GRID)}>
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-2">
            <CardTitle className="text-sm">Timeline</CardTitle>
            <TabSwitch value={timeline} onChange={setTimeline} options={TIMELINE_TABS} />
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col py-2">
            {timeline === "decisions" ? (
              <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-y-auto">
                <div className="absolute bottom-4 left-[18px] top-4 w-px bg-border" />
                {decisions.map((decision) => (
                  <DecisionRow key={decision.id} decision={decision} />
                ))}
                {!decisions.length ? (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    {apiError || (snapshot ? "No decision events recorded." : "Connecting to match API…")}
                  </p>
                ) : null}
              </div>
            ) : (
              <EventTimeline events={timelineEvents} phases={phases} match={match} />
            )}
            <div className="shrink-0 border-t pt-2">
              {timeline === "decisions" ? (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium" style={{ color: RATINGS.green.color }}>{decisionCounts.correct} correct</span>
                  {" · "}
                  <span className="font-medium" style={{ color: RATINGS.amber.color }}>{decisionCounts.questionable} questionable</span>
                  {" · "}
                  <span className="font-medium" style={{ color: RATINGS.red.color }}>{decisionCounts.controversial} controversial</span>
                  {" · "}
                  {decisions.length} decisions
                </p>
              ) : (
                <EventTimelineLegend events={timelineEvents} />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-3">
          <PlaybackFrame frame={currentFrame} match={match} people={matchData.people || []} />
          <div className="flex min-h-0 flex-1 flex-col">
            <AgentPanel clock={clock} events={events} phases={phases} match={match} />
          </div>
        </div>

        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 py-2">
            <div>
              <CardTitle className="text-sm">Match stats</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Mock match stats from the API.</p>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: match.home.color }} />
                {match.home.code} pushing
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: match.away.color }} />
                {match.away.code} pushing
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
            <MomentumChart match={match} events={timelineEvents} values={momentum} />

            <div className="grid min-h-0 flex-1 items-start gap-4 border-t pt-3 lg:grid-cols-[1fr_250px]">
              <div className="flex min-h-0 flex-col justify-between">
                {statRows.map((row) => (
                  <StatBarRow key={row.label} row={row} match={match} />
                ))}
              </div>
              <LineupPitch match={match} players={ratedLineupPlayers} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
