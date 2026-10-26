export const agentBase = () => process.env.AGENT_URL || "http://127.0.0.1:8088";

export async function fetchAgentMatch(path, init = {}) {
  return fetch(`${agentBase()}${path}`, { cache: "no-store", ...init });
}

export function passthroughAgentResponse(response, body, extraHeaders = {}) {
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function agentUnavailableResponse(detail, status = 502) {
  return Response.json(
    { ok: false, detail },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
