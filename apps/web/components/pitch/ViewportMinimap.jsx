"use client";

import { useMemo } from "react";
import { sampleFrame } from "@/lib/incident-simulation";
import { sampleOffsideFrame } from "@/lib/offside-simulation";
import {
  INCIDENT_TRACKING_SAMPLE_STEP,
  incidentActorMatchPoint,
  incidentBallMatchPoint,
  roundPitchCoordinate,
} from "@/lib/incident-coordinate-map";
import styles from "./ViewportChrome.module.css";

const W = 264;
const H = 168;
const PX = 15;
const PY = 4;
const PW = 234;
const PH = 151.5;
const SCALE_X = PW / 105;
const SCALE_Y = PH / 68;
const mx = (x) => PY + ((34 - x) / 68) * PH;
const mz = (z) => PX + ((z + 52.5) / 105) * PW;

export default function Minimap({ sim, time, variant = "viewport" }) {
  const offside = sim.kind === "offside";
  const sampleTime = Math.max(0, Math.min(
    sim.duration,
    Math.round(time / INCIDENT_TRACKING_SAMPLE_STEP) * INCIDENT_TRACKING_SAMPLE_STEP,
  ));
  const frame = offside ? sampleOffsideFrame(sim, sampleTime) : sampleFrame(sim, sampleTime);
  const actorPoint = (actor) => {
    const point = incidentActorMatchPoint(sim.kind, actor);
    return { x: mz(roundPitchCoordinate(point.x)), y: mx(-roundPitchCoordinate(point.y)) };
  };
  const ballPoint = (ball) => {
    const point = incidentBallMatchPoint(sim.kind, ball);
    return { x: mz(roundPitchCoordinate(point.x)), y: mx(-roundPitchCoordinate(point.y)) };
  };
  const trails = useMemo(() => {
    const a = [];
    const b = [];
    const c = [];
    sim.frames.forEach((item, index) => {
      if (item.t > time) return;
      if (index % 12 === 0) {
        if (sim.kind === "offside") {
          const defender = incidentActorMatchPoint(sim.kind, item.defender);
          const passer = incidentActorMatchPoint(sim.kind, item.passer);
          const receiver = incidentActorMatchPoint(sim.kind, item.receiver);
          a.push([mz(roundPitchCoordinate(defender.x)), mx(-roundPitchCoordinate(defender.y))]);
          b.push([mz(roundPitchCoordinate(passer.x)), mx(-roundPitchCoordinate(passer.y))]);
          c.push([mz(roundPitchCoordinate(receiver.x)), mx(-roundPitchCoordinate(receiver.y))]);
        } else {
          const tackler = incidentActorMatchPoint(sim.kind, item.tackler);
          const carrier = incidentActorMatchPoint(sim.kind, item.carrier);
          a.push([mz(roundPitchCoordinate(tackler.x)), mx(-roundPitchCoordinate(tackler.y))]);
          b.push([mz(roundPitchCoordinate(carrier.x)), mx(-roundPitchCoordinate(carrier.y))]);
        }
      }
    });
    return { a, b, c };
  }, [sim, time]);
  const ballTrail = useMemo(() => {
    const points = [];
    sim.frames.forEach((item, index) => {
      if (item.t > time || (!offside && item.t < sim.contactT)) return;
      if (index % 8 === 0) {
        const ball = incidentBallMatchPoint(sim.kind, item.ball);
        points.push([mz(roundPitchCoordinate(ball.x)), mx(-roundPitchCoordinate(ball.y))]);
      }
    });
    return points;
  }, [offside, sim, time]);
  const blueActor = offside ? frame.defender : frame.tackler;
  const redActor = offside ? frame.receiver : frame.carrier;
  const redPasser = offside ? frame.passer : null;
  const bluePoint = actorPoint(blueActor);
  const redPoint = actorPoint(redActor);
  const passerPoint = redPasser ? actorPoint(redPasser) : null;
  const ballMapPoint = ballPoint(frame.ball);
  const blueX = bluePoint.x;
  const blueY = bluePoint.y;
  const redX = redPoint.x;
  const redY = redPoint.y;
  const passerX = passerPoint?.x ?? null;
  const passerY = passerPoint?.y ?? null;
  const ballX = ballMapPoint.x;
  const ballY = ballMapPoint.y;
  const lineX = offside ? mz(-roundPitchCoordinate(sim.offside.lineZ)) : null;
  const nextFrame = offside
    ? sampleOffsideFrame(sim, Math.min(sim.duration, sampleTime + INCIDENT_TRACKING_SAMPLE_STEP))
    : sampleFrame(sim, Math.min(sim.duration, sampleTime + INCIDENT_TRACKING_SAMPLE_STEP));
  const directionEnd = (point, nextPoint, length) => {
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const span = Math.hypot(dx, dy) || 1;
    return { x: point.x + dx / span * length, y: point.y + dy / span * length };
  };
  const blueDirectionEnd = directionEnd(bluePoint, actorPoint(offside ? nextFrame.defender : nextFrame.tackler), 8);
  const redDirectionEnd = directionEnd(redPoint, actorPoint(offside ? nextFrame.receiver : nextFrame.carrier), 8);
  const passerDirectionEnd = redPasser
    ? directionEnd(passerPoint, actorPoint(nextFrame.passer), 8)
    : null;

  return (
    <div className={`${styles.minimap} ${variant === "panel" ? styles.minimapPanel : ""}`}>
      <div className={styles.minimapHead}>
        <span><i /> TACTICAL EYE</span>
        <span className={styles.mapMeta}>68 × 105 M</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Tactical minimap">
        <defs>
          <linearGradient id="pitch-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#133d2b" />
            <stop offset="1" stopColor="#0a2419" />
          </linearGradient>
          <filter id="mapGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x={PX} y={PY} width={PW} height={PH} fill="url(#pitch-grad)" stroke="rgba(226,246,235,0.3)" strokeWidth=".8" rx="1" />
        <g stroke="rgba(226,246,235,0.22)" fill="none" strokeWidth=".7">
          <line x1={PX + PW / 2} y1={PY} x2={PX + PW / 2} y2={PY + PH} />
          <ellipse cx={PX + PW / 2} cy={PY + PH / 2} rx={9.15 * SCALE_X} ry={9.15 * SCALE_Y} />
          <rect x={PX} y={PY + PH / 2 - (40.3 * SCALE_Y) / 2} width={16.5 * SCALE_X} height={40.3 * SCALE_Y} />
          <rect x={PX + PW - 16.5 * SCALE_X} y={PY + PH / 2 - (40.3 * SCALE_Y) / 2} width={16.5 * SCALE_X} height={40.3 * SCALE_Y} />
          <rect x={PX} y={PY + PH / 2 - (18.32 * SCALE_Y) / 2} width={5.5 * SCALE_X} height={18.32 * SCALE_Y} />
          <rect x={PX + PW - 5.5 * SCALE_X} y={PY + PH / 2 - (18.32 * SCALE_Y) / 2} width={5.5 * SCALE_X} height={18.32 * SCALE_Y} />
          <circle cx={PX + 11 * SCALE_X} cy={PY + PH / 2} r="1.2" fill="rgba(226,246,235,.4)" />
          <circle cx={PX + PW - 11 * SCALE_X} cy={PY + PH / 2} r="1.2" fill="rgba(226,246,235,.4)" />
        </g>
        <g opacity=".9">
          <polyline points={trails.a.map((point) => point.join(",")).join(" ")} fill="none" stroke="#8ee5ff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 2.2" filter="url(#mapGlow)" />
          <polyline points={trails.b.map((point) => point.join(",")).join(" ")} fill="none" stroke="#ff9a96" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 2.2" filter="url(#mapGlow)" />
          {offside ? <polyline points={trails.c.map((point) => point.join(",")).join(" ")} fill="none" stroke="#ff6e78" strokeWidth="2.1" strokeLinecap="round" strokeDasharray="3 2.2" filter="url(#mapGlow)" /> : null}
          <polyline points={ballTrail.map((point) => point.join(",")).join(" ")} fill="none" stroke="#e5ffb4" strokeWidth="1.9" strokeLinecap="round" opacity=".95" />
        </g>
        {!offside ? <g>
          <circle cx={mz(roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).x))} cy={mx(-roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).y))} r="7.5" fill="none" stroke="#ffd166" strokeWidth="1.2" opacity=".95" />
          <circle cx={mz(roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).x))} cy={mx(-roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).y))} r="2.2" fill="#ffd166" />
          <line x1={mz(roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).x)) - 8} y1={mx(-roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).y))} x2={mz(roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).x)) + 8} y2={mx(-roundPitchCoordinate(incidentActorMatchPoint(sim.kind, sim.impact.point).y))} stroke="#ffd166" strokeWidth=".5" opacity=".4" />
        </g> : null}
        {lineX !== null ? <line x1={lineX} y1={PY} x2={lineX} y2={PY + PH} stroke="#f2c94c" strokeWidth="1.5" strokeDasharray="3 2" filter="url(#mapGlow)" /> : null}
        <g filter="url(#mapGlow)">
          <circle cx={blueX} cy={blueY} r="8" fill="rgba(108,171,221,.18)" />
          <circle cx={blueX} cy={blueY} r="5.2" fill="#6CABDD" stroke="#e7f7ff" strokeWidth="1.4" />
          <circle cx={redX} cy={redY} r="8" fill="rgba(239,1,7,.16)" />
          <circle cx={redX} cy={redY} r="5.2" fill="#EF0107" stroke="#ffecec" strokeWidth="1.4" />
          {offside ? <>
            <circle cx={passerX} cy={passerY} r="8" fill="rgba(239,1,7,.16)" />
            <circle cx={passerX} cy={passerY} r="5.2" fill="#EF0107" stroke="#ffecec" strokeWidth="1.4" />
          </> : null}
          <circle cx={ballX} cy={ballY} r="3.2" fill="#f4ffd9" stroke="#314e29" strokeWidth=".9" />
          <line x1={blueX} y1={blueY} x2={blueDirectionEnd.x} y2={blueDirectionEnd.y} stroke="#9ee7ff" strokeWidth="1.2" />
          <line x1={redX} y1={redY} x2={redDirectionEnd.x} y2={redDirectionEnd.y} stroke="#ffb2ad" strokeWidth="1.2" />
          {offside ? <line x1={passerX} y1={passerY} x2={passerDirectionEnd.x} y2={passerDirectionEnd.y} stroke="#ffb2ad" strokeWidth="1.2" /> : null}
        </g>
        <g fontSize="6.2" fontFamily="IBM Plex Mono, monospace" paintOrder="stroke" stroke="#09120f" strokeWidth="1.8" strokeLinejoin="round">
          <text x={blueX - 8} y={blueY - 7} textAnchor="end" fill="#eaf8ff">MCI {offside ? "16" : "24"}</text>
          <text x={redX + 8} y={redY + 9} fill="#ffe9e7">ARS {offside ? "9" : "7"}</text>
        </g>
        {offside ? <g fill="rgba(235,246,240,.6)" fontSize="7" fontFamily="IBM Plex Mono, monospace">
          <text x={passerX + 7} y={passerY - 4} fill="#ffe9e7">ARS 8</text>
        </g> : null}
        <g fill="rgba(224,242,233,.42)" fontSize="5.5" fontFamily="IBM Plex Mono, monospace">
          <text x={offside ? PX + PW - 18 : PX + 4} y={H - 2}>DEF</text>
          <text x={PX + PW / 2 - 10} y={H - 2}>HALFWAY</text>
          <text x={offside ? PX + 4 : PX + PW - 13} y={H - 2}>ATT</text>
          <path d={`M ${PX + PW - 27} ${H - 6} l 7 0 l -2.5 -2.5 M ${PX + PW - 20} ${H - 6} l -2.5 2.5`} stroke="rgba(200,230,215,.45)" fill="none" />
        </g>
      </svg>
      <div className={styles.minimapFoot}>
        <span><i className={styles.dotHome} /> MCI</span>
        <span><i className={styles.dotAway} /> ARS</span>
        <span className={styles.mapSeparator} />
        <span><i className={styles.dotBall} /> BALL</span>
        <span className={styles.zoom}>1 : 900</span>
      </div>
    </div>
  );
}
