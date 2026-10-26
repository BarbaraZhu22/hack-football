// Registry of controversial decisions under review.
// Tackle and offside have full 3D reconstructions; the other entries remain
// placeholders until their scenes are designed and built.
export const INCIDENTS = [
  {
    id: "tackle",
    label: "Tackle Controversy",
    short: "Tackle",
    minute: "77:38",
    rating: "red",
    status: "active",
    incidentId: "MCI-ARS-7829-04",
    summary:
      "Late sliding challenge from side-rear. Studs-first contact above the right ankle with no clean ball contact; VAR review initiated.",
  },
  {
    id: "offside",
    label: "Offside Controversy",
    short: "Offside",
    minute: "27:10",
    rating: "amber",
    status: "active",
    incidentId: "MCI-ARS-7829-02",
    summary:
      "Marginal offside call on a disallowed goal. The reconstruction freezes at pass release and compares the receiver with the second-last-opponent line.",
  },
  {
    id: "handball",
    label: "Handball Controversy",
    short: "Handball",
    minute: "74:05",
    rating: "amber",
    status: "placeholder",
    incidentId: "MCI-ARS-7829-05",
    summary:
      "Penalty appeal after the ball struck a defender's upper arm inside the box. Handball review pending.",
  },
  {
    id: "conflict",
    label: "Player Conflict",
    short: "Conflict",
    minute: "78:14",
    rating: "red",
    status: "placeholder",
    incidentId: "MCI-ARS-7829-06",
    summary:
      "Post-whistle confrontation between both squads after the final tackle. Misconduct review pending.",
  },
];

export const ACTIVE_INCIDENT_ID = "tackle";

export function getIncident(id) {
  return INCIDENTS.find((item) => item.id === id) ?? INCIDENTS[0];
}

// Rating scale used by the incident list.
export const RATINGS = {
  green: { label: "Correct", color: "#22c55e" },
  amber: { label: "Questionable", color: "#f59e0b" },
  red: { label: "Controversial", color: "#ef4444" },
};
