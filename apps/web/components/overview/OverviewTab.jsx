"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Whistle } from "lucide-react";

import AgentPanel from "@/components/overview/AgentPanel";
import EventTimeline, { EventTimelineLegend } from "@/components/overview/EventTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH } from "@/lib/incident";
import { getIncident, MATCH_DECISIONS, MATCH_EVENTS, RATINGS } from "@/lib/incidents";
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

// The match is in play at MATCH.clock; the desk runs it forward one second at
// a time so the header clock and the commentary feed share the same source.
const CLOCK_START_SECONDS = 78 * 60 + 32;

function useMatchClock() {
  const [seconds, setSeconds] = useState(CLOCK_START_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const minute = Math.floor(seconds / 60);
  const second = seconds % 60;
  return {
    minute,
    second,
    label: `${minute}:${String(second).padStart(2, "0")}`,
  };
}

function LiveClock({ clock }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1">
      <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
      <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-red-600 dark:text-red-400">
        {clock.label}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-red-600/80 dark:text-red-400/80">
        Live
      </span>
    </span>
  );
}

const STAT_ROWS = [
  { label: "Possession", home: 58, away: 42, unit: "%" },
  { label: "Shots", home: 14, away: 9 },
  { label: "Shots on target", home: 5, away: 3 },
  { label: "Big chances", home: 4, away: 2 },
  { label: "Expected goals", home: 1.84, away: 1.12 },
  { label: "Passes", home: 612, away: 487 },
  { label: "Pass accuracy", home: 87, away: 81, unit: "%" },
  { label: "Duels won", home: 54, away: 46 },
  { label: "Corners", home: 7, away: 4 },
  { label: "Offsides", home: 2, away: 1 },
  { label: "Saves", home: 3, away: 5 },
  { label: "Fouls", home: 11, away: 14 },
  { label: "Yellow cards", home: 2, away: 3 },
];

// One pitch, two teams stacked: away on top, home at the bottom.
// Positions are computed so no two labels overlap: rows are staggered in x
// (GK/DEF use 13-37-63-87, MID 24-50-76, FWD 17-50-83) and rows that share an
// x value keep at least 14% vertical separation, which exceeds the label
// stack height on the taller 2:3 pitch.
const LINEUP_PLAYERS = [
  { team: "away", number: 22, name: "Raya", rating: 7.0, x: 50, y: 8 },
  { team: "away", number: 4, name: "White", rating: 6.7, x: 13, y: 18 },
  { team: "away", number: 2, name: "Saliba", rating: 7.3, x: 37, y: 18 },
  { team: "away", number: 6, name: "Gabriel", rating: 7.2, x: 63, y: 18 },
  { team: "away", number: 35, name: "Zinchenko", rating: 6.6, x: 87, y: 18 },
  { team: "away", number: 8, name: "Odegaard", rating: 7.6, x: 24, y: 29 },
  { team: "away", number: 41, name: "Rice", rating: 7.4, x: 50, y: 29 },
  { team: "away", number: 5, name: "Partey", rating: 6.8, x: 76, y: 29 },
  { team: "away", number: 7, name: "Saka", rating: 7.7, x: 17, y: 43 },
  { team: "away", number: 9, name: "Jesus", rating: 7.0, x: 50, y: 43 },
  { team: "away", number: 11, name: "Martinelli", rating: 6.9, x: 83, y: 43 },
  { team: "home", number: 20, name: "B. Silva", rating: 7.5, x: 17, y: 58 },
  { team: "home", number: 9, name: "Haaland", rating: 7.9, x: 50, y: 58 },
  { team: "home", number: 47, name: "Foden", rating: 8.3, x: 83, y: 58 },
  { team: "home", number: 17, name: "De Bruyne", rating: 8.1, x: 24, y: 72 },
  { team: "home", number: 16, name: "Rodri", rating: 7.8, x: 50, y: 72 },
  { team: "home", number: 19, name: "Gundogan", rating: 7.2, x: 76, y: 72 },
  { team: "home", number: 2, name: "Walker", rating: 6.8, x: 13, y: 83 },
  { team: "home", number: 3, name: "Dias", rating: 7.4, x: 37, y: 83 },
  { team: "home", number: 25, name: "Akanji", rating: 7.0, x: 63, y: 83 },
  { team: "home", number: 24, name: "Gvardiol", rating: 6.9, x: 87, y: 83 },
  { team: "home", number: 31, name: "Ederson", rating: 7.1, x: 50, y: 92 },
];

