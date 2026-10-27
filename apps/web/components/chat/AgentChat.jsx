"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { sendChatMessage } from "@/lib/agent-client";
import { usePitchChatContext } from "@/lib/pitch-chat-context";
import { useScene } from "@/lib/scene/SceneProvider";
import { actionsFromControlScene } from "@/lib/scene/commands";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { PromptInput } from "@/components/ui/prompt-input";
import { SmartAnalysisCard } from "@/components/ui/smart-analysis-card";
import { ThinkingBlock } from "@/components/ui/thinking-block";
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

function createStreamingAssistant() {
  return {
    role: "assistant",
    phase: "loading",
    content: "",
    thinking: "",
    thinkingOpen: false,
    toolCalls: [],
    analysis: null,
  };
}

function AssistantReply({ message }) {
  const showLoading = message.phase === "loading" && !message.toolCalls.length && !message.thinking;
  const hasAnalysis = Boolean(message.analysis?.ruling);
  const thinkingPending = message.phase !== "done" && !message.thinking && message.toolCalls.length > 0;
  const showThinking = thinkingPending || (Boolean(message.thinking) && (message.phase !== "done" || hasAnalysis));
  const showPlainReply = message.phase === "done" && !hasAnalysis && message.content;

  return (
    <div className="w-full min-w-0 space-y-1.5">
      {showLoading ? <ChatPendingIndicator /> : null}
      <ToolInvocationList toolCalls={message.toolCalls} />
      {showThinking ? (
        <ThinkingBlock
          text={message.thinking}
          pending={thinkingPending}
          open={thinkingPending || message.thinkingOpen}
          onToggle={() => {
            message.onToggleThinking?.();
          }}
        />
      ) : null}
      {message.phase === "done" && hasAnalysis ? (
        <>
          <SmartAnalysisCard analysis={message.analysis} />
        </>
      ) : null}
      {showPlainReply ? (
        <Message from="assistant">
          <MessageContent from="assistant">{message.content}</MessageContent>
        </Message>
      ) : null}
    </div>
  );
}

