import {
  deriveMomentum,
  decisionFromEvent,
  deriveStats,
  formatClock,
  loadMockMatchDataset,
  MAJOR_EVENT_TYPES,
  parseClock,
  scoreAt,
} from "@/lib/mock-match-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIVE_CLOCK = "78:32";
const encoder = new TextEncoder();

function parseAfter(value) {
  const after = value || DEFAULT_LIVE_CLOCK;
  return /^\d+$/.test(after) ? Number(after) : parseClock(after);
}

function tickDelayMs() {
  const configured = Number(process.env.MOCK_MATCH_TICK_MS || 1000);
  return Number.isFinite(configured) ? Math.max(50, configured) : 1000;
}

function waitForTick(milliseconds, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal?.addEventListener("abort", finish, { once: true });
    if (signal?.aborted) finish();
  });
}

async function* localMatchStream(afterSeconds, delayMs, signal) {
  const dataset = await loadMockMatchDataset();
  const allEvents = [...dataset.events, ...dataset.phases].sort(
    (left, right) =>
      left.timeMilliseconds - right.timeMilliseconds || left.sequence - right.sequence,
  );
  const finalSeconds = Math.max(
    0,
    ...dataset.frames.map((frame) => frame.clockSeconds),
    ...allEvents.map((event) => event.clockSeconds),
  );
  const frameByTime = new Map(dataset.frames.map((frame) => [frame.clockSeconds, frame]));
  const ratingsBySecond = new Map();
  for (const rating of dataset.ratings) {
    const ratings = ratingsBySecond.get(rating.matchSecond) || [];
    ratings.push(rating);
    ratingsBySecond.set(rating.matchSecond, ratings);
  }

  yield "event: ready\ndata: " + JSON.stringify({ clock: formatClock(afterSeconds) }) + "\n\n";

  let currentSeconds = afterSeconds;
  while (currentSeconds < finalSeconds && !signal?.aborted) {
    await waitForTick(delayMs, signal);
    if (signal?.aborted) return;

    const nextSeconds = currentSeconds + 1;
    const nextEvents = allEvents.filter(
      (event) =>
        currentSeconds * 1000 < event.timeMilliseconds &&
        event.timeMilliseconds <= nextSeconds * 1000,
    );
    const knownEvents = allEvents.filter(
      (event) => event.timeMilliseconds <= nextSeconds * 1000,
    );
    const knownRows = knownEvents.filter((event) => event.type !== "phase");
    const knownFrames = dataset.frames.filter(
      (frame) => frame.timeMilliseconds <= nextSeconds * 1000,
    );
    const tick = {
      clock: formatClock(nextSeconds),
      match: { ...dataset.match, score: scoreAt(knownEvents) },
      frame: frameByTime.get(nextSeconds) || null,
      ratings: ratingsBySecond.get(nextSeconds) || [],
      events: nextEvents.filter((event) => event.type !== "phase"),
      phases: nextEvents.filter((event) => event.type === "phase"),
      timelineEvents: nextEvents.filter(
        (event) =>
          event.type !== "phase" &&
          (event.timelineEvent || event.type === "sub") &&
          MAJOR_EVENT_TYPES.has(event.type),
      ),
      decisions: nextEvents
        .filter((event) => event.type !== "phase" && event.decision)
        .map(decisionFromEvent),
      stats: deriveStats(knownRows, knownFrames),
      momentum: deriveMomentum(knownRows, knownFrames),
    };

    yield (
      "id: " +
      nextSeconds +
      "\nevent: tick\ndata: " +
      JSON.stringify(tick) +
      "\n\n"
    );
    currentSeconds = nextSeconds;
  }
}

export async function GET(request) {
  try {
    const afterSeconds = parseAfter(request.nextUrl.searchParams.get("after"));
    const iterator = localMatchStream(afterSeconds, tickDelayMs(), request.signal);
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) {
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Local match stream failed.";
          controller.enqueue(
            encoder.encode("event: error\ndata: " + JSON.stringify({ detail }) + "\n\n"),
          );
          controller.close();
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const invalidClock = error instanceof Error && error.message.includes("Clock must");
    const detail = error instanceof Error ? error.message : "Local match stream unavailable.";
    return Response.json({ ok: false, detail }, { status: invalidClock ? 400 : 500 });
  }
}
