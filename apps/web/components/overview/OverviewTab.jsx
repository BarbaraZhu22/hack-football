"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Whistle } from "lucide-react";

import AgentPanel from "@/components/overview/AgentPanel";
import LiveTrackingFrame from "@/components/overview/LiveTrackingFrame";
import EventTimeline, { EventTimelineLegend } from "@/components/overview/EventTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FootballIcon } from "@/components/ui/football-icon";
import { MATCH } from "@/lib/incident";
import { getIncident, RATINGS } from "@/lib/incidents";
import { cn } from "@/lib/utils";

const AXIS_MINUTES = 95;
const HALFTIME = 45;
const MOMENTUM_BUCKET_SECONDS = 120;
const MOMENTUM_HEIGHT_SCALE = 3.75;

// Left column: the decision timeline used to be 5fr against a 6fr stats panel.
// It is now 4.25fr (= 0.85 x 5fr, i.e. 15% narrower) while the stats panel
// keeps its 6fr, so its rendered width does not change. The 4fr column in the
// middle is the new 3D playback / agent stack.
const DESK_GRID = "xl:grid-cols-[minmax(0,4.25fr)_minmax(0,4fr)_minmax(0,6fr)]";

const TIMELINE_TABS = [
  { id: "decisions", label: "Decisions" },
  { id: "events", label: "Events" },
];

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
  if (!clock?.label) {
    return (
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1">
        <span className="desk-type-meta font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1">
      <span className={cn("size-1.5 rounded-full bg-primary", connection === "live" ? "animate-pulse" : "")} />
      <span className="text-sm font-bold tabular-nums tracking-tight text-primary">
        {clock.label}
      </span>
      <span className="desk-type-meta font-semibold uppercase tracking-[0.14em] text-primary/80">
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

function decisionDescription(decision) {
  const team = decision.teamCode;
  switch (decision.decisionKind) {
    case "foul":
      return team ? `Free kick to ${team}` : "Free kick awarded";
    case "corner-awarded":
      return team ? `Corner to ${team}` : "Corner awarded";
    case "penalty-awarded":
      return team ? `Penalty to ${team}` : "Penalty awarded";
    case "offside":
      return "Offside";
    case "yellow":
      return decision.player ? `Yellow card · ${decision.player}` : "Yellow card";
    case "red":
      return decision.player ? `Red card · ${decision.player}` : "Red card";
    case "warning":
      return decision.player ? `Verbal warning · ${decision.player}` : "Verbal warning";
    default:
      return decision.detail || "";
  }
}

function DecisionRow({ decision, controversial }) {
  const incident = decision.incidentId ? getIncident(decision.incidentId) : null;
  const rating = controversial ? RATINGS.red : RATINGS.green;
  const minuteLabel = (decision.minuteLabel || decision.minute) + "'";
  const description = decisionDescription(decision);

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
          <span className="text-xs font-medium">{minuteLabel}</span>
          <span className="text-xs font-medium">{decision.label}</span>
          <span
            className="rounded-full px-1.5 py-0.5 desk-type-meta uppercase tracking-wider"
            style={{ color: rating.color, backgroundColor: `${rating.color}1f` }}
          >
            {rating.label}
          </span>
          {controversial && incident?.status === "active" ? (
            <span className="inline-flex items-center gap-1 desk-type-meta font-medium text-primary">
              3D review <ArrowUpRight className="size-3" />
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 break-words text-xs leading-4 text-muted-foreground">
          {decision.meta ? (
            <span className="desk-type-meta uppercase tracking-wider text-muted-foreground/70">
              {decision.meta}
            </span>
          ) : null}
          {decision.meta && description ? " · " : ""}
          {description}
        </p>
      </div>
    </div>
  );

  if (controversial && incident?.status === "active") {
    return (
      <Link href={`/pitch?incident=${incident.id}`} className="group block rounded-panel px-1 transition hover:bg-muted/40">
        {body}
      </Link>
    );
  }
  return <div className="px-1">{body}</div>;
}

function StatBarRow({ row, match }) {
  const homeValue = Math.max(0, Number(row.home) || 0);
  const awayValue = Math.max(0, Number(row.away) || 0);
  const total = homeValue + awayValue;
  const homeShare = total ? (homeValue / total) * 100 : 0;
  const awayShare = total ? (awayValue / total) * 100 : 0;
  return (
    <div className="py-0.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs">
        <span className="font-medium">{formatStat(row.home, row.unit)}</span>
        <span className="text-center text-muted-foreground">{row.label}</span>
        <span className="justify-self-end font-medium">{formatStat(row.away, row.unit)}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="ml-auto h-full rounded-full"
            style={{
              width: `${homeShare}%`,
              backgroundColor: match.home.color,
              opacity: homeValue >= awayValue ? 1 : 0.35,
            }}
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${awayShare}%`,
              backgroundColor: match.away.color,
              opacity: awayValue >= homeValue ? 1 : 0.35,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PenaltyIcon({ missed }) {
  return <FootballIcon size={14} className="text-emerald-600" missed={missed} />;
}

function CardIcon({ color }) {
  return (
    <span
      className="relative top-px block h-3 w-2 rounded-[2px]"
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

function EventIcon({ event, match }) {
  const color = teamColor(event.team, match);
  const left = (event.minute / AXIS_MINUTES) * 100;
  let icon = null;
  if (event.type === "goal") icon = <FootballIcon size={13} />;
  else if (event.type === "penalty-goal") icon = <FootballIcon size={13} className="text-emerald-600" />;
  else if (event.type === "own-goal") icon = <FootballIcon size={13} className="text-violet-600" />;
  else if (event.type === "penalty-missed") icon = <PenaltyIcon missed />;
  else if (event.type === "yellow") icon = <CardIcon color="#f3c847" />;
  else if (event.type === "red") icon = <CardIcon color="#e24b4a" />;
  else if (event.type === "sub") icon = <SubIcon color={color} />;
  const marker = (
    <span
      className="absolute top-0 -translate-x-1/2 transition hover:scale-125"
      style={{ left: `${left}%` }}
      title={`${event.minute}' ${event.label}`}
    >
      {icon}
    </span>
  );
  if (event.incidentId && getIncident(event.incidentId)?.status === "active") {
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

function MomentumChart({ match, events, values, clock }) {
  const homeEvents = events.filter((event) => event.team === "home");
  const awayEvents = events.filter((event) => event.team === "away");
  const momentum = values;
  const elapsedSeconds = Math.max(0, Number(clock?.seconds) || 0);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Momentum</span>
        <span className="text-muted-foreground">0 – 90+</span>
      </div>
      <div className="relative mt-2.5">
        <div className="relative h-9">
          <span className="absolute left-1 top-0 inline-flex items-center gap-1 rounded-full bg-card/85 px-1.5 py-0.5 desk-type-meta font-semibold">
            <span className="size-2 rounded-full" style={{ backgroundColor: match.home.color }} />
            {match.home.code}
          </span>
          <div className="absolute inset-x-0 bottom-0 h-3.5">
            {homeEvents.map((event) => (
              <EventIcon key={event.id} event={event} match={match} />
            ))}
          </div>
        </div>
        <div className="relative h-[76px] overflow-hidden rounded-md border">
          <div className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: match.home.color + "14" }} />
          <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundColor: match.away.color + "14" }} />
          <div className="absolute inset-x-0 top-0 h-1/2">
            {momentum.map((value, index) => {
              const startSeconds = index * MOMENTUM_BUCKET_SECONDS;
              const visibleSeconds = Math.max(0, Math.min(
                MOMENTUM_BUCKET_SECONDS,
                elapsedSeconds - startSeconds,
              ));
              if (visibleSeconds === 0 || value <= 0) return null;
              const barHeight = Math.max(12, Math.min(100, value * 100 * MOMENTUM_HEIGHT_SCALE)) * 0.7 + "%";
              return (
                <div
                  key={"up-" + index}
                  className="absolute inset-y-0 flex items-end justify-start"
                  style={{
                    left: (startSeconds / (AXIS_MINUTES * 60)) * 100 + "%",
                    width: (visibleSeconds / (AXIS_MINUTES * 60)) * 100 + "%",
                  }}
                >
                  <div
                    className="w-full max-w-[7px] rounded-t-sm"
                    style={{ height: barHeight, backgroundColor: match.home.color }}
                  />
                </div>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/2 border-t border-border/70">
            {momentum.map((value, index) => {
              const startSeconds = index * MOMENTUM_BUCKET_SECONDS;
              const visibleSeconds = Math.max(0, Math.min(
                MOMENTUM_BUCKET_SECONDS,
                elapsedSeconds - startSeconds,
              ));
              if (visibleSeconds === 0 || value >= 0) return null;
              const barHeight = Math.max(12, Math.min(100, -value * 100 * MOMENTUM_HEIGHT_SCALE)) * 0.7 + "%";
              return (
                <div
                  key={"down-" + index}
                  className="absolute inset-y-0 flex items-start justify-start"
                  style={{
                    left: (startSeconds / (AXIS_MINUTES * 60)) * 100 + "%",
                    width: (visibleSeconds / (AXIS_MINUTES * 60)) * 100 + "%",
                  }}
                >
                  <div
                    className="w-full max-w-[7px] rounded-b-sm"
                    style={{ height: barHeight, backgroundColor: match.away.color }}
                  />
                </div>
              );
            })}
          </div>
          <div
            className="absolute bottom-0 top-0 w-px bg-border"
            style={{ left: (HALFTIME / AXIS_MINUTES) * 100 + "%" }}
          />
          <div
            className="absolute bottom-0 top-0 w-px bg-foreground/40"
            style={{ left: Math.min(100, (elapsedSeconds / (AXIS_MINUTES * 60)) * 100) + "%" }}
            aria-label="Current match time"
          />
        </div>
        <div className="relative h-9">
          <div className="absolute inset-x-0 top-0 h-3.5">
            {awayEvents.map((event) => (
              <EventIcon key={event.id} event={event} match={match} />
            ))}
          </div>
          <span className="absolute bottom-0 left-1 inline-flex items-center gap-1 rounded-full bg-card/85 px-1.5 py-0.5 desk-type-meta font-semibold">
            <span className="size-2 rounded-full" style={{ backgroundColor: match.away.color }} />
            {match.away.code}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between desk-type-meta text-muted-foreground">
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
        className="relative mt-1.5 aspect-[2/3] overflow-hidden rounded-panel border border-border"
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
                  className="-mt-0.5 grid h-[11px] min-w-[20px] place-items-center rounded-[2px] px-0.5 text-[7px] font-bold leading-none text-white shadow-sm"
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
      <div className="mt-1.5 flex gap-4 desk-type-meta text-muted-foreground">
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
            "rounded px-2 py-1 desk-type-meta font-medium transition-colors",
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

export default function OverviewTab() {
  const [timeline, setTimeline] = useState("decisions");
  const [snapshot, setSnapshot] = useState(null);
  const [clock, setClock] = useState(null);
  const [connection, setConnection] = useState("connecting");
  const [apiError, setApiError] = useState("");
  const [currentFrame, setCurrentFrame] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let stream;

    async function connect() {
      try {
        const response = await fetch("/api/match", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Match API request failed.");
        if (cancelled) return;

        setSnapshot(data);
        setClock(data.clock);
        setCurrentFrame(data.frame ?? null);
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
          setLiveEvents(tick.events || []);
          if (tick.frame) {
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
  const controversialDecisionIds = new Set();
  const reviewedIncidentIds = new Set();
  for (const decision of decisions) {
    const incident = decision.incidentId ? getIncident(decision.incidentId) : null;
    if (incident?.status !== "active" || reviewedIncidentIds.has(incident.id)) continue;
    reviewedIncidentIds.add(incident.id);
    controversialDecisionIds.add(decision.id);
  }
  const phases = matchData.phases || [];
  const statRows = matchData.stats || [];
  const momentum = matchData.momentum || [];
  const lineupPlayers = buildLineup(matchData.people || [], currentFrame);
  const lineupIds = new Set(lineupPlayers.map((player) => player.personId).filter(Boolean));
  const latestRatings = new Map();
  const lineupSecond = clock?.seconds ?? Number.MAX_SAFE_INTEGER;
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
    counts[controversialDecisionIds.has(decision.id) ? "controversial" : "correct"] += 1;
    return counts;
  }, { correct: 0, questionable: 0, controversial: 0 });

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      <Card className="shrink-0">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
          <span className="desk-type-meta uppercase tracking-[0.12em] text-muted-foreground">
            {match.competition} · {match.round}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: match.home.color }} />
            {match.home.code}
            <span className="mx-0.5 text-base font-bold tracking-tight">
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
                ? snapshot.dataSource.backend === "local-csv"
                  ? "Local CSV · live replay"
                  : "Match data · PostgreSQL connected"
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
                  <DecisionRow
                    key={decision.id}
                    decision={decision}
                    controversial={controversialDecisionIds.has(decision.id)}
                  />
                ))}
                {!decisions.length ? (
                  <p className="px-1 desk-type-meta text-muted-foreground">
                    {apiError || (snapshot ? "No decision events recorded." : "Connecting to match API…")}
                  </p>
                ) : null}
              </div>
            ) : (
              <EventTimeline events={timelineEvents} phases={phases} match={match} />
            )}
            <div className="shrink-0 border-t pt-2">
              {timeline === "decisions" ? (
                <p className="desk-type-meta text-muted-foreground">
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
          <LiveTrackingFrame frame={currentFrame} match={match} people={matchData.people || []} liveEvents={liveEvents} />
          <div className="flex min-h-0 flex-1 flex-col">
            <AgentPanel events={events} phases={phases} match={match} />
          </div>
        </div>

        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 py-2">
            <div>
              <CardTitle className="text-sm">Match stats</CardTitle>
              <p className="mt-0.5 desk-type-meta text-muted-foreground">Local CSV · recalculated with the live clock.</p>
            </div>
            <div className="flex items-center gap-2.5 desk-type-meta text-muted-foreground">
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
            <MomentumChart match={match} events={timelineEvents} values={momentum} clock={clock} />

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
