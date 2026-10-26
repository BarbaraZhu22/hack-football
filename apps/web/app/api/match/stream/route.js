import {
  agentUnavailableResponse,
  agentBase,
  fetchAgentMatch,
} from "@/lib/agent-match-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetchAgentMatch(`/api/match/stream${query}`, {
      headers: { Accept: "text/event-stream" },
    });
    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        { ok: false, detail: detail || `Match stream failed (${response.status}).` },
        { status: response.status, headers: { "Cache-Control": "no-store" } },
      );
    }
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
    const detail = error instanceof Error ? error.message : "Match agent unavailable.";
    return agentUnavailableResponse(`Match agent unavailable at ${agentBase()}: ${detail}`);
  }
}