export function AgentConversation({
  placeholder,
  context = {},
  initialMessage = DEFAULT_GREETING,
  seedMessage = null,
  adjudicate = false,
  className,
}) {
  const pathname = usePathname();
  const { run } = useScene();
  const [messages, setMessages] = useState(() => initialMessage
    ? [{ role: "assistant", content: initialMessage, phase: "done", toolCalls: [] }]
    : []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const seededRef = useRef(null);
  const pendingCountRef = useRef(0);
  const contextRef = useRef(context);
  const appliedSceneButtonsRef = useRef(new Set());

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  function patchAssistantAt(index, updater) {
    setMessages((current) => {
      const next = [...current];
      const target = next[index];
      if (!target || target.role !== "assistant") return current;
      next[index] = updater({ ...target });
      return next;
    });
  }

  const adjudicateRef = useRef(false);

  async function dispatchChat(nextMessages, assistantIndex, runAdjudicate = false, contextOverride = null) {
    pendingCountRef.current += 1;
    setPending(true);
    setError(null);
    appliedSceneButtonsRef.current = new Set();

    function runSceneActions(actions) {
      const fresh = actions.filter((action) => {
        if (action?.type !== "ui.press" || !action.button) return true;
        if (appliedSceneButtonsRef.current.has(action.button)) return false;
        appliedSceneButtonsRef.current.add(action.button);
        return true;
      });
      if (fresh.length) run(fresh);
    }

    try {
      const activeContext = {
        tab: tabFromPathname(pathname),
        ...(contextOverride ?? contextRef.current),
      };
      const shouldAdjudicate =
        runAdjudicate
        || (
          Boolean(activeContext.minuteContext?.precedentTypes?.length)
          && /referee|decision|ruling|offside|card|foul|precedent/i.test(
            nextMessages[nextMessages.length - 1]?.content || "",
          )
        );

      const result = await sendChatMessage(
        {
          messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })),
          context: activeContext,
          adjudicate: shouldAdjudicate,
        },
        (event, data) => {
          if (event === "tool" && data?.name === "control_scene") {
            runSceneActions(actionsFromControlScene(data.input));
          }
          if (event === "tool") {
            patchAssistantAt(assistantIndex, (message) => {
              const exists = message.toolCalls.some(
                (call) => call.name === data.name && JSON.stringify(call.input) === JSON.stringify(data.input),
              );
              return {
                ...message,
                phase: "streaming",
                toolCalls: exists ? message.toolCalls : [...message.toolCalls, { name: data.name, input: data.input }],
              };
            });
          }
          if (event === "thinking" && data?.delta) {
            patchAssistantAt(assistantIndex, (message) => {
              const next = `${message.thinking}${data.delta}`;
              if (!next.trim()) return message;
              return {
                ...message,
                phase: "streaming",
                thinkingOpen: true,
                thinking: message.thinking ? next : next.trimStart(),
              };
            });
          }
        },
      );

      patchAssistantAt(assistantIndex, (message) => ({
        ...message,
        phase: "done",
        content: result.message?.content ?? message.thinking,
        thinking: message.thinking || result.message?.content || "",
        thinkingOpen: false,
        toolCalls: Array.isArray(result.toolCalls) ? result.toolCalls : message.toolCalls,
        analysis: result.analysis ?? null,
      }));

      if (Array.isArray(result.actions) && result.actions.length > 0) {
        runSceneActions(result.actions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed");
      setMessages((current) => current.filter((_, index) => index !== assistantIndex));
    } finally {
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
      setPending(pendingCountRef.current > 0);
    }
  }

  function handleSubmit(content) {
    setMessages((current) => {
      const nextMessages = [...current, { role: "user", content, toolCalls: [] }];
      const assistantIndex = nextMessages.length;
      void dispatchChat(nextMessages, assistantIndex, false);
      return [...nextMessages, createStreamingAssistant()];
    });
  }

  useEffect(() => {
    if (!seedMessage?.content) return;
    const key = seedMessage.key ?? seedMessage.content;
    if (seededRef.current === key) return;
    seededRef.current = key;
    adjudicateRef.current = Boolean(seedMessage.adjudicate);
    const contextOverride = seedMessage.minuteContext
      ? { ...contextRef.current, minuteContext: seedMessage.minuteContext }
      : null;
    setMessages((current) => {
      const nextMessages = [...current, { role: "user", content: seedMessage.content, toolCalls: [] }];
      const assistantIndex = nextMessages.length;
      void dispatchChat(nextMessages, assistantIndex, adjudicateRef.current, contextOverride);
      return [...nextMessages, createStreamingAssistant()];
    });
  }, [seedMessage]);

  return (
    <Conversation className={className ?? "min-h-0 flex-1"}>
      <ConversationContent>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="w-full min-w-0 space-y-1">
            {message.role === "assistant" && message.phase ? (
              <AssistantReply
                message={{
                  ...message,
                  onToggleThinking: () => {
                    setMessages((current) => {
                      const next = [...current];
                      const target = next[index];
                      if (!target || target.role !== "assistant") return current;
                      next[index] = { ...target, thinkingOpen: !target.thinkingOpen };
                      return next;
                    });
                  },
                }}
              />
            ) : message.role === "assistant" ? (
              <>
                <ToolInvocationList toolCalls={message.toolCalls} />
                <Message from="assistant">
                  <MessageContent from="assistant">{message.content}</MessageContent>
                </Message>
              </>
            ) : (
              <Message from={message.role}>
                <MessageContent from={message.role}>{message.content}</MessageContent>
              </Message>
            )}
          </div>
        ))}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </ConversationContent>
      <PromptInput
        className="shrink-0"
        disabled={pending}
        onSubmit={(value) => handleSubmit(value)}
        placeholder={placeholder ?? "Ask the agent…"}
      />
    </Conversation>
  );
}

export default function AgentChat() {
  const pathname = usePathname();
  const pitchContext = usePitchChatContext();

  return (
    <Card className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Agent</CardTitle>
          <Badge variant="secondary">{tabFromPathname(pathname)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <AgentConversation
          context={{
            tab: tabFromPathname(pathname),
            ...(pitchContext ? { pitch: pitchContext } : {}),
          }}
        />
      </CardContent>
    </Card>
  );
}
