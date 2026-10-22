const agentBase = () => process.env.AGENT_URL || "http://127.0.0.1:8088";

export async function GET() {
  try {
    const response = await fetch(`${agentBase()}/api/match`, {
      cache: "no-store",
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Agent service unreachable";
    return Response.json({ ok: false, detail }, { status: 502 });
  }
}
