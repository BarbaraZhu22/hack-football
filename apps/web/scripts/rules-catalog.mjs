/**
 * Full rule catalog for Premier League match desk data.
 *
 * Premier League matches are played under IFAB Laws of the Game 2026/27 plus
 * Premier League 2026/27 competition guidance. Each row is one citable `ref`.
 *
 * Bodies use short summaries (not the full LOTG text). Official wording:
 * https://downloads.theifab.com/downloads/laws-of-the-game-202627-single-pages?l=en
 * https://www.premierleague.com/en/news/4674118/premier-league-sets-football-principles-for-202627-season
 */

const EDITION = "IFAB 2026/27";
const PL_EDITION = "Premier League 2026/27";

/** @typedef {{ ref: string, parent_ref: string, issuer: string, category: string, title: string, body: string, url: string, edition: string, tone: string, incident_types: string[] }} RuleRow */

/** @param {Partial<RuleRow> & Pick<RuleRow, "ref" | "title" | "body" | "category">} row */
function rule(row) {
  return {
    parent_ref: "",
    issuer: "ifab",
    url: "https://www.theifab.com/laws/latest/",
    edition: EDITION,
    tone: "support",
    incident_types: [],
    ...row,
  };
}

const IFAB_202627_SOURCE = "https://downloads.theifab.com/downloads/laws-of-the-game-202627-single-pages?l=en";
const LAW_URL = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [index + 1, IFAB_202627_SOURCE]));

const LAW_META = [
  [1, "The Field of Play", "field"],
  [2, "The Ball", "ball"],
  [3, "The Players", "players"],
  [4, "The Players' Equipment", "equipment"],
  [5, "The Referee", "referee"],
  [6, "The Other Match Officials", "officials"],
  [7, "The Duration of the Match", "duration"],
  [8, "The Start and Restart of Play", "restart"],
  [9, "The Ball In and Out of Play", "ball"],
  [10, "Determining the Outcome of a Match", "score"],
  [11, "Offside", "offside"],
  [12, "Fouls and Misconduct", "foul"],
  [13, "Free Kicks", "free_kick"],
  [14, "The Penalty Kick", "penalty"],
  [15, "The Throw-in", "restart"],
  [16, "The Goal Kick", "restart"],
  [17, "The Corner Kick", "restart"],
];

