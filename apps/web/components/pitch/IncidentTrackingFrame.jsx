"use client";

import { useEffect, useMemo, useState } from "react";

import LiveTrackingFrame from "@/components/overview/LiveTrackingFrame";
import { MATCH } from "@/lib/incident";

function parseClockLabel(value) {
  const added = /^(\d+)\+(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value || "");
  if (added) {
    const baseMinute = Number(added[1]);
    const addedMinutes = Number(added[2]);
    const seconds = Number(added[3]);
    const milliseconds = Number((added[4] || "").padEnd(3, "0")) / 1000;
    return (baseMinute + addedMinutes + (baseMinute >= 90 ? 1 : 0)) * 60 + seconds + milliseconds;
  }
  const standard = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value || "");
  if (!standard) return 0;
  const milliseconds = Number((standard[3] || "").padEnd(3, "0")) / 1000;
  return Number(standard[1]) * 60 + Number(standard[2]) + milliseconds;
}

function clockQueryValue(totalSeconds) {
  const milliseconds = Math.max(0, Math.round(totalSeconds * 1000));
  const minute = Math.floor(milliseconds / 60000);
  const wholeSeconds = Math.floor(milliseconds / 1000) % 60;
  const fraction = milliseconds % 1000;
  return `${minute}:${String(wholeSeconds).padStart(2, "0")}.${String(fraction).padStart(3, "0")}`;
}

export default function IncidentTrackingFrame({ incident, simulation, time }) {
  const incidentSecond = parseClockLabel(incident.trackingAnchor || incident.minute);
  const isReconstructed = incident.status === "active";
  const targetSecond = Math.max(0, incidentSecond + (isReconstructed ? time - simulation.contactT : 0));
  const fromSecond = isReconstructed
    ? Math.max(0, incidentSecond - simulation.contactT - 0.01)
    : incidentSecond;
  const throughSecond = isReconstructed
    ? incidentSecond + simulation.duration - simulation.contactT + 0.01
    : incidentSecond;
  const [tracking, setTracking] = useState({ incidentId: null, status: "loading", frames: [] });

  useEffect(() => {
    const controller = new AbortController();
    setTracking({ incidentId: incident.incidentId, status: "loading", frames: [] });
    const query = new URLSearchParams({
      from: clockQueryValue(fromSecond),
      through: clockQueryValue(throughSecond),
    });

    async function loadTrackingFrames() {
      try {
        const response = await fetch(`/api/match/tracking?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Tracking data unavailable.");
        if (!data.frames?.length) throw new Error("No tracking frame exists near this incident time.");
        setTracking({ incidentId: incident.incidentId, status: "ready", ...data });
      } catch (error) {
        if (!controller.signal.aborted) {
          setTracking({
            incidentId: incident.incidentId,
            status: "error",
            frames: [],
            error: error instanceof Error ? error.message : "Tracking data unavailable.",
          });
        }
      }
    }

    loadTrackingFrames();
    return () => controller.abort();
  }, [fromSecond, incident.incidentId, throughSecond]);

  const sameIncident = tracking.incidentId === incident.incidentId;
  const frames = sameIncident ? tracking.frames : [];
  const frame = useMemo(() => {
    if (!frames.length) return null;
    return frames.reduce((closest, candidate) =>
      Math.abs(candidate.timeMilliseconds - targetSecond * 1000) < Math.abs(closest.timeMilliseconds - targetSecond * 1000)
        ? candidate
        : closest,
    );
  }, [frames, targetSecond]);

  return (
    <LiveTrackingFrame
      key={incident.incidentId}
      frame={frame}
      match={sameIncident && tracking.match ? tracking.match : MATCH}
      people={sameIncident ? tracking.people || [] : []}
      mode="incident"
      emptyMessage={sameIncident && tracking.status === "error" ? tracking.error : "Loading incident timeline…"}
    />
  );
}
