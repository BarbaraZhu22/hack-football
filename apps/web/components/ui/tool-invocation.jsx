"use client";

import { Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

export function ToolInvocationList({ toolCalls = [], className }) {
  if (!toolCalls.length) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {toolCalls.map((call, index) => (
        <div
          key={`${call.name}-${index}`}
          className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs"
        >
          <Wrench className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="font-mono font-medium text-foreground">{call.name}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {formatToolInput(call.input)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatToolInput(input) {
  if (!input || typeof input !== "object") return String(input ?? "");
  const entries = Object.entries(input);
  if (entries.length === 1) {
    const [key, value] = entries[0];
    return `${key}=${JSON.stringify(value)}`;
  }
  return JSON.stringify(input);
}
