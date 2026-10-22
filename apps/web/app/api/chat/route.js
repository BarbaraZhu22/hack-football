const agentBase = () => process.env.AGENT_URL || "http://127.0.0.1:8088";

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const response = await fetch(`${agentBase()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Agent service unreachable";
    return Response.json({ error: detail }, { status: 502 });
  }
}
