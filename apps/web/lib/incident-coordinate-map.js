export const INCIDENT_TRACKING = Object.freeze({
  offside: Object.freeze({
    anchorSecond: 27 * 60 + 7,
    clock: "27:07",
    actors: Object.freeze({ passer: "ARS-8", receiver: "ARS-9", defender: "MCI-16", goalkeeper: "MCI-31" }),
  }),
  tackle: Object.freeze({
    anchorSecond: 77 * 60 + 37,
    clock: "77:37",
    actors: Object.freeze({ tackler: "MCI-24", carrier: "ARS-7" }),
  }),
});

export const INCIDENT_TRACKING_SAMPLE_RATE = 120;
export const INCIDENT_TRACKING_SAMPLE_STEP = 1 / INCIDENT_TRACKING_SAMPLE_RATE;

export function incidentActorMatchPoint(kind, actor) {
  return kind === "offside"
    ? { x: -actor.z, y: actor.x }
    : { x: actor.z, y: -actor.x };
}

export function incidentBallMatchPoint(kind, ball) {
  return kind === "offside"
    ? { x: -ball.p.z, y: ball.p.x, z: ball.p.y }
    : { x: ball.p.z, y: -ball.p.x, z: ball.p.y };
}

export function roundPitchCoordinate(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

export function simulationTimeAtMatchSecond(kind, simulation, matchSecond) {
  return Math.max(0, Math.min(
    simulation.duration,
    Number(matchSecond) - INCIDENT_TRACKING[kind].anchorSecond + simulation.contactT,
  ));
}

export function matchSecondAtSimulationTime(kind, simulation, time) {
  return INCIDENT_TRACKING[kind].anchorSecond - simulation.contactT + Number(time);
}

export function simulationMatchMilliseconds(kind, simulation, time) {
  const milliseconds = matchSecondAtSimulationTime(kind, simulation, time) * 1000;
  const wholeSecond = Math.round(milliseconds / 1000) * 1000;
  return Math.abs(milliseconds - wholeSecond) < 0.1 ? wholeSecond : milliseconds;
}