/** [sectionNo, title, summary] per Law (IFAB 2026/27 structure) */
const LAW_SECTIONS = {
  1: [
    [1, "Field surface", "Natural, artificial or permitted hybrid surface; artificial turf must be green and meet applicable quality standards."],
    [2, "Field markings", "Rectangular field, boundary and halfway lines, centre mark and circle; unauthorised marks can be cautioned."],
    [3, "Dimensions", "Competition sets field dimensions within the Law's permitted length and width ranges."],
    [4, "Dimensions for international matches", "International matches use the narrower dimensions specified by the Law."],
    [5, "The goal area", "Defines the goal area from lines measured 5.5 m from each goalpost and parallel to the goal line."],
    [6, "The penalty area", "Defines the penalty area and places the penalty mark 11 m from the goal line midpoint."],
    [7, "The corner area", "A quarter-circle arc at each corner flag defines where corner kicks are taken."],
    [8, "Flagposts", "Corner flagposts are required, at least 1.5 m high and with a non-pointed top."],
    [9, "The technical area", "Defines the permitted bench and team-official area and its conduct requirements."],
    [10, "Goals", "Goals must meet the required dimensions, be safely secured and use approved posts and crossbar."],
    [11, "Goal Line Technology (GLT)", "Approved GLT may assist with goal decisions and must meet IFAB requirements."],
    [12, "Commercial advertising", "Restricts advertising on the field, goal nets, technical areas and related equipment."],
    [13, "Logos and emblems", "Restricts team, competition and manufacturer logos on the field and goal equipment."],
    [14, "Video assistant referees (VARs)", "Sets field-of-play requirements for the video operation room and referee review area where VAR is used."],
  ],
  2: [
    [1, "Qualities and measurements", "The ball must be spherical and meet the Law's material, circumference, weight and pressure requirements."],
    [2, "Replacement of a defective ball", "Stop play to replace a defective ball; restart with a dropped ball if it became defective during play."],
    [3, "Additional balls", "Additional balls may be placed around the field if they meet the same requirements and are controlled by the referee."],
  ],
  3: [
    [1, "Number of players", "Each team may field up to eleven players, including a goalkeeper; a match normally cannot continue below seven, subject to protocol exceptions and competition forfeiture rules."],
    [2, "Number of substitutions", "Competition rules set substitutions; senior A international friendlies allow eight, or up to eleven by prior agreement, with three substitution opportunities."],
    [3, "Substitution procedure", "The outgoing player must leave within ten seconds of the signal; if late, the substitute waits until the first stoppage after one minute of running time following the restart."],
    [4, "Changing the goalkeeper", "Any player may change places with the goalkeeper."],
    [5, "Offences and sanctions", "A late outgoing player must still leave; the substitution cannot be cancelled, and a caution applies only for excessive delay beyond the time limit."],
    [6, "Players and substitutes sent off", "A player sent off before or after kick-off cannot take part; the Law sets how the team may replace or not replace them."],
    [7, "Extra persons on the field of play", "Sets how referees deal with team officials, substitutes, sent-off players and other extra persons on the field."],
    [8, "Player outside the field of play", "Covers temporary exits, re-entry permission and a goalkeeper leaving the field during play."],
    [9, "Goal scored with an extra person on the field of play", "The referee applies the Law's goal-validity and restart tests when an extra person is on the field."],
    [10, "Team captain", "The captain has no special status under the Laws but is responsible for team behaviour and may be addressed by the referee."],
  ],
  4: [
    [1, "Safety", "Equipment must not be dangerous; non-dangerous accessories are permitted only when safely and securely covered."],
    [2, "Compulsory equipment", "Shirt with sleeves, shorts, socks, shinguards and footwear are required."],
    [3, "Colours", "Each team's colours must distinguish players from opponents and match officials; goalkeeper colours have additional requirements."],
    [4, "Other equipment", "Protective and performance equipment is allowed if safe; accessories must be non-dangerous and securely covered."],
    [5, "Slogans, statements, images and advertising", "Sets limits on messages, images and advertising on player equipment."],
    [6, "Offences and sanctions", "Officials inspect equipment; players must correct dangerous or unauthorised items before entering or continuing."],
  ],
  5: [
    [1, "The authority of the referee", "The referee has full authority to enforce the Laws from arrival for the pre-match inspection until leaving the field after the match."],
    [2, "Decisions of the referee", "The referee decides facts connected with play; competitions may authorise technology for VAR, goal-line and offside decisions."],
    [3, "Powers and duties", "Includes discipline, advantage, managing injuries and stoppages; advantage may apply after an incorrect restart if opponents benefit."],
    [4, "Video assistant referee (VAR)", "VAR may review the Law's reviewable incidents, including a clearly incorrect second caution leading to a red card; optional corner review is not adopted by the Premier League for 2026/27."],
    [5, "Referee's equipment", "Referees may use approved communication and technology; competitions may provide controlled body cameras, and safe covered accessories are allowed."],
    [6, "Referee signals", "Prescribes the referee's signals for restarts, disciplinary action, advantage and VAR-related decisions."],
    [7, "Liability of match officials", "Match officials are not liable for specified injury, property or other loss arising from decisions made under the Laws."],
  ],
  6: [
    [1, "Assistant referees", "Assist with ball-out, offside, substitutions and other incidents within their view."],
    [2, "Fourth official", "Supports substitutions, technical-area management, added time and other referee duties."],
    [3, "Additional assistant referees", "Provide additional goal-line and penalty-area assistance where appointed."],
    [4, "Reserve assistant referee", "May replace an assistant referee who cannot continue."],
    [5, "Video match officials", "VAR and AVAR roles follow the VAR protocol, including the 2026/27 reviewable-incident changes."],
    [6, "Assistant referee signals", "Prescribes flag signals for throw-ins, goal kicks, corners, offside and substitutions."],
    [7, "Additional assistant referee signals", "Prescribes signals used by additional assistant referees."],
  ],
  7: [
    [1, "Periods of play", "Two equal halves; duration set by competition."],
    [2, "Half-time interval", "Must not exceed 15 minutes unless competition rules."],
    [3, "Allowance for time lost", "Added time for substitutions, injuries, VAR, etc."],
    [4, "Penalty kick", "A penalty kick is completed even if time expires before it is taken."],
    [5, "Abandoned match", "An abandoned match is replayed unless competition rules or organisers decide otherwise; a team responsible for dropping below seven may forfeit."],
  ],
  8: [
    [1, "Kick-off", "Start of each half and after goals; ball in play when kicked."],
    [2, "Dropped ball", "Drop for the team that would retain or gain possession, including the team entitled to the next restart; after contact with an official or outside agent, drop where the contact occurred."],
  ],
  9: [
    [1, "Ball out of play", "The whole ball must cross a goal line or touchline, or play must be stopped by the referee."],
    [2, "Ball in play", "The ball remains in play at all other times, including rebounds from goalposts, crossbar and match officials unless the Law says otherwise."],
  ],
  10: [
    [1, "Goal scored", "Whole ball over the goal line between posts and under crossbar."],
    [2, "Winning team", "Team scoring more goals wins."],
    [3, "Penalties (penalty shoot-out)", "Sets the procedure for kicks from the penalty mark, including the 2026/27 accidental double-touch clarification."],
  ],
  11: [
    [1, "Offside position", "Nearer opponents' goal line than ball and second-last opponent."],
    [2, "Offside offence", "Involvement in active play from an offside position."],
    [3, "No offence", "Level with second-last opponent; in own half; from goal kick, throw-in, corner."],
    [4, "Offences and sanctions", "An offside offence gives an indirect free kick; interference and deliberate play are assessed under the Law."],
  ],
  12: [
    [1, "Direct free kick", "Careless, reckless or excessive force; handball; holding; etc."],
    [2, "Indirect free kick", "Dangerous play, impeding, dissent, goalkeeper offences."],
    [3, "Corner kick", "A corner may be awarded when the goalkeeper holds the ball for more than eight seconds or a team delays its goal kick."],
    [4, "Disciplinary action", "Covers cautions, send-offs and DOGSO; DOGSO assessment includes attackers, and no sanction follows if advantage leads to a goal. Optional send-offs for covered-mouth abuse or protest walk-offs are not adopted by the Premier League for 2026/27."],
    [5, "Restart of play after fouls and misconduct", "Sets the restart after an offence, including direct or indirect free kicks, penalties, corners and dropped balls."],
  ],
  13: [
    [1, "Types of free kick", "Direct and indirect free kicks."],
    [2, "Procedure", "The ball is stationary, opponents keep the required distance, and the ball is in play when kicked and clearly moves."],
    [3, "Offences and sanctions", "Covers encroachment, second touches and other infringements of free-kick procedure."],
  ],
  14: [
    [1, "Introduction", "A penalty kick is awarded for a direct-free-kick offence by a player inside their own penalty area."],
    [2, "Procedure", "The ball is placed on the mark; the goalkeeper and other players must meet the Law's position and timing requirements."],
    [3, "Offences and sanctions", "Covers encroachment, feinting, goalkeeper offences and accidental double touches; an accidental double touch results in a retake if scored or an indirect free kick if missed."],
    [4, "Summary table", "Summarises the restart and outcome for penalty-kick infringements by the kicker, goalkeeper and other players."],
  ],
  15: [
    [1, "Introduction", "A throw-in restarts play when the whole ball crosses the touchline; a five-second countdown can transfer a delayed throw-in to opponents."],
    [2, "Procedure", "The thrower faces the field, uses both hands and delivers the ball from behind and over the head while observing foot placement."],
    [3, "Offences and sanctions", "For deliberate delay, the referee starts a visual five-second countdown; if no throw is taken, the opponents receive it."],
  ],
  16: [
    [1, "Introduction", "A goal kick restarts play after an attacking touch sends the whole ball over the goal line without a goal."],
    [2, "Procedure", "The kick is taken from the goal area; opponents remain outside the penalty area until the ball is in play."],
    [3, "Offences and sanctions", "A visual five-second countdown applies to deliberate delay; if the kick is not taken, opponents receive a corner."],
  ],
  17: [
    [1, "Introduction", "A corner follows a defender's last touch over the goal line; it may also follow a goalkeeper holding the ball over eight seconds or a delayed goal kick."],
    [2, "Procedure", "The ball is placed in the corner area; opponents stay at least 9.15 m away until it is in play."],
    [3, "Offences and sanctions", "Covers encroachment, a second touch and other infringements of corner-kick procedure."],
  ],
};

