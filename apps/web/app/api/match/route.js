import { createMockSnapshot, loadMockMatchDataset, parseClock } from "@/lib/mock-match-api";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const externalUrl = process.env.MATCH_API_URL;
  if (externalUrl) {
    const upstream = new URL(externalUrl);
    request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));
    try {
      const response = await fetch(upstream, { cache: "no-store" });
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Match API unreachable.";
      return Response.json({ ok: false, detail }, { status: 502 });
    }
  }

  try {
    const through = request.nextUrl.searchParams.get("through") || "78:32";
    const dataset = await loadMockMatchDataset();
    return Response.json(createMockSnapshot(dataset, parseClock(through)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Mock match data unavailable.";
    return Response.json({ ok: false, detail }, { status: 500 });
  }
}
