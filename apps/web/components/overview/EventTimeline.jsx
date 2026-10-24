"use client";

import Link from "next/link";
import { ArrowUpRight, Whistle } from "lucide-react";

import { MATCH } from "@/lib/incident";
import { MATCH_EVENTS, MATCH_PHASES, getIncident } from "@/lib/incidents";
import {
  BallIcon,
  BootIcon,
  CardIcon,
  SubIcon,
  SubOutIcon,
  VarIcon,
} from "./event-icons";

const YELLOW = "#f5c518";
const RED = "#e5484d";

// Events and phase markers share one chronological axis, so the timeline
// reads top-to-bottom exactly like a livescore feed.
const ROWS = [
  ...MATCH_EVENTS.map((event) => ({ kind: "event", minute: event.minute, event })),
  ...MATCH_PHASES.map((phase) => ({ kind: "phase", minute: phase.minute, phase })),
].sort((a, b) => a.minute - b.minute);

function minuteLabel(minute) {
  return minute > 90 ? `90+${minute - 90}` : String(minute);
}

function TeamChip({ team }) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
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

function EventRow({ event }) {
  const team = event.team === "home" ? MATCH.home : MATCH.away;
  const incident = event.incidentId ? getIncident(event.incidentId) : null;
  const reconstructed = incident?.status === "active";

  let icon = null;
  let title = event.player ?? event.label;
  let detail = null;
  let tag = null;

  if (event.type === "goal" || event.type === "penalty-goal") {
    icon = <BallIcon />;
    if (event.type === "penalty-goal") tag = "PEN";
    detail = event.assist ? (
      <span className="inline-flex items-center gap-1">
        <BootIcon size={12} />
        {event.assist}
      </span>
    ) : (
      event.note
    );
  } else if (event.type === "penalty-missed") {
    icon = <BallIcon missed />;
    tag = "PEN";
    detail = event.note;
  } else if (event.type === "yellow" || event.type === "red") {
    icon = <CardIcon color={event.type === "yellow" ? YELLOW : RED} />;
    detail = event.note;
  } else if (event.type === "sub") {
    icon = <SubIcon />;
    detail = (
      <span className="inline-flex items-center gap-1">
        <SubOutIcon />
        {event.replaced}
      </span>
    );
  } else if (event.type === "var") {
    icon = <VarIcon />;
    title = "VAR review";
    detail = `${event.player} · ${event.note}`;
  }

  const reviewLink = incident ? (
    <Link
      href={`/pitch?incident=${incident.id}`}
      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-primary hover:underline"
    >
      {reconstructed ? "Open 3D review" : "Open review"}
      <ArrowUpRight className="size-3" />
    </Link>
  ) : null;

  return (
    <div className="group relative flex gap-2">
      <div className="w-8 shrink-0 pt-[5px] text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {minuteLabel(event.minute)}&apos;
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
              <span className="shrink-0 rounded bg-muted px-1 font-mono text-[9px] font-bold tracking-wider text-muted-foreground">
                {tag}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {event.score ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                {event.score}
              </span>
            ) : null}
            <TeamChip team={team} />
          </div>
        </div>
        {detail || reviewLink ? (
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1 truncate">{detail}</span>
            {reviewLink}
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{phase.label}</span>
        <span className="font-mono text-[11px] font-bold">{phase.score}</span>
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

export function EventTimelineLegend() {
  const goals = MATCH_EVENTS.filter(
    (event) => event.type === "goal" || event.type === "penalty-goal",
  ).length;
  const cards = MATCH_EVENTS.filter(
    (event) => event.type === "yellow" || event.type === "red",
  ).length;
  const subs = MATCH_EVENTS.filter((event) => event.type === "sub").length;

  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <Legend icon={<BallIcon size={12} />} label="Goal" />
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
        <Legend icon={<BallIcon size={12} missed />} label="No goal" />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/80">
        {goals} goals · {cards} cards · {subs} substitution · shared with match momentum
      </p>
    </div>
  );
}

export default function EventTimeline() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {ROWS.map((row) =>
        row.kind === "phase" ? (
          <PhaseRow key={`phase-${row.phase.kind}`} phase={row.phase} />
        ) : (
          <EventRow key={`${row.event.type}-${row.event.minute}`} event={row.event} />
        ),
      )}
    </div>
  );
}
