export const dynamic = "force-dynamic";

const agentBase = () => process.env.AGENT_URL || "http://127.0.0.1:8088";

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetch(`${agentBase()}/api/match${query}`, {
      cache: "no-store",
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Agent match API unreachable.";
    return Response.json({ ok: false, detail }, { status: 502 });
  }
}
