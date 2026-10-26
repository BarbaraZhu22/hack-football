/**
 * Full rule catalog for Premier League match desk data.
 *
 * Premier League matches are played under IFAB Laws of the Game 2024/25 plus
 * competition and PGMOL/PL VAR guidance. Each row is one citable `ref`.
 *
 * Bodies use short summaries (not the full LOTG text). Official wording:
 * https://www.theifab.com/laws/latest/
 * https://www.premierleague.com/en/var
 */

const EDITION = "IFAB 2025/26";
const PL_EDITION = "Premier League 2024/25";

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

const LAW_URL = {
  1: "https://www.theifab.com/laws/latest/the-field-of-play/",
  2: "https://www.theifab.com/laws/latest/the-ball/",
  3: "https://www.theifab.com/laws/latest/the-players/",
  4: "https://www.theifab.com/laws/latest/the-players-equipment/",
  5: "https://www.theifab.com/laws/latest/the-referee/",
  6: "https://www.theifab.com/laws/latest/the-other-match-officials/",
  7: "https://www.theifab.com/laws/latest/the-duration-of-the-match/",
  8: "https://www.theifab.com/laws/latest/the-start-and-restart-of-play/",
  9: "https://www.theifab.com/laws/latest/the-ball-in-and-out-of-play/",
  10: "https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/",
  11: "https://www.theifab.com/laws/latest/offside/",
  12: "https://www.theifab.com/laws/latest/fouls-and-misconduct/",
  13: "https://www.theifab.com/laws/latest/free-kicks/",
  14: "https://www.theifab.com/laws/latest/the-penalty-kick/",
  15: "https://www.theifab.com/laws/latest/the-throw-in/",
  16: "https://www.theifab.com/laws/latest/the-goal-kick/",
  17: "https://www.theifab.com/laws/latest/the-corner-kick/",
};

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

