"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { sendChatMessage } from "@/lib/agent-client";
import { useScene } from "@/lib/scene/SceneProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { PromptInput } from "@/components/ui/prompt-input";
import { ToolInvocationList } from "@/components/ui/tool-invocation";

function tabFromPathname(pathname) {
  if (pathname?.startsWith("/overview")) return "overview";
  if (pathname?.startsWith("/match")) return "match";
  if (pathname?.startsWith("/tactics")) return "tactics";
  return "pitch";
}

const DEFAULT_GREETING = "Football desk agent is ready. Ask about the pitch, match, or tactics.";

function ChatPendingIndicator() {
  return (
    <Message from="assistant">
      <MessageContent from="assistant" className="py-2.5">
        <span className="flex items-center gap-1" aria-label="Assistant is thinking">
          <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70" />
          <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
          <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
        </span>
      </MessageContent>
    </Message>
  );
}

function normalizeAssistantMessage(result) {
  if (!result.message?.content) return null;
  return {
    role: "assistant",
    content: result.message.content,
    toolCalls: Array.isArray(result.toolCalls) ? result.toolCalls : [],
  };
}

export function AgentConversation({
  placeholder,
  context = {},
  initialMessage = DEFAULT_GREETING,
  seedMessage = null,
  className,
}) {
  const pathname = usePathname();
  const { run } = useScene();
  const [messages, setMessages] = useState(() => initialMessage
    ? [{ role: "assistant", content: initialMessage, toolCalls: [] }]
    : []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const seededRef = useRef(null);

  async function dispatchChat(nextMessages) {
    setPending(true);
    setError(null);

    try {
      const result = await sendChatMessage({
        messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })),
        context: { tab: tabFromPathname(pathname), ...context },
      });

      const assistantMessage = normalizeAssistantMessage(result);
      if (assistantMessage) {
        setMessages((current) => [...current, assistantMessage]);
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

  async function handleSubmit(content) {
    setMessages((current) => {
      const nextMessages = [...current, { role: "user", content, toolCalls: [] }];
      void dispatchChat(nextMessages);
      return nextMessages;
    });
  }

  useEffect(() => {
    if (!seedMessage?.content) return;
    const key = seedMessage.key ?? seedMessage.content;
    if (seededRef.current === key) return;
    seededRef.current = key;
    void handleSubmit(seedMessage.content);
  }, [seedMessage]);

  return (
    <Conversation className={className ?? "min-h-0 flex-1"}>
      <ConversationContent>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="space-y-1">
            {message.role === "assistant" ? (
              <ToolInvocationList toolCalls={message.toolCalls} />
            ) : null}
            <Message from={message.role}>
              <MessageContent from={message.role}>{message.content}</MessageContent>
            </Message>
          </div>
        ))}
        {pending ? <ChatPendingIndicator /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </ConversationContent>
      <PromptInput
        disabled={pending}
        onSubmit={(value) => handleSubmit(value)}
        placeholder={placeholder ?? "Ask the agent…"}
      />
    </Conversation>
  );
}

export default function AgentChat() {
  const pathname = usePathname();

  return (
    <Card className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Agent</CardTitle>
          <Badge variant="secondary">{tabFromPathname(pathname)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <AgentConversation />
      </CardContent>
    </Card>
  );
}
