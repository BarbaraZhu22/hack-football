export async function sendChatMessage({ messages, context }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Chat failed (${response.status})`);
  }

  return response.json();
}

export async function fetchAgentHealth() {
  const response = await fetch("/api/health", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Agent health failed (${response.status})`);
  }
  return response.json();
}