/** @type {RuleRow[]} */
const rows = [];

for (const [n, title, category] of LAW_META) {
  const parentRef = `Law ${n}`;
  rows.push(
    rule({
      ref: parentRef,
      title,
      body: `IFAB Laws of the Game 2026/27 — Law ${n}, ${title}. Applies in Premier League matches alongside 2026/27 competition guidance.`,
      category,
      url: LAW_URL[n],
      tone: n === 11 || n === 12 || n === 14 ? "core" : "support",
      incident_types:
        n === 11 ? ["offside"] : n === 12 ? ["tackle", "handball", "conflict"] : n === 14 ? ["handball"] : [],
    }),
  );

  const sections = LAW_SECTIONS[n] ?? [];
  for (const [sec, secTitle, summary] of sections) {
    rows.push(
      rule({
        ref: `${parentRef} · ${sec}`,
        parent_ref: parentRef,
        title: `${title} — ${secTitle}`,
        body: summary,
        category,
        url: LAW_URL[n],
        tone: "support",
      }),
    );
  }
}

// Indexed Law 12 clauses and descriptive topics used by incident retrieval.
rows.push(
  rule({
    ref: "Law 12.1",
    parent_ref: "Law 12",
    title: "Direct free kick — careless, reckless or excessive force",
    body: "A direct free kick is awarded if a player commits a physical offence against an opponent in a careless or reckless manner, or uses excessive force or brutality.",
    category: "foul",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["tackle", "handball"],
  }),
  rule({
    ref: "Law 12.2",
    parent_ref: "Law 12",
    title: "Indirect free kick",
    body: "An indirect free kick is awarded for offences such as dangerous play, impeding without contact and specified goalkeeper offences.",
    category: "foul",
    url: LAW_URL[12],
    tone: "support",
    incident_types: [],
  }),
  rule({
    ref: "Law 12.3",
    parent_ref: "Law 12",
    title: "Corner kick as a sanction",
    body: "A corner may be awarded when the goalkeeper controls the ball with the hands/arms for more than eight seconds or a team delays its goal kick.",
    category: "restart",
    url: LAW_URL[12],
    tone: "support",
    incident_types: [],
  }),
  rule({
    ref: "Law 12.4",
    parent_ref: "Law 12",
    title: "Disciplinary action",
    body: "Cautions and send-offs cover unsporting behaviour, serious foul play, violent conduct and DOGSO; DOGSO assessment includes attackers, and advantage leading to a goal carries no sanction.",
    category: "discipline",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["tackle", "conflict"],
  }),
  rule({
    ref: "Law 12 · serious foul play",
    parent_ref: "Law 12 · 4",
    title: "Serious foul play",
    body: "A tackle or challenge that endangers an opponent's safety or uses excessive force/brutality is serious foul play and requires a sending-off.",
    category: "serious_foul",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["tackle"],
  }),
  rule({
    ref: "Law 12 · handball",
    parent_ref: "Law 12",
    title: "Handling the ball",
    body: "Deliberate hand/arm contact, unnaturally enlarged body, or scoring/handling offences; upper arm boundary at armpit.",
    category: "handball",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["handball"],
  }),
  rule({
    ref: "Law 12 · DOGSO",
    parent_ref: "Law 12 · 4",
    title: "Denying an obvious goal-scoring opportunity",
    body: "Consider distance to goal, direction, likelihood of control and the location and number of defenders and attackers; if advantage results in a goal, there is no sanction.",
    category: "discipline",
    url: LAW_URL[12],
    tone: "support",
    incident_types: ["tackle"],
  }),
  rule({
    ref: "Law 12 · violent conduct",
    parent_ref: "Law 12 · 4",
    title: "Violent conduct",
    body: "Using or attempting excessive force or brutality when not challenging for the ball.",
    category: "misconduct",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["conflict"],
  }),
);

