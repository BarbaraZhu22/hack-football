"use client";

import { useMemo } from "react";
import { sampleFrame } from "@/lib/incident-simulation";
import { sampleOffsideFrame } from "@/lib/offside-simulation";
import styles from "./ViewportChrome.module.css";

const W = 264;
const H = 168;
const PX = 12;
const PY = 22;
const PW = 220;
const PH = 126;
const mx = (x) => PY + ((x + 34) / 68) * PH;
const mz = (z) => PX + ((z + 52.5) / 105) * PW;

export default function Minimap({ sim, time, preset, variant = "viewport" }) {
  const offside = sim.kind === "offside";
  const frame = offside ? sampleOffsideFrame(sim, time) : sampleFrame(sim, time);
  const trails = useMemo(() => {
    const a = [];
    const b = [];
    const c = [];
    sim.frames.forEach((item, index) => {
      if (item.t > time) return;
      if (index % 12 === 0) {
        if (sim.kind === "offside") {
          a.push([mz(item.defender.z), mx(item.defender.x)]);
          b.push([mz(item.passer.z), mx(item.passer.x)]);
          c.push([mz(item.receiver.z), mx(item.receiver.x)]);
        } else {
          a.push([mz(item.tackler.z), mx(item.tackler.x)]);
          b.push([mz(item.carrier.z), mx(item.carrier.x)]);
        }
      }
    });
    return { a, b, c };
  }, [sim, time]);
  const ballTrail = useMemo(() => {
    const points = [];
    sim.frames.forEach((item, index) => {
      if (item.t > time || (!offside && item.t < sim.contactT)) return;
      if (index % 8 === 0) points.push([mz(item.ball.p.z), mx(item.ball.p.x)]);
    });
    return points;
  }, [offside, sim, time]);
  const cone = useMemo(() => {
    const points = {
      broadcast: [[10, 154], [74, 108], [132, 138]],
      touchline: [[222, 152], [168, 96], [124, 138]],
      tactical: [[132, 6], [54, 54], [210, 54]],
      referee: [[194, 152], [126, 84], [64, 124]],
      free: [[60, 154], [130, 70], [202, 138]],
    };
    return (points[preset] || points.broadcast).map((point) => point.join(",")).join(" ");
  }, [preset]);

  const blueActor = offside ? frame.defender : frame.tackler;
  const redActor = offside ? frame.receiver : frame.carrier;
  const redPasser = offside ? frame.passer : null;
  const blueX = mz(blueActor.z);
  const blueY = mx(blueActor.x);
  const redX = mz(redActor.z);
  const redY = mx(redActor.x);
  const passerX = redPasser ? mz(redPasser.z) : null;
  const passerY = redPasser ? mx(redPasser.x) : null;
  const ballX = mz(frame.ball.p.z);
  const ballY = mx(frame.ball.p.x);
  const labelGap = Math.hypot(blueX - redX, blueY - redY);
  const lineX = offside && time >= sim.contactT ? mz(sim.offside.lineZ) : null;

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
        <rect x="0" y="0" width={W} height={H} fill="#08110f" rx="5" />
        <polygon points={cone} fill="rgba(156,227,255,0.11)" stroke="rgba(156,227,255,0.32)" strokeWidth=".9" />
        <rect x={PX} y={PY} width={PW} height={PH} fill="url(#pitch-grad)" stroke="rgba(226,246,235,0.3)" strokeWidth=".8" rx="1" />
        <g stroke="rgba(226,246,235,0.22)" fill="none" strokeWidth=".7">
          <line x1={PX + PW / 2} y1={PY} x2={PX + PW / 2} y2={PY + PH} />
          <ellipse cx={PX + PW / 2} cy={PY + PH / 2} rx="19.4" ry="17.2" />
          <rect x={PX} y={PY + PH / 2 - 37.2} width="33.4" height="74.4" />
          <rect x={PX + PW - 33.4} y={PY + PH / 2 - 37.2} width="33.4" height="74.4" />
          <rect x={PX} y={PY + PH / 2 - 17} width="11.1" height="34" />
          <rect x={PX + PW - 11.1} y={PY + PH / 2 - 17} width="11.1" height="34" />
          <circle cx={PX + 22} cy={PY + PH / 2} r="1.2" fill="rgba(226,246,235,.4)" />
          <circle cx={PX + PW - 22} cy={PY + PH / 2} r="1.2" fill="rgba(226,246,235,.4)" />
        </g>
        <g opacity=".9">
          <polyline points={trails.a.map((point) => point.join(",")).join(" ")} fill="none" stroke="#8ee5ff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 2.2" filter="url(#mapGlow)" />
          <polyline points={trails.b.map((point) => point.join(",")).join(" ")} fill="none" stroke="#ff9a96" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 2.2" filter="url(#mapGlow)" />
          {offside ? <polyline points={trails.c.map((point) => point.join(",")).join(" ")} fill="none" stroke="#ff6e78" strokeWidth="2.1" strokeLinecap="round" strokeDasharray="3 2.2" filter="url(#mapGlow)" /> : null}
          <polyline points={ballTrail.map((point) => point.join(",")).join(" ")} fill="none" stroke="#e5ffb4" strokeWidth="1.9" strokeLinecap="round" opacity=".95" />
        </g>
        {!offside ? <g>
          <circle cx={mz(sim.impact.point.z)} cy={mx(sim.impact.point.x)} r="7.5" fill="none" stroke="#ffd166" strokeWidth="1.2" opacity=".95" />
          <circle cx={mz(sim.impact.point.z)} cy={mx(sim.impact.point.x)} r="2.2" fill="#ffd166" />
          <line x1={mz(sim.impact.point.z) - 8} y1={mx(sim.impact.point.x)} x2={mz(sim.impact.point.z) + 8} y2={mx(sim.impact.point.x)} stroke="#ffd166" strokeWidth=".5" opacity=".4" />
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
          <line x1={blueX} y1={blueY} x2={blueX + (offside || frame.tackler.vz >= 0 ? 8 : -8)} y2={blueY + (offside || frame.tackler.vx >= 0 ? 4 : -4)} stroke="#9ee7ff" strokeWidth="1.2" />
          <line x1={redX} y1={redY} x2={redX + (offside || frame.carrier.vz >= 0 ? 7 : -7)} y2={redY + (offside || frame.carrier.vx >= 0 ? 4 : -4)} stroke="#ffb2ad" strokeWidth="1.2" />
          {offside ? <line x1={passerX} y1={passerY} x2={passerX + 7} y2={passerY + 4} stroke="#ffb2ad" strokeWidth="1.2" /> : null}
        </g>
        {labelGap > 26 && (
          <g fill="rgba(235,246,240,.6)" fontSize="7" fontFamily="IBM Plex Mono, monospace">
            <text x={blueX + 9} y={blueY - 3} fill="#eaf8ff">MCI 6</text>
            <text x={redX + 9} y={redY + 9} fill="#ffe9e7">ARS 8</text>
          </g>
        )}
        <g fill="rgba(224,242,233,.42)" fontSize="5.5" fontFamily="IBM Plex Mono, monospace">
          <text x={PX + 4} y={H - 7}>DEF</text>
          <text x={PX + PW / 2 - 10} y={H - 7}>HALFWAY</text>
          <text x={PX + PW - 13} y={H - 7}>ATT</text>
          <path d={`M ${PX + PW - 27} ${H - 10} l 7 0 l -2.5 -2.5 M ${PX + PW - 20} ${H - 10} l -2.5 2.5`} stroke="rgba(200,230,215,.45)" fill="none" />
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
