"use client";

import { Whistle } from "lucide-react";

import {
  BootIcon,
  CardIcon,
  SubIcon,
  VarIcon,
} from "./event-icons";
import { FootballIcon } from "@/components/ui/football-icon";

const YELLOW = "#f5c518";
const RED = "#e5484d";
const EVENT_TYPES = new Set(["goal", "penalty-goal", "own-goal", "penalty-missed", "yellow", "red", "sub", "substitution", "var"]);

function minuteLabel(event) {
  if (event.minuteLabel) return event.minuteLabel.replace(/:.*$/, "");
  return event.minute > 90 ? `90+${event.minute - 90}` : String(event.minute);
}

function TeamChip({ team }) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 desk-type-meta font-bold tracking-wider"
      style={{ color: team.color, backgroundColor: `${team.color}1f` }}
    >
      {team.code}
    </span>
  );
}

function Rail({ children }) {
  return (
    <div className="relative flex w-4 shrink-0 justify-center">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
      {children}
    </div>
  );
}

function EventRow({ event, match }) {
  const team = event.team === "home" ? match.home : match.away;

  let icon = null;
  let title = event.player ?? event.label;
  let detail = null;
  let tag = null;

  if (event.type === "goal" || event.type === "penalty-goal" || event.type === "own-goal") {
    const iconColor = event.type === "penalty-goal"
      ? "text-emerald-600"
      : event.type === "own-goal"
        ? "text-violet-600"
        : undefined;
    icon = <FootballIcon className={iconColor} />;
    if (event.type === "penalty-goal") tag = "PEN";
    if (event.type === "own-goal") tag = "OG";
    detail = event.assist ? (
      <span className="inline-flex items-center gap-1">
        <BootIcon size={12} />
        {event.assist}
      </span>
    ) : (
      event.note
    );
  } else if (event.type === "penalty-missed") {
    icon = <FootballIcon className="text-emerald-600" missed />;
    detail = event.note;
  } else if (event.type === "yellow" || event.type === "red") {
    icon = <CardIcon color={event.type === "yellow" ? YELLOW : RED} />;
    detail = event.note;
  } else if (event.type === "sub" || event.type === "substitution") {
    icon = <SubIcon />;
    title = "Substitution";
    detail = event.player && event.replaced
      ? `${event.player} on for ${event.replaced}`
      : event.note;
  } else if (event.type === "var") {
    icon = <VarIcon />;
    title = "VAR review";
    detail = `${event.player} · ${event.note}`;
  }

  return (
    <div className="group relative flex gap-2">
      <div className="w-8 shrink-0 pt-[5px] text-right desk-type-meta tabular-nums text-muted-foreground">
        {minuteLabel(event)}&apos;
      </div>
      <Rail>
        <span className="relative z-10 mt-[6px] grid size-4 place-items-center rounded-full bg-card">
          <span className="size-2 rounded-full" style={{ backgroundColor: team.color }} />
        </span>
      </Rail>
      <div className="min-w-0 flex-1 pb-3 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0">{icon}</span>
            <span className="truncate text-xs font-semibold">{title}</span>
            {tag ? (
              <span className="shrink-0 rounded bg-muted px-1 desk-type-meta font-bold tracking-wider text-muted-foreground">
                {tag}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {event.score ? (
              <span className="rounded bg-muted px-1.5 py-0.5 desk-type-meta font-bold">
                {event.score}
              </span>
            ) : null}
            <TeamChip team={team} />
          </div>
        </div>
        {detail ? (
          <div className="mt-0.5 desk-type-meta text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1 truncate">{detail}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhaseRow({ phase }) {
  return (
    <div className="relative flex gap-2">
      <div className="w-8 shrink-0" />
      <Rail>
        <span className="relative z-10 mt-[3px] grid size-4 place-items-center rounded-full bg-card">
          <Whistle className="size-3 text-muted-foreground" />
        </span>
      </Rail>
      <div className="flex flex-1 items-center gap-2 pb-3 pt-0.5">
        <span className="desk-type-meta font-semibold uppercase tracking-[0.12em]">{phase.label}</span>
        <span className="desk-type-meta font-bold">{phase.score}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function Legend({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="shrink-0">{icon}</span>
      {label}
    </span>
  );
}

export function EventTimelineLegend({ events = [] }) {
  const goals = events.filter(
    (event) => event.type === "goal" || event.type === "penalty-goal" || event.type === "own-goal",
  ).length;
  const cards = events.filter(
    (event) => event.type === "yellow" || event.type === "red",
  ).length;
  const subs = events.filter((event) => event.type === "sub" || event.type === "substitution").length;

  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 desk-type-meta text-muted-foreground">
        <Legend icon={<FootballIcon size={12} />} label="Goal" />
        <Legend icon={<FootballIcon size={12} className="text-emerald-600" />} label="Penalty" />
        <Legend icon={<FootballIcon size={12} className="text-violet-600" />} label="Own goal" />
        <Legend icon={<BootIcon size={12} />} label="Assist" />
        <Legend
          icon={
            <span className="inline-flex items-center gap-0.5">
              <CardIcon size={12} color={YELLOW} />
              <CardIcon size={12} color={RED} />
            </span>
          }
          label="Card"
        />
        <Legend icon={<SubIcon size={12} />} label="Sub" />
        <Legend icon={<VarIcon size={12} />} label="VAR" />
        <Legend icon={<FootballIcon size={12} missed />} label="No goal" />
      </div>
      <p className="mt-1 desk-type-meta text-muted-foreground/80">
        {goals} goals · {cards} cards · {subs} substitution · shared with match momentum
      </p>
    </div>
  );
}

export default function EventTimeline({ events = [], phases = [], match }) {
  const halfTime = phases.filter((phase) => phase.phase === "half_time");
  const rows = [
    ...events.filter((event) => EVENT_TYPES.has(event.type)).map((event) => ({ kind: "event", time: event.timeMilliseconds, event })),
    ...halfTime.map((phase) => ({ kind: "phase", time: phase.timeMilliseconds, phase })),
  ].sort((left, right) => left.time - right.time);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {rows.map((row) =>
        row.kind === "phase" ? (
          <PhaseRow key={row.phase.id} phase={row.phase} />
        ) : (
          <EventRow key={row.event.id} event={row.event} match={match} />
        ),
      )}
    </div>
  );
}
