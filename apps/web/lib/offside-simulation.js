const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
function mixActorInto(target, left, right, amount) {
  target.x = lerp(left.x, right.x, amount);
  target.z = lerp(left.z, right.z, amount);
  target.yaw = lerp(left.yaw, right.yaw, amount);
  target.speed = lerp(left.speed, right.speed, amount);
}

const DT = 1 / 120;
const PASS_START = 0.5;
const BALL_RELEASE_LOCAL_TIME = 0.5;
const RELEASE_TIME = PASS_START + BALL_RELEASE_LOCAL_TIME;
const DURATION = RELEASE_TIME;

function makeFrame(t) {
  const actorTime = Math.min(t, RELEASE_TIME);
  const passer = {
    x: -3.3 + 0.1 * Math.sin(actorTime * 1.7),
    z: 17.2 + 4.7 * actorTime,
    yaw: 0,
    speed: t < RELEASE_TIME ? 4.7 : 0,
  };
  const receiver = {
    x: 0.1 + 0.08 * Math.sin(actorTime * 1.2),
    z: 26.4 + 4.7 * actorTime,
    yaw: 0,
    speed: t < RELEASE_TIME ? 4.7 : 0,
  };
  const defender = {
    x: -1.55 + 0.08 * Math.sin(actorTime * 1.1 + 0.5),
    z: 27.35 + 3.55 * actorTime,
    yaw: 0,
    speed: t < RELEASE_TIME ? 3.65 : 0,
  };
  const goalkeeper = {
    x: 0,
    z: 48.7,
    yaw: 0,
    speed: 0,
  };
  return { t, passer, receiver, defender, goalkeeper };
}

function makeBall(frame, t) {
  const flightTime = Math.max(0, t - RELEASE_TIME);
  const impulse = { x: 0.1, y: 1.1, z: 10.5 };
  const drag = { x: -0.12, z: -0.9 };
  return {
    p: {
      x: frame.passer.x - 0.2 + impulse.x * flightTime + 0.5 * drag.x * flightTime ** 2,
      y: Math.max(0.11, 0.12 + impulse.y * flightTime - 4.905 * flightTime ** 2),
      z: frame.passer.z + 0.48 + impulse.z * flightTime + 0.5 * drag.z * flightTime ** 2,
    },
    v: {
      x: flightTime > 0 ? impulse.x + drag.x * flightTime : 0,
      y: flightTime > 0 ? impulse.y - 9.81 * flightTime : 0,
      z: flightTime > 0 ? impulse.z + drag.z * flightTime : 0,
    },
  };
}

export function buildOffsideSimulation() {
  const steps = Math.round(DURATION / DT);
  const frames = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = Math.min(DURATION, i * DT);
    const frame = makeFrame(t);
    frame.ball = makeBall(frame, t);
    frames.push(frame);
  }

  const releaseFrame = frames[Math.round(RELEASE_TIME / DT)];
  // Opponents are ordered from nearest to farthest from their own goal line.
  // Here the goalkeeper is last and the blue defender is second-last.
  const opponentsByGoalDistance = [
    { role: "defender", z: releaseFrame.defender.z + 0.28 },
    { role: "goalkeeper", z: releaseFrame.goalkeeper.z + 0.28 },
  ].sort((a, b) => b.z - a.z);
  const secondLastOpponent = opponentsByGoalDistance[1];
  const lineZ = Math.max(releaseFrame.ball.p.z, secondLastOpponent.z);
  const receiverLeadingPointZ = releaseFrame.receiver.z + 0.24;
  const receiverMargin = receiverLeadingPointZ - lineZ;

  return {
    kind: "offside",
    frames,
    duration: DURATION,
    contactT: RELEASE_TIME,
    passStartT: PASS_START,
    passLocalReleaseT: BALL_RELEASE_LOCAL_TIME,
    offside: {
      lineZ,
      secondLastOpponent: secondLastOpponent.role,
      secondLastOpponentZ: secondLastOpponent.z,
      ballZ: releaseFrame.ball.p.z,
      receiverLeadingPointZ,
      receiverInOpponentsHalf: receiverLeadingPointZ > 0,
      aheadOfBall: receiverLeadingPointZ > releaseFrame.ball.p.z,
      aheadOfSecondLastOpponent: receiverLeadingPointZ > secondLastOpponent.z,
      receiverMargin,
      receiverAhead: receiverMargin > 0,
    },
    events: [
      {
        id: "run",
        label: "Attack develops",
        short: "RUN",
        t: 0.15,
        lane: "attack",
        tone: "accent",
        detail: "Two red attackers run toward the blue goal; the trailing player carries the ball from the recovery frame.",
      },
      {
        id: "pass",
        label: "Pass begins",
        short: "PASS",
        t: PASS_START,
        lane: "passer",
        tone: "accent",
        detail: "The trailing red player carries the run into a forward pass without breaking stride.",
      },
      {
        id: "release",
        label: "Ball leaves the boot",
        short: "RELEASE",
        t: RELEASE_TIME,
        lane: "ball",
        tone: "danger",
        detail: "The ball leaves the boot at the event-table pass timestamp; the receiver is fractionally beyond the second-last opponent.",
      },
    ],
    meta: {
      sampleRate: 120,
      passAnimation: "soccerPass",
      goalkeeperBehindShownDefender: true,
    },
  };
}

export function sampleOffsideFrame(sim, time, out) {
  const t = clamp(Number(time) || 0, 0, sim.duration);
  const cursor = t / DT;
  const i0 = Math.floor(cursor);
  const i1 = Math.min(sim.frames.length - 1, i0 + 1);
  const k = cursor - i0;
  const a = sim.frames[i0];
  const b = sim.frames[i1];
  if (i0 === i1) return a;

  const frame = out ?? {};
  frame.t = t;
  mixActorInto(frame.passer ?? (frame.passer = {}), a.passer, b.passer, k);
  mixActorInto(frame.receiver ?? (frame.receiver = {}), a.receiver, b.receiver, k);
  mixActorInto(frame.defender ?? (frame.defender = {}), a.defender, b.defender, k);
  mixActorInto(frame.goalkeeper ?? (frame.goalkeeper = {}), a.goalkeeper, b.goalkeeper, k);
  const ball = frame.ball ?? (frame.ball = { p: {}, v: null });
  const position = ball.p ?? (ball.p = {});
  position.x = lerp(a.ball.p.x, b.ball.p.x, k);
  position.y = lerp(a.ball.p.y, b.ball.p.y, k);
  position.z = lerp(a.ball.p.z, b.ball.p.z, k);
  ball.v = a.ball.v;
  return frame;
}
