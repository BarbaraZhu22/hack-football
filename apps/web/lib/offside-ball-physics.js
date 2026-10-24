const BALL_MASS = 0.43;
const FOOT_EFFECTIVE_MASS = 1.2;
const BALL_RESTITUTION = 0.38;
const GROUND_RESTITUTION = 0.34;
const GRAVITY = 9.81;
const BALL_RADIUS = 0.11;
const ROLL_RESISTANCE = 0.72;
const CONTACT_DURATION = 0.012;
export const OFFSIDE_PASS_FLIGHT_DURATION = 1.15;

function normalized(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function calculateBallisticReleaseVelocity(position, target, duration = OFFSIDE_PASS_FLIGHT_DURATION) {
  const time = Math.max(0.05, duration);
  return {
    x: (target.x - position.x) / time,
    y: (target.y - position.y + 0.5 * GRAVITY * time * time) / time,
    z: (target.z - position.z) / time,
  };
}

export function calculateOffsideKick(ballVelocity, footVelocity, strikeNormal, targetReleaseVelocity = null) {
  let normal = normalized(strikeNormal);
  const relativeVelocity = {
    x: footVelocity.x - ballVelocity.x,
    y: footVelocity.y - ballVelocity.y,
    z: footVelocity.z - ballVelocity.z,
  };
  let closingSpeed = Math.max(0, relativeVelocity.x * normal.x + relativeVelocity.y * normal.y + relativeVelocity.z * normal.z);
  const reducedMass = 1 / (1 / BALL_MASS + 1 / FOOT_EFFECTIVE_MASS);
  let impulseMagnitude = reducedMass * (1 + BALL_RESTITUTION) * closingSpeed;
  let impulse = {
    x: normal.x * impulseMagnitude,
    y: normal.y * impulseMagnitude,
    z: normal.z * impulseMagnitude,
  };
  let releaseVelocity = {
    x: ballVelocity.x + impulse.x / BALL_MASS,
    y: ballVelocity.y + impulse.y / BALL_MASS,
    z: ballVelocity.z + impulse.z / BALL_MASS,
  };

  if (targetReleaseVelocity) {
    impulse = {
      x: BALL_MASS * (targetReleaseVelocity.x - ballVelocity.x),
      y: BALL_MASS * (targetReleaseVelocity.y - ballVelocity.y),
      z: BALL_MASS * (targetReleaseVelocity.z - ballVelocity.z),
    };
    impulseMagnitude = Math.hypot(impulse.x, impulse.y, impulse.z);
    normal = normalized(impulse);
    closingSpeed = impulseMagnitude / (reducedMass * (1 + BALL_RESTITUTION));
    releaseVelocity = { ...targetReleaseVelocity };
  }

  return {
    normal,
    impulse,
    impulseMagnitude,
    closingSpeed,
    contactDuration: CONTACT_DURATION,
    averageForce: impulseMagnitude / CONTACT_DURATION,
    releaseVelocity,
  };
}

function flightTimeToGround(y, vy) {
  const height = Math.max(0, y - BALL_RADIUS);
  return Math.max(0, (vy + Math.sqrt(vy * vy + 2 * GRAVITY * height)) / GRAVITY);
}

export function sampleOffsideBallFlight(position, velocity, elapsed) {
  const t = Math.max(0, elapsed);
  const groundTime = flightTimeToGround(position.y, velocity.y);
  if (t <= groundTime) {
    return {
      position: {
        x: position.x + velocity.x * t,
        y: Math.max(BALL_RADIUS, position.y + velocity.y * t - 0.5 * GRAVITY * t * t),
        z: position.z + velocity.z * t,
      },
      velocity: { x: velocity.x, y: velocity.y - GRAVITY * t, z: velocity.z },
    };
  }

  const impactPosition = {
    x: position.x + velocity.x * groundTime,
    y: BALL_RADIUS,
    z: position.z + velocity.z * groundTime,
  };
  const impactVerticalSpeed = Math.max(0, GRAVITY * groundTime - velocity.y);
  const bounceVelocity = impactVerticalSpeed * GROUND_RESTITUTION;
  const bounceDuration = bounceVelocity > 0.12 ? (2 * bounceVelocity) / GRAVITY : 0;
  const bounceElapsed = Math.min(t - groundTime, bounceDuration);

  if (bounceElapsed < bounceDuration) {
    return {
      position: {
        x: impactPosition.x + velocity.x * bounceElapsed,
        y: Math.max(BALL_RADIUS, BALL_RADIUS + bounceVelocity * bounceElapsed - 0.5 * GRAVITY * bounceElapsed * bounceElapsed),
        z: impactPosition.z + velocity.z * bounceElapsed,
      },
      velocity: { x: velocity.x, y: bounceVelocity - GRAVITY * bounceElapsed, z: velocity.z },
    };
  }

  const bounceEnd = {
    x: impactPosition.x + velocity.x * bounceDuration,
    y: BALL_RADIUS,
    z: impactPosition.z + velocity.z * bounceDuration,
  };
  const rollTime = t - groundTime - bounceDuration;
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  const distance = horizontalSpeed > 0
    ? Math.min(horizontalSpeed * rollTime, horizontalSpeed * horizontalSpeed / (2 * ROLL_RESISTANCE))
    : 0;
  const travelTime = horizontalSpeed > 0 ? Math.min(rollTime, horizontalSpeed / ROLL_RESISTANCE) : 0;
  const rollSpeed = Math.max(0, horizontalSpeed - ROLL_RESISTANCE * travelTime);
  return {
    position: {
      x: bounceEnd.x + (horizontalSpeed > 0 ? (velocity.x / horizontalSpeed) * distance : 0),
      y: BALL_RADIUS,
      z: bounceEnd.z + (horizontalSpeed > 0 ? (velocity.z / horizontalSpeed) * distance : 0),
    },
    velocity: {
      x: horizontalSpeed > 0 ? (velocity.x / horizontalSpeed) * rollSpeed : 0,
      y: 0,
      z: horizontalSpeed > 0 ? (velocity.z / horizontalSpeed) * rollSpeed : 0,
    },
  };
}

export function makeOffsideBallFlightPath(position, velocity, duration = OFFSIDE_PASS_FLIGHT_DURATION, steps = 48) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = (duration * index) / steps;
    const point = sampleOffsideBallFlight(position, velocity, t).position;
    return [point.x, point.y, point.z];
  });
}
