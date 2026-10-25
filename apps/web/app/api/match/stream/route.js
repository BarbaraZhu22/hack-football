import {
  MAJOR_EVENT_TYPES,
  createMockMomentum,
  createMockSnapshot,
  decisionFromEvent,
  deriveStats,
  formatClock,
  loadMockMatchDataset,
  parseClock,
  scoreAt,
} from "@/lib/mock-match-api";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const pause = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

export async function GET(request) {
  const externalUrl = process.env.MATCH_STREAM_API_URL;
  if (externalUrl) {
    const upstream = new URL(externalUrl);
    request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));
    const response = await fetch(upstream, {
      headers: { accept: "text/event-stream" },
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
  }

  if (process.env.MATCH_API_URL) {
    return Response.json(
      { ok: false, detail: "Configure MATCH_STREAM_API_URL alongside MATCH_API_URL." },
      { status: 503 },
    );
  }

  const lastEventId = request.headers.get("last-event-id");
  const afterValue = lastEventId || request.nextUrl.searchParams.get("after") || "78:32";
  let afterSeconds;
  try {
    afterSeconds = /^\d+$/.test(afterValue) ? Number(afterValue) : parseClock(afterValue);
  } catch (error) {
    return Response.json({ ok: false, detail: error.message }, { status: 400 });
  }
  const dataset = await loadMockMatchDataset();
  const finalSeconds = Math.max(
    ...dataset.frames.map((frame) => frame.clockSeconds),
    ...dataset.events.map((event) => event.clockSeconds),
    ...dataset.phases.map((phase) => phase.clockSeconds),
  );
  const tickDelay = Math.max(50, Number(process.env.MOCK_MATCH_TICK_MS) || 1000);
  const allEvents = [...dataset.events, ...dataset.phases].sort(
    (left, right) => left.timeMilliseconds - right.timeMilliseconds || left.sequence - right.sequence,
  );
  const frameByTime = new Map(dataset.frames.map((frame) => [frame.clockSeconds, frame]));
  const ratingsBySecond = new Map();
  for (const rating of dataset.ratings) {
    const rows = ratingsBySecond.get(rating.matchSecond) || [];
    rows.push(rating);
    ratingsBySecond.set(rating.matchSecond, rows);
  }
  const initialClock = createMockSnapshot(dataset, afterSeconds).clock;

  const stream = new ReadableStream({
    async start(controller) {
      let currentSeconds = afterSeconds;
      try {
        controller.enqueue(encoder.encode("event: ready\ndata: " + JSON.stringify({ clock: initialClock }) + "\n\n"));
        while (currentSeconds < finalSeconds) {
          await pause(tickDelay);
          const nextSeconds = currentSeconds + 1;
          const nextEvents = allEvents.filter(
            (event) => event.timeMilliseconds > currentSeconds * 1000 && event.timeMilliseconds <= nextSeconds * 1000,
          );
          const knownEvents = allEvents.filter((event) => event.timeMilliseconds <= nextSeconds * 1000);
          const knownRows = knownEvents.filter((event) => event.type !== "phase");
          const knownFrames = dataset.frames.filter((frame) => frame.timeMilliseconds <= nextSeconds * 1000);
          const clock = formatClock(nextSeconds);
          const tick = {
            clock,
            match: { ...dataset.match, score: scoreAt(knownEvents) },
            frame: frameByTime.get(nextSeconds) || null,
            ratings: ratingsBySecond.get(nextSeconds) || [],
            events: nextEvents.filter((event) => event.type !== "phase"),
            phases: nextEvents.filter((event) => event.type === "phase"),
            timelineEvents: nextEvents.filter((event) => event.type !== "phase" && event.timelineEvent && MAJOR_EVENT_TYPES.has(event.type)),
            decisions: nextEvents.filter((event) => event.type !== "phase" && event.decision).map(decisionFromEvent),
            stats: deriveStats(knownRows, knownFrames),
            momentum: createMockMomentum(knownFrames),
          };
          controller.enqueue(encoder.encode(
            "id: " + nextSeconds + "\nevent: tick\ndata: " + JSON.stringify(tick) + "\n\n",
          ));
          currentSeconds = nextSeconds;
        }
        controller.close();
      } catch {
        controller.close();
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
