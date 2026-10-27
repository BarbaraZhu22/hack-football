function parseSseBlock(block) {
  const lines = block.split("\n");
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

async function readSseStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Stream unavailable");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const parsed = parseSseBlock(part.trim());
      if (!parsed) continue;
      onEvent(parsed.event, parsed.data);
      if (parsed.event === "done") {
        donePayload = parsed.data;
      }
      if (parsed.event === "error") {
        throw new Error(parsed.data?.message || "Stream failed");
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer.trim());
    if (parsed) {
      onEvent(parsed.event, parsed.data);
      if (parsed.event === "done") {
        donePayload = parsed.data;
      }
      if (parsed.event === "error") {
        throw new Error(parsed.data?.message || "Stream failed");
      }
    }
  }

  if (!donePayload) {
    throw new Error("Stream ended without a done event");
  }
  return donePayload;
}

export async function streamAdjudication(payload, onEvent) {
  const response = await fetch("/api/adjudicate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Adjudication failed (${response.status})`);
  }

  return readSseStream(response, onEvent ?? (() => {}));
}

export async function streamChatMessage({ messages, context, adjudicate = false }, onEvent) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, adjudicate: Boolean(adjudicate) }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Chat failed (${response.status})`);
  }

  return readSseStream(response, onEvent);
}
