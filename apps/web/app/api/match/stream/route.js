export const dynamic = "force-dynamic";

const agentBase = () => process.env.AGENT_URL || "http://127.0.0.1:8088";

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetch(`${agentBase()}/api/match/stream${query}`, {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Agent match stream unreachable.";
    return Response.json({ ok: false, detail }, { status: 502 });
  }
}
