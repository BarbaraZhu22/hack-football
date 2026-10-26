import {
  agentUnavailableResponse,
  agentBase,
  fetchAgentMatch,
  passthroughAgentResponse,
} from "@/lib/agent-match-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const query = request.nextUrl.search;
  try {
    const response = await fetchAgentMatch(`/api/match/precedents${query}`);
    const body = await response.text();
    return passthroughAgentResponse(response, body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Match agent unavailable.";
    return agentUnavailableResponse(`Match agent unavailable at ${agentBase()}: ${detail}`);
  }
}