const teamColor = (team) => (team === "home" ? MATCH.home.color : MATCH.away.color);

// Deterministic placeholder momentum: 2-minute segments, home positive,
// with spikes around goals and a dip on the red card.
const MOMENTUM = (() => {
  let seed = 20260929;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: 46 }, (_, index) => {
    const minute = index * 2;
    const base = rand() * 1.5 - 0.75 + 0.16;
    let boost = 0;
    for (const event of MATCH_EVENTS) {
      if (minute < event.minute || minute > event.minute + 3) continue;
      if (event.type === "goal" || event.type === "penalty-goal") {
        boost += event.team === "home" ? 0.55 : -0.55;
      } else if (event.type === "red") {
        boost += event.team === "home" ? -0.3 : 0.3;
      }
    }
    return Math.max(-1, Math.min(1, base + boost));
  });
})();

function formatStat(value, unit) {
  return unit ? `${value}${unit}` : String(value);
}

function DecisionRow({ decision }) {
  const rating = RATINGS[decision.rating];
  const incident = decision.incidentId ? getIncident(decision.incidentId) : null;
  const reconstructed = incident?.status === "active";
  // Every decision is stamped in minutes only, so the two timelines read alike.
  const minuteLabel = `${decision.minute}'`;

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
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">{decision.meta}</span>
          {decision.meta ? " · " : ""}
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

function StatBarRow({ row }) {
  const homeLeads = row.home >= row.away;
  const share = homeLeads ? row.home / (row.home + row.away) : row.away / (row.home + row.away);
  const color = homeLeads ? MATCH.home.color : MATCH.away.color;
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

function EventIcon({ event }) {
  const color = teamColor(event.team);
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
        href={`/pitch?incident=${event.incidentId}`}
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

function MomentumChart() {
  const homeEvents = MATCH_EVENTS.filter((event) => event.team === "home");
  const awayEvents = MATCH_EVENTS.filter((event) => event.team === "away");
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Momentum</span>
        <span className="font-mono text-muted-foreground">0 – 90+</span>
      </div>
      <div className="relative mt-2.5">
        <div className="relative h-3.5">
          {homeEvents.map((event) => (
            <EventIcon key={`${event.type}-${event.minute}`} event={event} />
          ))}
        </div>
        <div className="relative flex h-[76px] overflow-hidden rounded-md border">
          <div className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: `${MATCH.home.color}14` }} />
          <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundColor: `${MATCH.away.color}14` }} />
          <div className="absolute inset-x-0 top-0 flex h-1/2 items-end gap-px px-1">
            {MOMENTUM.map((value, index) => (
              <div key={`up-${index}`} className="flex h-full flex-1 items-end justify-center">
                {value >= 0 ? (
                  <div
                    className="w-full max-w-[7px] rounded-t-sm"
                    style={{ height: `${Math.max(6, value * 100)}%`, backgroundColor: MATCH.home.color }}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-1/2 items-start gap-px border-t border-border/70 px-1">
            {MOMENTUM.map((value, index) => (
              <div key={`down-${index}`} className="flex h-full flex-1 items-start justify-center">
                {value < 0 ? (
                  <div
                    className="w-full max-w-[7px] rounded-b-sm"
                    style={{ height: `${Math.max(6, -value * 100)}%`, backgroundColor: MATCH.away.color }}
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
            <span className="size-2 rounded-full" style={{ backgroundColor: MATCH.home.color }} />
            {MATCH.home.code}
          </span>
          <span className="absolute bottom-1 left-1.5 flex items-center gap-1 rounded-full bg-card/85 px-1.5 py-0.5 text-[9px] font-semibold">
            <span className="size-2 rounded-full" style={{ backgroundColor: MATCH.away.color }} />
            {MATCH.away.code}
          </span>
        </div>
        <div className="relative h-3.5">
          {awayEvents.map((event) => (
            <EventIcon key={`${event.type}-${event.minute}`} event={event} />
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

function LineupPitch() {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Lineups</span>
        <span className="text-muted-foreground">Simulated</span>
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
        {LINEUP_PLAYERS.map((player) => (
          <div
            key={`${player.team}-${player.number}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${player.x}%`, top: `${player.y}%` }}
            title={`${player.name} - rating ${player.rating.toFixed(1)} (simulated)`}
          >
            <span
              className="grid size-5 place-items-center rounded-full border-2 text-[9px] font-bold text-white"
              style={{ backgroundColor: teamColor(player.team), borderColor: "rgba(255,255,255,0.9)" }}
            >
              {player.number}
            </span>
            <span className="mt-px whitespace-nowrap text-[9px] font-medium leading-none text-white/95">{player.name}</span>
            <span className="mt-px rounded bg-black/60 px-1 font-mono text-[9px] leading-none text-amber-300">
              {player.rating.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: MATCH.away.color }} />
          {MATCH.away.code} 4-3-3
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: MATCH.home.color }} />
          {MATCH.home.code} 4-3-3
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

function PlaybackFrame() {
  return (
    <Card className="shrink-0 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-2">
        <CardTitle className="text-sm">3D live playback</CardTitle>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
          Live
        </span>
      </CardHeader>
      <CardContent className="py-2">
        {/* Reserved for the real-time 3D playback surface - intentionally blank. */}
        <div
          className="aspect-video w-full rounded-lg border bg-muted/30"
          aria-label="3D live playback window"
        />
      </CardContent>
    </Card>
  );
}

export default function OverviewTab() {
  const [timeline, setTimeline] = useState("decisions");
  const clock = useMatchClock();

  const counts = MATCH_DECISIONS.reduce((acc, decision) => {
    acc[decision.rating] += 1;
    return acc;
  }, { green: 0, amber: 0, red: 0 });

  return (
    <div className="flex h-full flex-col gap-3">
      <Card className="shrink-0">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {MATCH.competition} · {MATCH.round}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: MATCH.home.color }} />
            {MATCH.home.code}
            <span className="mx-0.5 font-mono text-base font-bold tracking-tight">
              {MATCH.score[0]} – {MATCH.score[1]}
            </span>
            {MATCH.away.code}
            <span className="size-2.5 rounded-full" style={{ backgroundColor: MATCH.away.color }} />
          </span>
          <span className="text-muted-foreground">{MATCH.stadium}</span>
          <span className="text-muted-foreground">Att {MATCH.attendance}</span>
          <span className="text-muted-foreground">Incident {MATCH.incidentId}</span>
          <LiveClock clock={clock} />
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
                {MATCH_DECISIONS.map((decision) => (
                  <DecisionRow key={decision.id} decision={decision} />
                ))}
              </div>
            ) : (
              <EventTimeline />
            )}
            <div className="shrink-0 border-t pt-2">
              {timeline === "decisions" ? (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium" style={{ color: RATINGS.green.color }}>{counts.green} correct</span>
                  {" · "}
                  <span className="font-medium" style={{ color: RATINGS.amber.color }}>{counts.amber} questionable</span>
                  {" · "}
                  <span className="font-medium" style={{ color: RATINGS.red.color }}>{counts.red} controversial</span>
                  {" · "}
                  {MATCH_DECISIONS.length} decisions
                </p>
              ) : (
                <EventTimelineLegend />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-3">
          <PlaybackFrame />
          <div className="flex min-h-0 flex-1 flex-col">
            <AgentPanel clock={clock} />
          </div>
        </div>

        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 py-2">
            <div>
              <CardTitle className="text-sm">Match stats</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Placeholder data feed - sofascore style comparison.</p>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: MATCH.home.color }} />
                {MATCH.home.code} pushing
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: MATCH.away.color }} />
                {MATCH.away.code} pushing
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
            <MomentumChart />

            <div className="grid min-h-0 flex-1 items-start gap-4 border-t pt-3 lg:grid-cols-[1fr_250px]">
              <div className="flex min-h-0 flex-col justify-between">
                {STAT_ROWS.map((row) => (
                  <StatBarRow key={row.label} row={row} />
                ))}
              </div>
              <LineupPitch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