const VAR_URL = IFAB_202627_SOURCE;

const VAR_SECTIONS = [
  [
    "VAR Protocol · Principles",
    "",
    "ifab_var",
    "var",
    "VAR protocol 2026/27",
    "VAR may assist only for clear and obvious errors or serious missed incidents in reviewable categories; the referee makes the final decision.",
    "support",
    [],
  ],
  [
    "VAR Protocol §1",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Principles",
    "VAR remains a match-official support tool; the referee makes an initial decision and retains final authority.",
    "support",
    [],
  ],
  [
    "VAR Protocol §2",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Reviewable decisions",
    "Goal/no goal, penalty/no penalty, red cards including a clearly incorrect second caution, and mistaken identity; incorrect corners are an optional review category.",
    "core",
    ["tackle", "handball", "offside"],
  ],
  [
    "VAR Protocol §3",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Review threshold",
    "Intervention requires a clear and obvious error or serious missed incident; the optional corner review must be corrected immediately without delaying the restart.",
    "support",
    ["tackle"],
  ],
  [
    "VAR Protocol §4",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Procedures",
    "Check, review, on-field review (OFR), VAR-only review, communication to players.",
    "support",
    [],
  ],
  [
    "VAR Protocol · offside",
    "VAR Protocol §2",
    "ifab_var",
    "var",
    "Goal/no goal — offside",
    "Offside in the build-up or at goal may be reviewed; factual line decisions use VAR-only review where appropriate.",
    "support",
    ["offside"],
  ],
  [
    "VAR Protocol · penalty",
    "VAR Protocol §2",
    "ifab_var",
    "var",
    "Penalty / no penalty",
    "Location of offence, handball or foul in the box, and incorrect award or missed penalty.",
    "support",
    ["handball"],
  ],
  [
    "VAR Protocol · mistaken identity",
    "VAR Protocol §2",
    "ifab_var",
    "var",
    "Mistaken identity",
    "VAR may correct a caution or sending-off shown to the wrong player when another player of either team committed the offence.",
    "support",
    [],
  ],
  [
    "VAR Protocol · second caution",
    "VAR Protocol §2",
    "ifab_var",
    "var",
    "Clearly incorrect second caution",
    "A red card resulting from a clearly incorrect second caution is reviewable; a potential second caution is not a separate review category.",
    "support",
    ["tackle", "conflict"],
  ],
  [
    "VAR Protocol · corner kick",
    "VAR Protocol §2",
    "ifab_var",
    "var",
    "Incorrectly awarded corner kick",
    "IFAB permits competitions to review a clearly incorrect corner only when the decision can be corrected immediately without delaying the restart; the Premier League does not adopt this option for 2026/27.",
    "support",
    [],
  ],
];

