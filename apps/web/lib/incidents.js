// Registry of controversial decisions under review.
// The first entry owns a full 3D reconstruction; the remaining entries are
// placeholders until their scenes are designed and built.
export const INCIDENTS = [
  {
    id: "tackle",
    label: "Tackle Controversy",
    short: "Tackle",
    minute: "78:42",
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
    status: "placeholder",
    incidentId: "MCI-ARS-7829-02",
    summary:
      "Marginal offside call on a disallowed goal. The offside line is derived from a single tracking frame; reconstruction pending.",
  },
  {
    id: "handball",
    label: "Handball Controversy",
    short: "Handball",
    minute: "85:03",
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
    minute: "90+1",
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

// Rating scale shared by the decision timeline and the incident list.
export const RATINGS = {
  green: { label: "Correct", color: "#22c55e" },
  amber: { label: "Questionable", color: "#f59e0b" },
  red: { label: "Controversial", color: "#ef4444" },
};

// Decisions plotted on the overview timeline, in match-minute order.
// Entries that map to a registry incident carry its id: active incidents
// link to the 3D reconstruction, placeholders are marked as pending.
export const MATCH_DECISIONS = [
  {
    id: "d-early-tackle",
    minute: 5,
    label: "Early tackle",
    detail: "No card. Fair but firm challenge near the touchline.",
    rating: "green",
    meta: "Law 12",
  },
  {
    id: "d-corner",
    minute: 8,
    label: "Corner award",
    detail: "Ball clearly over the line off the defender.",
    rating: "green",
    meta: "VAR silent",
  },
  {
    id: "d-penalty-appeal",
    minute: 12,
    label: "Penalty appeal",
    detail: "No penalty. Clean challenge, ball played first.",
    rating: "green",
    meta: "Law 14",
  },
  {
    id: "d-advantage",
    minute: 19,
    label: "Advantage played",
    detail: "Advantage allowed; the move ended in a throw-in.",
    rating: "green",
    meta: "Law 5",
  },
  {
    id: "d-offside-goal",
    minute: 27,
    label: "Offside goal",
    detail: "Goal disallowed. Marginal line from one frame.",
    rating: "amber",
    incidentId: "offside",
    meta: "Law 11",
  },
  {
    id: "d-offside-flag",
    minute: 34,
    label: "Offside flag",
    detail: "Striker 0.4 m beyond the last defender.",
    rating: "green",
    meta: "Law 11",
  },
  {
    id: "d-tactical-foul",
    minute: 41,
    label: "Tactical foul",
    detail: "Yellow for stopping a counter in midfield.",
    rating: "green",
    meta: "Law 12",
  },
  {
    id: "d-foul-check",
    minute: 55,
    label: "Foul check",
    detail: "No foul. Shoulder-to-shoulder, ball first.",
    rating: "green",
    meta: "Law 12",
  },
  {
    id: "d-late-challenge",
    minute: 61,
    label: "Late challenge",
    detail: "Yellow. Above-ankle contact, no VAR check.",
    rating: "amber",
    meta: "VAR not invoked",
  },
  {
    id: "d-goal-line",
    minute: 68,
    label: "Goal-line clearance",
    detail: "Ball not fully over the line. Correct.",
    rating: "green",
    meta: "VAR · 4 cm",
  },
  {
    id: "d-tackle",
    minute: 78,
    label: "Tackle",
    detail: "Studs above the ankle. Controversial - open the 3D review.",
    rating: "red",
    incidentId: "tackle",
    meta: "Law 12.2",
  },
  {
    id: "d-handball-appeal",
    minute: 85,
    label: "Handball appeal",
    detail: "Penalty awarded on review; attempt saved.",
    rating: "amber",
    incidentId: "handball",
    meta: "Law 14 · VAR",
  },
  {
    id: "d-time-wasting",
    minute: 88,
    label: "Time-wasting warning",
    detail: "Warning issued for delaying the restart.",
    rating: "green",
    meta: "Law 12",
  },
  {
    id: "d-conflict",
    minute: 91,
    minuteLabel: "90+1",
    label: "Player conflict",
    detail: "Post-whistle confrontation between both squads.",
    rating: "red",
    incidentId: "conflict",
    meta: "Law 12",
  },
];

// Key match events plotted on the momentum chart: goals, penalties,
// missed penalties, cards and substitutions, coloured by team.
export const MATCH_EVENTS = [
  { minute: 23, type: "goal", team: "home", label: "MCI goal - 1-0" },
  { minute: 27, type: "var", team: "away", label: "ARS goal ruled out (offside)", incidentId: "offside" },
  { minute: 41, type: "yellow", team: "away", label: "ARS yellow card" },
  { minute: 46, type: "goal", team: "away", label: "ARS goal - 1-1" },
  { minute: 61, type: "yellow", team: "home", label: "MCI yellow card" },
  { minute: 70, type: "sub", team: "home", label: "MCI substitution" },
  { minute: 73, type: "penalty-goal", team: "home", label: "MCI penalty goal - 2-1" },
  { minute: 78, type: "red", team: "home", label: "MCI red card (VAR)", incidentId: "tackle" },
  { minute: 85, type: "penalty-missed", team: "away", label: "ARS penalty saved", incidentId: "handball" },
];
