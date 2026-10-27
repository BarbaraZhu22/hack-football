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

export async function streamChatMessage({ messages, context }, onEvent) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Chat failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Chat stream unavailable");
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
        throw new Error(parsed.data?.message || "Chat stream failed");
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
        throw new Error(parsed.data?.message || "Chat stream failed");
      }
    }
  }

  if (!donePayload) {
    throw new Error("Chat stream ended without a done event");
  }
  return donePayload;
}
