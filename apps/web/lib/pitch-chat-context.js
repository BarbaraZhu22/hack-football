"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useIncidentReview } from "@/lib/incident-review-context";
import { MATCH } from "@/lib/incident";
import { buildSimulation } from "@/lib/incident-simulation";
import { buildOffsideSimulation } from "@/lib/offside-simulation";
import { useScene } from "@/lib/scene/SceneProvider";

export function usePitchChatContext() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { state } = useScene();
  const { review } = useIncidentReview();

  return useMemo(() => {
    if (!pathname?.startsWith("/pitch")) return null;

    const incidentId = params.get("incident") || "tackle";
    const sim = incidentId === "offside" ? buildOffsideSimulation() : buildSimulation();
    const offside = sim.kind === "offside";
    const assessment = review?.incident?.id === incidentId ? review.assessment : sim.offside;

    return {
      incidentId,
      incidentLabel: offside ? "Offside position" : "Serious foul play",
      contact: offside
        ? null
        : {
            pointOfContactM: Number(sim.impact.point.y.toFixed(2)),
            closingSpeedMps: Number(sim.meta.speed.closing.toFixed(1)),
            peakForceKN: Number((sim.impact.peakForce / 1000).toFixed(1)),
            contactDurationMs: Math.round(sim.impact.duration * 1000),
            severityIndex: 0.87,
            ballContactDelayMs: Math.round(sim.impact.ballDelay * 1000),
          },
      offside: offside
        ? {
            reviewFrame: "current_playback_frame",
            assessment,
          }
        : null,
      video: {
        feedId: "RF-7829",
        cameraCode: offside ? "CAM 01" : "CAM 02",
        matchClock: offside ? "27:10" : MATCH.clock,
        stadium: MATCH.stadium,
        frameRateFps: 100,
        solver: offside ? "PASS RETARGET" : "CONTACT SOLVER",
      },
      scene: {
        cameraPreset: state.camera?.preset,
        incidentTimeSeconds: state.incident?.time,
        contactTimeSeconds: state.incident?.contactTime,
        durationSeconds: state.incident?.duration,
        overlays: { ...state.overlays },
      },
    };
  }, [
    pathname,
    params,
    state.camera?.preset,
    state.incident?.time,
    state.incident?.contactTime,
    state.incident?.duration,
    state.overlays,
    review?.incident?.id,
    review?.assessment,
  ]);
}
