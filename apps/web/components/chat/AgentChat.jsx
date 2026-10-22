"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { sendChatMessage } from "@/lib/agent-client";
import { useScene } from "@/lib/scene/SceneProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Conversation,
  ConversationContent,
  ConversationEmpty,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { PromptInput } from "@/components/ui/prompt-input";

function tabFromPathname(pathname) {
  if (pathname?.startsWith("/match")) return "match";
  if (pathname?.startsWith("/tactics")) return "tactics";
  return "pitch";
}

export default function AgentChat() {
  const pathname = usePathname();
  const { run } = useScene();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Football desk agent is ready. Ask about the pitch, match, or tactics.",
    },
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(content) {
    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setPending(true);
    setError(null);

    try {
      const result = await sendChatMessage({
        messages: nextMessages,
        context: { tab: tabFromPathname(pathname) },
      });

      if (result.message?.content) {
        setMessages((current) => [...current, result.message]);
      }

      if (Array.isArray(result.actions) && result.actions.length > 0) {
        run(result.actions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Agent</CardTitle>
          <Badge variant="secondary">{tabFromPathname(pathname)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmpty>No messages yet.</ConversationEmpty>
            ) : (
              messages.map((message, index) => (
                <Message key={`${message.role}-${index}`} from={message.role}>
                  <MessageContent from={message.role}>
                    {message.content}
                  </MessageContent>
                </Message>
              ))
            )}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </ConversationContent>
          <PromptInput disabled={pending} onSubmit={handleSubmit} />
        </Conversation>
      </CardContent>
    </Card>
  );
}
