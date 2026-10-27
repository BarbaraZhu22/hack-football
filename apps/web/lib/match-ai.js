export async function requestCommentary({ eventId, facts }) {
  const response = await fetch("/api/commentary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, facts }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || `Commentary failed (${response.status})`);
  }
  return data;
}

export async function requestAdjudication(payload) {
  const response = await fetch("/api/adjudicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || `Adjudication failed (${response.status})`);
  }
  return data;
}

export function commentaryFactsFromEvent(event, match) {
  return {
    clockLabel: event.clockLabel,
    minute: event.minute,
    second: event.second,
    type: event.type,
    team: event.teamCode || event.team,
    player: event.player,
    relatedPlayer: event.relatedPlayer,
    score: event.score || (match?.score ? `${match.score[0]}-${match.score[1]}` : ""),
    decisionLabel: event.decisionLabel,
    decisionDetail: event.decisionDetail,
    note: event.note,
    label: event.label,
  };
}
