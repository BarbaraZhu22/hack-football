import {
  createMockSnapshot,
  loadMockMatchDataset,
  parseClock,
} from "@/lib/mock-match-api";
import {
  fetchAgentMatch,
  passthroughAgentResponse,
  shouldFallbackToLocal,
} from "@/lib/agent-match-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function localSnapshotResponse(request) {
  const through = parseClock(request.nextUrl.searchParams.get("through") || undefined);
  const dataset = await loadMockMatchDataset();
  const snapshot = createMockSnapshot(dataset, through);
  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetchAgentMatch(`/api/match${query}`);
    if (shouldFallbackToLocal(response)) {
      return localSnapshotResponse(request);
    }
    const body = await response.text();
    return passthroughAgentResponse(response, body);
  } catch {
    try {
      return await localSnapshotResponse(request);
    } catch (error) {
      const invalidClock = error instanceof Error && error.message.includes("Clock must");
      const detail = error instanceof Error ? error.message : "Match data unavailable.";
      return Response.json(
        { ok: false, detail },
        { status: invalidClock ? 400 : 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
}