/** [sectionNo, title, summary] per Law (IFAB 2024/25 structure) */
const LAW_SECTIONS = {
  1: [
    [1, "Field surface", "Natural, artificial or hybrid surface; colour and FIFA Quality Programme where required."],
    [2, "Field markings", "Rectangular field, touchlines, goal lines, halfway line, centre mark and circle."],
    [3, "The technical area", "Designated area for team officials; behaviour and limits."],
    [4, "The goal area", "Goal area dimensions and use."],
    [5, "The penalty area", "Penalty area dimensions and use."],
    [6, "The penalty mark", "Penalty mark location."],
    [7, "The penalty arc", "Arc outside the penalty area."],
    [8, "The corner area", "Corner arc."],
    [9, "The goals", "Goal size, safety and nets."],
    [10, "Commercial advertising", "Restrictions on advertising on the field and goals."],
    [11, "Goal-line technology", "GLT for goal decisions when approved."],
    [12, "Commercial equipment", "Approved equipment on the field."],
    [13, "Goal-line technology signal", "Communication of GLT decisions to match officials."],
    [14, "Video assistant referees (VARs)", "VOR and RRA requirements where VAR is used."],
  ],
  2: [
    [1, "Qualities and measurements", "Spherical, leather or approved material, size 5, pressure."],
    [2, "Replacement of a defective ball", "Play stopped; restart with dropped ball if in play."],
    [3, "Additional balls", "Additional balls at the goal lines under competition rules."],
    [4, "Ball used in VAR matches", "Same requirements; may include tracking where approved."],
  ],
  3: [
    [1, "Number of players", "Maximum eleven per team; one must be goalkeeper."],
    [2, "Number of substitutes", "Competition rules determine bench size and use."],
    [3, "Substitution procedure", "Named players, referee permission, at stoppages."],
    [4, "Changing the goalkeeper", "Any player may change places with the goalkeeper."],
    [5, "Named players", "Names and numbers submitted before kick-off."],
    [6, "Sending-off before kick-off", "Player may not participate; report misconduct."],
    [7, "Infringement of substitution procedure", "Caution for entering without permission."],
    [8, "Goal scored with extra person", "Restart if extra player on field."],
    [9, "Player outside the field", "Goalkeeper and tactical off-field rules."],
    [10, "Team captain", "Captain identified with armband; duties with referee."],
    [11, "Concussion substitutions", "Additional permanent concussion subs where competition permits."],
    [12, "Return substitutes", "Guidelines where competition allows return to bench."],
  ],
  4: [
    [1, "Compulsory equipment", "Shirt, shorts, socks, shinguards, footwear."],
    [2, "Colours", "Distinct from opponents and match officials."],
    [3, "Other equipment", "Non-dangerous additional items; goalkeeper tracksuit bottoms."],
    [4, "Colours and designs", "Slogans, logos and permitted markings."],
    [5, "Equipment inspection", "Referee inspects before the match."],
    [6, "Offences", "Unauthorised equipment or messages."],
  ],
  5: [
    [1, "Powers and duties", "Enforce the Laws; disciplinary action; report."],
    [2, "Decisions", "Final on facts of play; may not change after restart in most cases."],
    [3, "Powers regarding offences", "Stop, suspend or abandon for outside interference."],
    [4, "Advantage", "Allow play to continue when benefit exists; caution later if needed."],
    [5, "Injury", "Stop for serious injury; allow treatment; restart dropped ball if contested."],
    [6, "Outside agents", "Ball boys, spectators, objects on the field."],
    [7, "Video assistant referee", "Referee may use VAR information per protocol."],
  ],
  6: [
    [1, "Assistant referees", "Offside, ball out of play, assist on other decisions."],
    [2, "Fourth official", "Administrative duties, substitutions, added time signal."],
    [3, "Additional assistant referees", "Goal-line and penalty area support where used."],
    [4, "Assistant referee signals", "Flag signals for offside, fouls, substitutions."],
    [5, "Fourth official duties", "Technical area, benches, communication."],
    [6, "Reserve assistant referee", "Replace assistant if unable to continue."],
    [7, "Video match officials", "VAR and AVAR roles per protocol."],
    [8, "Communication", "Headsets and procedures between officials."],
    [9, "Minimum number of officials", "Competition determines full list."],
  ],
  7: [
    [1, "Periods of play", "Two equal halves; duration set by competition."],
    [2, "Half-time interval", "Must not exceed 15 minutes unless competition rules."],
    [3, "Allowance for time lost", "Added time for substitutions, injuries, VAR, etc."],
    [4, "Penalty kick at end of period", "PK taken even if time expires before kick."],
    [5, "Abandoned match", "Competition rules decide outcome."],
  ],
  8: [
    [1, "Kick-off", "Start of each half and after goals; ball in play when kicked."],
    [2, "Dropped ball", "Restart when play stopped and no other restart applies."],
    [3, "Offences and sanctions", "Incorrect procedure on restarts."],
  ],
  9: [
    [1, "Ball out of play", "Whole ball over the line; on ground or in air."],
    [2, "Ball in play", "From kick-off, restarts, and when it rebounds from posts, crossbar, officials."],
  ],
  10: [
    [1, "Goal scored", "Whole ball over the goal line between posts and under crossbar."],
    [2, "Winning team", "Team scoring more goals wins."],
    [3, "Penalty shoot-out", "Procedure when competition requires a winner."],
    [4, "Abandoned match", "Competition rules for result."],
  ],
  11: [
    [1, "Offside position", "Nearer opponents' goal line than ball and second-last opponent."],
    [2, "Offside offence", "Involvement in active play from an offside position."],
    [3, "No offence", "Level with second-last opponent; in own half; from goal kick, throw-in, corner."],
  ],
  12: [
    [1, "Direct free kick", "Careless, reckless or excessive force; handball; holding; etc."],
    [2, "Indirect free kick", "Dangerous play, impeding, dissent, goalkeeper offences."],
    [3, "Disciplinary action", "Cautions, send-offs, advantage and DOGSO."],
    [4, "Restart after fouls", "Free kicks, penalty kicks, dropped ball as appropriate."],
  ],
  13: [
    [1, "Types of free kick", "Direct and indirect free kicks."],
    [2, "Direct free kick procedure", "Ball stationary; opponents 9.15 m away."],
    [3, "Indirect free kick procedure", "Second touch before goal; signal by referee."],
    [4, "Free kick offences", "Encroachment, delay, failure to respect distance."],
  ],
  14: [
    [1, "Penalty kick", "Awarded for DFK offences inside the penalty area."],
    [2, "Procedure", "Mark, goalkeeper on line, other players outside area and arc."],
    [3, "Offences and sanctions", "Encroachment, feinting, goalkeeper movement."],
    [4, "Kicks from the penalty mark", "Shoot-out procedure."],
  ],
  15: [
    [1, "Procedure", "Both feet on or behind the line; from point where ball left field."],
    [2, "Offences and sanctions", "Foul throw; incorrect position."],
  ],
  16: [
    [1, "Procedure", "From anywhere inside goal area; opponents outside penalty area."],
    [2, "Offences and sanctions", "Ball not in play; encroachment."],
  ],
  17: [
    [1, "Procedure", "Attacker takes from corner arc; opponents 9.15 m away."],
    [2, "Offences and sanctions", "Encroachment; incorrectly taken corner."],
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
      body: `IFAB Law ${n} — ${title}. Governs play in Premier League matches.`,
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

// Product aliases (Pitch / precedents) mapped to IFAB Law 12
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
    title: "Serious foul play",
    body: "A tackle or challenge that endangers the safety of an opponent, or uses excessive force or brutality, is sanctioned as serious foul play.",
    category: "serious_foul",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["tackle"],
  }),
  rule({
    ref: "Law 12.3",
    parent_ref: "Law 12",
    title: "Disciplinary action",
    body: "Cautions and send-offs for offences including unsporting behaviour, serious foul play, violent conduct and dissent.",
    category: "discipline",
    url: LAW_URL[12],
    tone: "support",
    incident_types: ["tackle", "conflict"],
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
    parent_ref: "Law 12",
    title: "Denying an obvious goal-scoring opportunity",
    body: "Send-off or caution depending on offence type and whether the challenge was an attempt to play the ball.",
    category: "discipline",
    url: LAW_URL[12],
    tone: "support",
    incident_types: ["tackle"],
  }),
  rule({
    ref: "Law 12 · violent conduct",
    parent_ref: "Law 12",
    title: "Violent conduct",
    body: "Using or attempting excessive force or brutality when not challenging for the ball.",
    category: "misconduct",
    url: LAW_URL[12],
    tone: "core",
    incident_types: ["conflict"],
  }),
);

