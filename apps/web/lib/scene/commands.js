import { buildSimulation, sampleFrame } from "@/lib/incident-simulation";

const incidentSimulation = buildSimulation();

export const initialSceneState = createInitialSceneState();

function createInitialSceneState() {
  const incidentTime = incidentSimulation.contactT;
  const incidentFrame = sampleFrame(incidentSimulation, incidentTime);

  return {
    camera: {
      preset: "touchline",
      position: [40, 11, 24],
      lookAt: [27, 0, 10],
    },
    players: [
      { id: "24", team: "home", position: [incidentFrame.tackler.x, incidentFrame.tackler.comY, incidentFrame.tackler.z] },
      { id: "7", team: "away", position: [incidentFrame.carrier.x, incidentFrame.carrier.comY, incidentFrame.carrier.z] },
    ],
    ball: { position: [incidentFrame.ball.p.x, incidentFrame.ball.p.y, incidentFrame.ball.p.z] },
    arrows: [],
    highlight: null,
    incident: {
      time: incidentTime,
      duration: incidentSimulation.duration,
      contactTime: incidentSimulation.contactT,
      frame: incidentFrame,
    },
    overlays: {
      skeleton: false,
      labels: true,
      trajectory: true,
      forces: true,
      dual: true,
    },
    playback: {
      playing: false,
      time: null,
      seq: 0,
    },
  };
}

function withIncidentFrame(state, time) {
  const nextTime = Math.max(0, Math.min(incidentSimulation.duration, Number(time) || 0));
  const frame = sampleFrame(incidentSimulation, nextTime);

  return {
    ...state,
    incident: { ...state.incident, time: nextTime, frame },
    players: [
      { id: "24", team: "home", position: [frame.tackler.x, frame.tackler.comY, frame.tackler.z] },
      { id: "7", team: "away", position: [frame.carrier.x, frame.carrier.comY, frame.carrier.z] },
    ],
    ball: { position: [frame.ball.p.x, frame.ball.p.y, frame.ball.p.z] },
  };
}

export function applySceneAction(state, action) {
  if (!action?.type) return state;

  switch (action.type) {
    case "camera.set":
      return {
        ...state,
        camera: {
          preset: action.preset ?? state.camera.preset,
          position: action.position ?? state.camera.position,
          lookAt: action.lookAt ?? state.camera.lookAt,
        },
      };
    case "players.set":
      return {
        ...state,
        players: Array.isArray(action.players) ? action.players : state.players,
      };
    case "ball.set":
      return {
        ...state,
        ball: {
          position: action.position ?? state.ball.position,
        },
      };
    case "arrow.add": {
      const next = state.arrows.filter((arrow) => arrow.id !== action.id);
      next.push({
        id: action.id ?? `arrow-${next.length + 1}`,
        from: action.from ?? [0, 0.2, 0],
        to: action.to ?? [0, 0.2, 0],
      });
      return { ...state, arrows: next };
    }
    case "arrow.clear":
      return { ...state, arrows: [] };
    case "highlight":
      return {
        ...state,
        highlight: {
          target: action.target ?? "player",
          id: action.id ?? null,
        },
      };
    case "incident.seek":
      return withIncidentFrame(state, action.time);
    case "incident.playback": {
      const hasTime = Number.isFinite(Number(action.time));
      const next = hasTime ? withIncidentFrame(state, action.time) : state;
      return {
        ...next,
        playback: {
          playing: Boolean(action.playing),
          time: hasTime ? Number(action.time) : null,
          seq: (state.playback?.seq ?? 0) + 1,
        },
      };
    }
    case "pitch.overlay.set":
      if (!Object.hasOwn(state.overlays, action.key)) return state;
      return {
        ...state,
        overlays: {
          ...state.overlays,
          [action.key]: Boolean(action.enabled),
        },
      };
    case "reset":
      return createInitialSceneState();
    default:
      return state;
  }
}

export function actionsFromPlaybackText(text) {
  const source = String(text || "");
  const timed = source.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i)
    || source.match(/\b(?:play|resume|seek|jump|scrub|go to)\s+(\d+(?:\.\d+)?)/i);
  const seconds = timed ? Number(timed[1]) : null;
  const hasTime = Number.isFinite(seconds);
  if (/\b(play|resume)\b/i.test(source)) {
    if (!hasTime) return [{ type: "incident.playback", playing: true }];
    return [
      { type: "incident.seek", time: seconds },
      { type: "incident.playback", playing: true, time: seconds },
    ];
  }
  if (/\b(seek|jump|scrub|go to)\b/i.test(source) && hasTime) {
    return [{ type: "incident.seek", time: seconds }];
  }
  if (/\b(pause|stop)\b/i.test(source)) {
    return [{ type: "incident.playback", playing: false }];
  }
  return [];
}

export function actionsFromControlScene(input = {}) {
  const command = String(input.command || "").trim().toLowerCase();
  const time = Number(input.time_seconds);
  const hasTime = Number.isFinite(time) && time >= 0;
  if (command === "play" || command === "resume") {
    if (!hasTime) return [{ type: "incident.playback", playing: true }];
    return [
      { type: "incident.seek", time },
      { type: "incident.playback", playing: true, time },
    ];
  }
  if (command === "pause" || command === "stop") {
    return [{ type: "incident.playback", playing: false }];
  }
  if (command === "seek" && hasTime) {
    return [{ type: "incident.seek", time }];
  }
  return [];
}

export function applySceneActions(state, actions) {
  if (!Array.isArray(actions)) return state;
  return actions.reduce((next, action) => applySceneAction(next, action), state);
}
