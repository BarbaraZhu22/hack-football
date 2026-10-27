import { streamChatMessage } from "@/lib/chat-stream";

export async function sendChatMessage({ messages, context, adjudicate = false }, onEvent) {
  return streamChatMessage({ messages, context, adjudicate }, onEvent ?? (() => {}));
}

export async function fetchAgentHealth() {
  const response = await fetch("/api/health", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Agent health failed (${response.status})`);
  }
  return response.json();
}