const VAR_URL = "https://www.theifab.com/laws/latest/video-assistant-referee-var-protocol/";

const VAR_SECTIONS = [
  [
    "VAR Protocol · Principles",
    "",
    "ifab_var",
    "var",
    "VAR protocol principles",
    "VAR assists only for clear and obvious errors or serious missed incidents; the referee always decides.",
    "support",
    [],
  ],
  [
    "VAR Protocol §1",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Principles (1–12)",
    "Independent VAR access; referee must make an initial decision; accuracy over speed.",
    "support",
    [],
  ],
  [
    "VAR Protocol §2",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Reviewable decisions",
    "Goal/no goal, penalty/no penalty, direct red card (not second yellow), mistaken identity.",
    "core",
    ["tackle", "handball", "offside"],
  ],
  [
    "VAR Protocol §3",
    "VAR Protocol · Principles",
    "ifab_var",
    "var",
    "Clear and obvious error — red-card review",
    "VAR reviews direct red-card offences including serious foul play; overturn only for clear and obvious error.",
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
    "Correct player cautioned or sent off when the wrong offender was identified.",
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

const PL_VAR = "https://www.premierleague.com/en/var";

const PL_RULES = [
  [
    "PL · Application of LOTG",
    "",
    "pl",
    "competition",
    "Premier League — Laws of the Game",
    "Premier League matches are played under IFAB Laws of the Game and FIFA statutes unless competition rules state otherwise.",
    "pl",
    "https://www.premierleague.com/",
    [],
  ],
  [
    "PL VAR",
    "",
    "pl",
    "var",
    "Premier League — VAR hub",
    "Overview of VAR in the Premier League including reviewable incidents and communication standards.",
    "pl",
    PL_VAR,
    ["tackle"],
  ],
  [
    "PL VAR · Red cards",
    "PL VAR",
    "pl",
    "var",
    "Red-card decisions explained",
    "How the Premier League applies the clear-and-obvious threshold for red-card reviews and on-field reviews.",
    "pl",
    "https://www.premierleague.com/en/var/red-card-decisions-explained",
    ["tackle"],
  ],
  [
    "PL VAR · Penalties",
    "PL VAR",
    "pl",
    "var",
    "Penalty decisions",
    "VAR checks for penalty-area offences, handball and foul leading to penalty awards or misses.",
    "pl",
    `${PL_VAR}/penalty-decisions-explained`,
    ["handball"],
  ],
  [
    "PL VAR · Offside",
    "PL VAR",
    "pl",
    "var",
    "Offside and semi-automated offside",
    "Marginal offside and goal decisions; SAOT technology where deployed in Premier League.",
    "pl",
    `${PL_VAR}/offside-decisions-explained`,
    ["offside"],
  ],
  [
    "PL VAR · Handball",
    "PL VAR",
    "pl",
    "var",
    "Handball and penalty appeals",
    "Premier League application of IFAB handball criteria for penalty decisions.",
    "pl",
    `${PL_VAR}/handball-in-the-penalty-area-explained`,
    ["handball"],
  ],
  [
    "PL · Substitutes",
    "",
    "pl",
    "competition",
    "Substitutions (Premier League)",
    "Bench size, concussion substitutes and substitution windows per Premier League competition rules.",
    "support",
    "https://www.premierleague.com/",
    [],
  ],
  [
    "PL · Added time",
    "",
    "pl",
    "competition",
    "Added time (Premier League)",
    "Additional time announced for stoppages including VAR checks, substitutions and injuries.",
    "support",
    "https://www.premierleague.com/",
    [],
  ],
  [
    "PL · Technical area",
    "",
    "pl",
    "misconduct",
    "Technical area conduct",
    "Behaviour of coaches and staff; sanctions aligned with Law 12 team official offences.",
    "support",
    "https://www.premierleague.com/",
    ["conflict"],
  ],
  [
    "PL · Disciplinary",
    "",
    "pl",
    "discipline",
    "Disciplinary process",
    "FA/PGMOL disciplinary commissions for cards, misconduct and post-match review.",
    "support",
    "https://www.premierleague.com/",
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
