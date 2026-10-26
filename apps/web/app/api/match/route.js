import {
  createMockSnapshot,
  loadMockMatchDataset,
  parseClock,
} from "@/lib/mock-match-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const through = parseClock(request.nextUrl.searchParams.get("through") || undefined);
    const dataset = await loadMockMatchDataset();
    const snapshot = createMockSnapshot(dataset, through);
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const invalidClock = error instanceof Error && error.message.includes("Clock must");
    const detail = error instanceof Error ? error.message : "Local match data unavailable.";
    return Response.json(
      { ok: false, detail },
      { status: invalidClock ? 400 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
