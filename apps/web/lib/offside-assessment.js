export const OFFSIDE_ELIGIBLE_BODY_PARTS = Object.freeze([
  ["head", 0.12],
  ["chest", 0.15],
  ["pelvis", 0.14],
  ["thighL", 0.09],
  ["thighR", 0.09],
  ["calfL", 0.07],
  ["calfR", 0.07],
  ["footL", 0.06],
  ["footR", 0.06],
  ["toeL", 0.035],
  ["toeR", 0.035],
]);

export function measureLeadingBodyPointZ(parts, points, forwardZ) {
  let leadingZ = -Infinity;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const point = part.bone.getWorldPosition(points[index]);
    leadingZ = Math.max(leadingZ, point.z + part.extent * forwardZ);
  }
  return Number.isFinite(leadingZ) ? leadingZ : null;
}

export function calculateOffsideAssessment({
  ballZ,
  receiverLeadingPointZ,
  secondLastOpponentZ,
  measurementSource = "simulation_proxy",
  reviewTimeSeconds = null,
}) {
  const lineZ = Math.max(ballZ, secondLastOpponentZ);
  const receiverMargin = receiverLeadingPointZ - lineZ;

  return {
    lineZ,
    ballZ,
    receiverLeadingPointZ,
    secondLastOpponentZ,
    receiverInOpponentsHalf: receiverLeadingPointZ > 0,
    aheadOfBall: receiverLeadingPointZ > ballZ,
    aheadOfSecondLastOpponent: receiverLeadingPointZ > secondLastOpponentZ,
    receiverMargin,
    receiverAhead: receiverMargin > 0,
    measurementSource,
    reviewTimeSeconds,
  };
}
