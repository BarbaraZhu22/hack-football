import { loadMockPrecedentsDataset } from "@/lib/mock-match-api";
import {
  fetchAgentMatch,
  passthroughAgentResponse,
  shouldFallbackToLocal,
} from "@/lib/agent-match-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function localPrecedentsResponse(request) {
  const types = new Set(request.nextUrl.searchParams.getAll("type").filter(Boolean));
  if (!types.size) {
    return Response.json(
      { ok: false, detail: "At least one incident type is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dataset = await loadMockPrecedentsDataset();
  const precedents = dataset
    .filter((precedent) => types.has(precedent.incidentType))
    .sort((left, right) => (right.season || "").localeCompare(left.season || "")
      || (left.fixture || "").localeCompare(right.fixture || ""));

  return Response.json({ precedents }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetchAgentMatch(`/api/match/precedents${query}`);
    if (shouldFallbackToLocal(response)) {
      return localPrecedentsResponse(request);
    }
    const body = await response.text();
    return passthroughAgentResponse(response, body);
  } catch {
    try {
      return await localPrecedentsResponse(request);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Precedent data unavailable.";
      return Response.json(
        { ok: false, detail },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
}