for (const [ref, parent, issuer, category, title, body, tone, incident_types] of VAR_SECTIONS) {
  rows.push({
    ref,
    parent_ref: parent,
    issuer,
    category,
    title,
    body,
    url: VAR_URL,
    edition: EDITION,
    tone,
    incident_types,
  });
}

const PL_GUIDANCE = "https://www.premierleague.com/en/news/4674118/premier-league-sets-football-principles-for-202627-season";
const PL_VAR = "https://www.premierleague.com/en/news/4688755";

const PL_RULES = [
  [
    "PL · Application of LOTG",
    "",
    "pl",
    "competition",
    "Premier League — Laws of the Game",
    "Premier League matches follow the IFAB Laws of the Game 2026/27 and the Premier League Handbook 2026/27, including the League's competition choices and refereeing guidance.",
    "pl",
    "https://www.premierleague.com/en/media/publications",
    [],
  ],
  [
    "PL · Football Principles",
    "",
    "pl",
    "competition",
    "Premier League Football Principles — 2026/27",
    "Maintain a high threshold for on-field challenges and VAR while protecting player safety; improve SAOT/VAR efficiency, participant behaviour and measures against time-wasting.",
    "pl",
    PL_GUIDANCE,
    ["tackle", "handball", "offside", "conflict"],
  ],
  [
    "PL · Challenge threshold",
    "PL · Football Principles",
    "pl",
    "foul",
    "High threshold for penalising challenges",
    "Not every contact is a foul; maintain the high threshold while protecting player safety.",
    "support",
    PL_GUIDANCE,
    ["tackle"],
  ],
  [
    "PL · VAR threshold",
    "PL · Football Principles",
    "pl",
    "var",
    "High threshold for VAR intervention",
    "The referee's call stands unless evidence readily available to VAR shows a clear and obvious error; improve efficiency and reduce delays.",
    "support",
    PL_GUIDANCE,
    ["tackle", "handball", "offside"],
  ],
  [
    "PL · Refereeing emphasis",
    "",
    "pl",
    "competition",
    "Refereeing Points of Emphasis — 2026/27",
    "The Premier League's seasonal guidance focuses on holding, challenges affecting goalkeepers, hair-pulling sanctions, handball, and simulation/embellishment.",
    "pl",
    PL_GUIDANCE,
    ["tackle", "handball", "conflict"],
  ],
  [
    "PL · Holding",
    "PL · Refereeing emphasis",
    "pl",
    "foul",
    "Material holding actions",
    "Penalise clear, sustained or impactful holding, especially when a defender focuses on the opponent rather than playing or challenging for the ball.",
    "support",
    PL_GUIDANCE,
    ["tackle"],
  ],
  [
    "PL · Goalkeeper challenges",
    "PL · Refereeing emphasis",
    "pl",
    "foul",
    "Challenges affecting goalkeepers",
    "Penalise a clear attacking action with no intent to play or challenge for the ball when contact unfairly affects the goalkeeper's ability to play or challenge for it.",
    "support",
    PL_GUIDANCE,
    ["tackle"],
  ],
  [
    "PL · Hair pulling",
    "PL · Refereeing emphasis",
    "pl",
    "discipline",
    "Hair-pulling sanctions",
    "A clear, deliberate hair pull with excessive force or brutality is a red card; without excessive force or brutality it is a yellow card.",
    "support",
    PL_GUIDANCE,
    ["conflict"],
  ],
  [
    "PL · Handball emphasis",
    "PL · Refereeing emphasis",
    "pl",
    "handball",
    "Proportionate handball decisions",
    "Continue the Premier League's 'less is more' approach to penalising handball.",
    "support",
    PL_GUIDANCE,
    ["handball"],
  ],
  [
    "PL · Simulation",
    "PL · Refereeing emphasis",
    "pl",
    "misconduct",
    "Simulation and embellishment",
    "Continue to address clear actions intended to deceive the referee, including simulation and embellishment.",
    "support",
    PL_GUIDANCE,
    ["conflict"],
  ],
  [
    "PL · Restart and substitution timing",
    "",
    "pl",
    "competition",
    "Match-flow requirements — 2026/27",
    "The Premier League implements one-minute post-treatment exits, a ten-second substitution exit limit and five-second throw-in/goal-kick countdowns.",
    "pl",
    PL_GUIDANCE,
    [],
  ],
  [
    "PL · Injury treatment",
    "PL · Restart and substitution timing",
    "pl",
    "players",
    "One-minute return delay after treatment",
    "Players treated or assessed on the field, or whose injury stops play, must leave for at least one minute after play restarts, subject to the Law's exceptions.",
    "support",
    PL_GUIDANCE,
    [],
  ],
  [
    "PL · Substitutions",
    "PL · Restart and substitution timing",
    "pl",
    "players",
    "Ten-second substitution exit limit",
    "The outgoing player must leave within ten seconds; if not, the substitute waits until the first stoppage after one minute of running time following the restart.",
    "support",
    PL_GUIDANCE,
    [],
  ],
  [
    "PL · Throw-in countdown",
    "PL · Restart and substitution timing",
    "pl",
    "restart",
    "Five-second throw-in countdown",
    "For a clearly delayed throw-in, the referee starts a visible five-second countdown; if it expires, the throw-in is awarded to the opponents.",
    "support",
    PL_GUIDANCE,
    [],
  ],
  [
    "PL · Goal-kick countdown",
    "PL · Restart and substitution timing",
    "pl",
    "restart",
    "Five-second goal-kick countdown",
    "For a clearly delayed goal kick, the referee starts a visible five-second countdown; if it expires, the opponents receive a corner kick.",
    "support",
    PL_GUIDANCE,
    [],
  ],
  [
    "PL VAR",
    "",
    "pl",
    "var",
    "Premier League — VAR in 2026/27",
    "Applies IFAB VAR rules with the Premier League's high intervention threshold; the League adopts second-yellow-to-red reviews but not the optional review of incorrectly awarded corners.",
    "pl",
    PL_GUIDANCE,
    ["tackle"],
  ],
  [
    "PL VAR · Red cards",
    "PL VAR",
    "pl",
    "var",
    "Second yellow resulting in a red card",
    "A VAR review applies when a clearly incorrect second yellow results in a red card; a potential second yellow is not reviewed as a separate incident.",
    "pl",
    PL_VAR,
    ["tackle"],
  ],
  [
    "PL VAR · Offside",
    "PL VAR",
    "pl",
    "var",
    "Offside and semi-automated offside",
    "Use semi-automated offside technology to improve efficiency and reduce delays while retaining the clear-and-obvious VAR threshold.",
    "pl",
    PL_VAR,
    ["offside"],
  ],
  [
    "PL · Technical area",
    "",
    "pl",
    "misconduct",
    "Technical area conduct",
    "Behaviour of coaches and staff; sanctions aligned with Law 12 team official offences.",
    "support",
    PL_GUIDANCE,
    ["conflict"],
  ],
];

for (const [ref, parent, issuer, category, title, body, tone, url, incident_types] of PL_RULES) {
  rows.push({
    ref,
    parent_ref: parent,
    issuer,
    category,
    title,
    body,
    url,
    edition: PL_EDITION,
    tone,
    incident_types,
  });
}

/** @type {Map<string, RuleRow>} */
const byRef = new Map();
for (const row of rows) {
  if (!byRef.has(row.ref)) byRef.set(row.ref, row);
}

export const RULES = [...byRef.values()].sort((a, b) => {
  const order = (r) => {
    if (r.ref.startsWith("Law ")) {
      const m = r.ref.match(/^Law (\d+)/);
      return m ? Number(m[1]) * 1000 : 5000;
    }
    if (r.ref.startsWith("VAR")) return 20000;
    if (r.ref.startsWith("PL")) return 30000;
    return 40000;
  };
  const d = order(a) - order(b);
  return d !== 0 ? d : a.ref.localeCompare(b.ref);
});
