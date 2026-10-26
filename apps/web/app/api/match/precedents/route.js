import { loadMockPrecedentsDataset } from "@/lib/mock-match-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Local precedent data unavailable.";
    return Response.json(
      { ok: false, detail },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
