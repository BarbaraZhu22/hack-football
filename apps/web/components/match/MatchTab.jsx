"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, Download, Scale, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMatchStatus } from "@/lib/agent-client";
import {
  ACTUAL_DECISION,
  COMPARISONS,
  CRITERIA,
  INCIDENT_TAGS,
  LAW_LINKS,
  LEAGUE_DISTRIBUTION,
  MATCH,
  METRICS,
} from "@/lib/incident";
import { useScene } from "@/lib/scene/SceneProvider";

const TABS = [
  { id: "decision", label: "Decision" },
  { id: "laws", label: "Laws" },
  { id: "compare", label: "Compare" },
  { id: "motion", label: "Motion" },
];

const CAMERAS = {
  broadcast: [40, 11, 24],
  touchline: [34, 5, 22],
  tactical: [27, 34, 10],
  referee: [31, 4, 4],
};

function downloadFile(filename, content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildReport() {
  return {
    incident: {
      id: MATCH.incidentId,
      competition: MATCH.competition,
      match: `${MATCH.home.code} ${MATCH.score[0]}–${MATCH.score[1]} ${MATCH.away.code}`,
      stadium: MATCH.stadium,
      clock: MATCH.clock,
      description: "Late sliding challenge from side-rear. Studs-first contact above the right ankle; no clean ball contact.",
    },
    assessment: {
      recommendation: "RED CARD — serious foul play (Law 12.2)",
      onField: ACTUAL_DECISION.onField,
      final: ACTUAL_DECISION.final,
      confidence: ACTUAL_DECISION.confidence,
      severityIndex: 0.87,
      threshold: 0.72,
      analysis: ACTUAL_DECISION.analysis,
      bias: ACTUAL_DECISION.bias,
      consistency: ACTUAL_DECISION.consistency,
    },
    criteria: CRITERIA.map(({ label, status, law, reading, detail }) => ({ criterion: label, status, law, reading, detail })),
    metrics: METRICS,
    laws: LAW_LINKS.map(({ ref, title, url }) => ({ ref, title, url })),
    comparisons: COMPARISONS.map(({ context, fixture, similar, outcome, note }) => ({ context, fixture, similarity: similar, outcome, note })),
    provenance: {
      engine: "arbiter-recon v2.4 / deterministic contact solver",
      seed: 7829,
      disclaimer: ACTUAL_DECISION.disclaimer,
    },
  };
}

function StatusMark({ status }) {
  if (status === "met") return <Check className="size-4 text-primary" />;
  if (status === "partial") return <AlertTriangle className="size-4 text-muted-foreground" />;
  return <X className="size-4 text-destructive" />;
}

function DecisionView({ onCriterion, onTab, onJump }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/30">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Panel recommendation</Badge>
              <span className="text-xs text-muted-foreground">Law 12.2 · Serious foul play</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-destructive">RED CARD</h2>
              <span className="font-mono text-lg">91%</span>
              <span className="text-xs text-muted-foreground">confidence</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Studs-first contact above the ankle at 30.6 km/h, with no clean ball contact. The excessive-force threshold is met on the contact profile and follow-through.
            </p>
          </div>
          <div className="flex min-w-36 flex-col justify-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">On-field call</span>
            <span className="font-semibold">YELLOW <span className="px-1 text-muted-foreground">→</span> RED</span>
            <span className="text-xs text-muted-foreground">One tier lenient · 4–1 panel vote</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Criteria ladder</CardTitle>
          <Badge variant="outline">6 / 6 considered</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {CRITERIA.map((criterion) => (
            <button
              type="button"
              key={criterion.id}
              onClick={() => onCriterion(criterion)}
              className="rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-muted/40"
            >
              <div className="flex items-start gap-2.5">
                <StatusMark status={criterion.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="text-sm">{criterion.label}</b>
                    <span className="text-xs text-muted-foreground">{criterion.law}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-primary">{criterion.reading}</p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{criterion.detail}</p>
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">What the officials decided</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md bg-muted/50 p-2"><span className="block text-muted-foreground">On-field</span><b>Yellow card</b></div>
              <div className="rounded-md bg-muted/50 p-2"><span className="block text-muted-foreground">Final</span><b>Upheld</b></div>
              <div className="rounded-md bg-muted/50 p-2"><span className="block text-muted-foreground">Panel vote</span><b>{ACTUAL_DECISION.panelVote}</b></div>
            </div>
            <p className="leading-6 text-muted-foreground">{ACTUAL_DECISION.analysis}</p>
            <div className="flex gap-2 rounded-md border p-3 text-xs leading-5 text-muted-foreground"><Scale className="mt-0.5 size-4 shrink-0 text-primary" />{ACTUAL_DECISION.bias}</div>
            <p className="text-xs text-muted-foreground">{ACTUAL_DECISION.consistency}</p>
            <Button size="sm" variant="outline" onClick={() => onJump(2.8)}>Review at whistle</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Law basis</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onTab("laws")}>All five <ArrowUpRight className="ml-1 size-3.5" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {LAW_LINKS.slice(0, 3).map((law) => (
              <a key={law.ref} href={law.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-md border p-3 transition hover:bg-muted/40">
                <span><b className="mr-2 text-xs text-primary">{law.ref}</b><span className="text-sm">{law.title}</span></span>
                <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {INCIDENT_TAGS.map((tag) => <Badge key={tag} variant="outline" className="font-normal">{tag}</Badge>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        <CircleHelp className="mr-2 inline size-4 text-primary" />
        {ACTUAL_DECISION.disclaimer}
      </div>
    </div>
  );
}

function LawsView() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><Badge variant="secondary" className="w-fit">IFAB Laws of the Game · 2025/26</Badge><CardTitle className="mt-2">Law 12 — Fouls & misconduct</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {LAW_LINKS.map((law) => (
            <a key={law.ref} href={law.url} target="_blank" rel="noreferrer" className="rounded-lg border p-4 transition hover:border-primary/50 hover:bg-muted/30">
              <div className="flex items-center justify-between gap-3"><Badge variant="outline">{law.ref}</Badge><ArrowUpRight className="size-4 text-muted-foreground" /></div>
              <h3 className="mt-3 text-sm font-semibold">{law.title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{law.body}</p>
              <span className="mt-3 block text-xs text-primary">Open source ↗</span>
            </a>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Sanction ladder</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {[
            ["Careless", "No card", "Lack of attention or precaution"],
            ["Reckless", "Caution · yellow", "Disregard to danger or consequences"],
            ["Excessive force", "Send-off · red", "Endangers safety or uses brutality"],
          ].map(([level, sanction, detail]) => (
            <div key={level} className={`rounded-lg border p-3 ${level === "Excessive force" ? "border-primary/50 bg-primary/5" : "bg-muted/30"}`}>
              <b className="text-xs uppercase tracking-wider">{level}</b>
              <p className="mt-1 text-sm font-semibold">{sanction}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">VAR gate</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
          <p>{ACTUAL_DECISION.overturnGate}</p>
          <a className="inline-flex items-center gap-1 text-primary" href="https://www.theifab.com/laws/latest/video-assistant-referee-var-protocol/" target="_blank" rel="noreferrer">Read the VAR protocol <ArrowUpRight className="size-4" /></a>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareView({ onJump }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0"><div><Badge variant="secondary">League outcomes</Badge><CardTitle className="mt-2 text-base">Same contact profile</CardTitle></div><Badge variant="outline">n = 148</Badge></CardHeader>
        <CardContent>
          <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-label="Simulated league outcome distribution">
            {LEAGUE_DISTRIBUTION.map((item) => <div key={item.label} className={item.label === "Red card" ? "bg-destructive" : item.label === "Yellow card" ? "bg-primary" : "bg-muted-foreground"} style={{ width: `${item.value}%` }} title={`${item.label}: ${item.value}%`} />)}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {LEAGUE_DISTRIBUTION.map((item) => <div key={item.label} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"><span className="text-muted-foreground">{item.label}</span><b>{item.value}%</b></div>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Above-ankle contact with exposed leading studs is sent off in 68% of this simulated benchmark set. The same-match comparator is an outlier, not a precedent.</p>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {COMPARISONS.map((comparison) => (
          <Card key={comparison.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs text-muted-foreground">{comparison.context}</p><h3 className="mt-1 font-semibold">{comparison.fixture} · {comparison.minute}</h3></div>
                <Badge variant={comparison.outcome === "RED" ? "destructive" : "secondary"}>{comparison.outcome}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs"><div className="h-1.5 flex-1 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${comparison.similar * 100}%` }} /></div><span className="font-mono">{Math.round(comparison.similar * 100)}% similar</span></div>
              <p className="text-sm leading-5 text-muted-foreground">{comparison.note}</p>
              <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{comparison.source}</span><Button size="sm" variant="outline" onClick={() => onJump(1.9)}>Open frame</Button></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><AlertTriangle className="mr-2 inline size-4 text-primary" />Similarity is a weighted retrieval aid over contact height, entry angle, stud exposure, speed and ball proximity. It is not a precedent.</div>
    </div>
  );
}

function MotionView() {
  const joints = [
    ["Lead hip flexion", "78°", 65],
    ["Lead knee flexion", "96°", 69],
    ["Ankle plantarflexion", "22°", 44],
    ["Cervical rotation", "18°", 23],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><Badge variant="secondary" className="w-fit">Biomechanical readout</Badge><CardTitle className="mt-2">Contact kinematics</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border px-3">
            {joints.map(([label, value, percentage]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_auto_2fr]">
                <span className="text-sm">{label}</span><b className="font-mono text-sm">{value}</b>
                <div className="col-span-2 h-1.5 overflow-hidden rounded bg-muted sm:col-span-1"><div className="h-full rounded bg-primary" style={{ width: `${percentage}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">✓ Hinge limits satisfied · no reverse knee or elbow bend</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Closing speed</CardTitle></CardHeader>
        <CardContent>
          <svg viewBox="0 0 340 120" className="h-40 w-full" role="img" aria-label="Tackler and carrier speeds over the incident">
            {[10, 40, 70, 100].map((y) => <line key={y} x1="0" x2="340" y1={y} y2={y} className="stroke-border" strokeWidth="1" />)}
            <polyline points="0,96 34,92 68,85 102,76 136,64 170,60 204,54 238,40 272,44 306,62 340,84" fill="none" className="stroke-primary" strokeWidth="2.5" />
            <polyline points="0,88 34,77 68,70 102,62 136,55 170,52 204,60 238,72 272,89 306,98 340,102" fill="none" className="stroke-accent" strokeWidth="2.5" />
            <line x1="204" y1="5" x2="204" y2="112" className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="4 4" />
            <text x="210" y="15" className="fill-muted-foreground" fontSize="8">CONTACT</text>
          </svg>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>● Tackler</span><span>● Carrier</span><span className="ml-auto">0–3.3 s</span></div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {METRICS.map((metric) => <Card key={metric.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-1 font-mono text-xl">{metric.value} <span className="text-sm text-muted-foreground">{metric.unit}</span></p><p className="mt-1 text-xs text-muted-foreground">{metric.cue}</p></CardContent></Card>)}
      </div>
      <Card><CardHeader><CardTitle className="text-sm">Model disclosure</CardTitle></CardHeader><CardContent className="text-xs leading-5 text-muted-foreground">The lead-up motion is a synthetic reconstruction. Contact force is a heuristic band (±18%), not a measured load. Tracking, ball physics and panel findings are simulated for demonstration.</CardContent></Card>
    </div>
  );
}

export default function MatchTab() {
  const { run } = useScene();
  const [tab, setTab] = useState("decision");
  const [match, setMatch] = useState(null);
  const [serviceError, setServiceError] = useState(null);
  const report = useMemo(buildReport, []);

  useEffect(() => {
    let cancelled = false;
    fetchMatchStatus()
      .then((body) => { if (!cancelled) setMatch(body); })
      .catch((error) => { if (!cancelled) setServiceError(error instanceof Error ? error.message : "Service status unavailable"); });
    return () => { cancelled = true; };
  }, []);

  function jumpTo(time, camera = "touchline") {
    run([
      { type: "incident.seek", time },
      { type: "camera.set", preset: camera, position: CAMERAS[camera] ?? CAMERAS.touchline, lookAt: [27, 0, 10] },
      { type: "highlight", target: "player", id: "6" },
    ]);
  }

  function focusCriterion(criterion) {
    jumpTo(criterion.time, criterion.camera);
  }

  function exportReport(format) {
    if (format === "json") {
      downloadFile("MCI-ARS-7829-04-decision.json", JSON.stringify(report, null, 2), "application/json");
      return;
    }
    const markdown = [
      `# ${report.incident.match} — Incident ${report.incident.id}`,
      "",
      `**${report.incident.competition} · ${report.incident.clock} · ${report.incident.stadium}**`,
      "",
      report.incident.description,
      "",
      "## Recommendation",
      `**${report.assessment.recommendation}** · confidence ${Math.round(report.assessment.confidence * 100)}%`,
      "",
      `- On-field: ${report.assessment.onField} → final: ${report.assessment.final}`,
      `- Severity: ${report.assessment.severityIndex} (red threshold ${report.assessment.threshold})`,
      `- ${report.assessment.bias}`,
      "",
      report.assessment.analysis,
      "",
      "## Criteria",
      ...report.criteria.map((item) => `- **${item.criterion}** (${item.status}) — ${item.reading}. ${item.detail}`),
      "",
      "## Laws",
      ...report.laws.map((law) => `- ${law.ref} — ${law.title}: ${law.url}`),
      "",
      "## Comparators",
      ...report.comparisons.map((item) => `- ${item.context} · ${item.fixture} · ${Math.round(item.similarity * 100)}% similar · ${item.outcome}. ${item.note}`),
      "",
      `> ${report.provenance.disclaimer}`,
    ].join("\n");
    downloadFile("MCI-ARS-7829-04-decision.md", markdown, "text/markdown");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2"><Badge>Match desk</Badge><span className="text-xs text-muted-foreground">{MATCH.competition} · {MATCH.round}</span></div>
          <h1 className="text-2xl font-semibold tracking-tight">{MATCH.home.name} <span className="font-mono">{MATCH.score[0]}–{MATCH.score[1]}</span> {MATCH.away.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{MATCH.stadium} · {MATCH.attendance} · Incident {MATCH.incidentId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={serviceError ? "outline" : "secondary"}>{serviceError ? "Agent offline" : match?.status ?? "Checking service"}</Badge>
          <Button size="sm" variant="outline" onClick={() => exportReport("md")}><Download className="mr-1 size-4" /> Markdown</Button>
          <Button size="sm" onClick={() => exportReport("json")}><Download className="mr-1 size-4" /> JSON</Button>
        </div>
      </div>
      {serviceError ? <p className="text-xs text-muted-foreground">Match service status unavailable: {serviceError}</p> : match ? <p className="text-xs text-muted-foreground">{match.service}: {match.message}</p> : null}

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" role="tablist" aria-label="Match analysis">
        {TABS.map((item) => <Button key={item.id} role="tab" aria-selected={tab === item.id} size="sm" variant={tab === item.id ? "secondary" : "ghost"} onClick={() => setTab(item.id)}>{item.label}</Button>)}
      </div>

      {tab === "decision" ? <DecisionView onCriterion={focusCriterion} onTab={setTab} onJump={(time) => jumpTo(time, "referee")} /> : null}
      {tab === "laws" ? <LawsView /> : null}
      {tab === "compare" ? <CompareView onJump={(time) => jumpTo(time, "broadcast")} /> : null}
      {tab === "motion" ? <MotionView /> : null}

      <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span>{ACTUAL_DECISION.panel} · Synthetic review</span>
        <span>Event data, tracking and votes are simulated.</span>
      </div>
    </div>
  );
}
