import {
  createMockTrackingWindow,
  loadMockTrackingDataset,
  parseClock,
} from "@/lib/mock-match-api";
import {
  fetchAgentMatch,
  passthroughAgentResponse,
  shouldFallbackToLocal,
} from "@/lib/agent-match-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function localTrackingResponse(request) {
  const params = request.nextUrl.searchParams;
  const fromValue = params.get("from");
  const throughValue = params.get("through");
  if (!fromValue || !throughValue) {
    return Response.json(
      { ok: false, detail: "Both from and through clocks are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const from = parseClock(fromValue);
  const through = parseClock(throughValue);
  if (through < from) {
    return Response.json(
      { ok: false, detail: "The through clock must be at or after the from clock." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dataset = await loadMockTrackingDataset();
  return Response.json(createMockTrackingWindow(dataset, from, through), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetchAgentMatch(`/api/match/tracking${query}`);
    if (shouldFallbackToLocal(response)) {
      return localTrackingResponse(request);
    }
    const body = await response.text();
    return passthroughAgentResponse(response, body);
  } catch {
    try {
      return await localTrackingResponse(request);
    } catch (error) {
      const invalidClock = error instanceof Error && error.message.includes("Clock must");
      const detail = error instanceof Error ? error.message : "Match tracking data unavailable.";
      return Response.json(
        { ok: false, detail },
        { status: invalidClock ? 400 : 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
}
