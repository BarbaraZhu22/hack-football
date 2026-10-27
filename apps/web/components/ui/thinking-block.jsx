"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

function ThinkingPulse() {
  return (
    <span className="flex items-center gap-1 py-0.5" aria-label="Assistant is thinking">
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
    </span>
  );
}

export function ThinkingBlock({
  text = "",
  open = false,
  pending = false,
  onToggle,
  className,
}) {
  const visible = text.replace(/^\s+/, "");
  if (!visible && !pending) return null;

  return (
    <div className={cn("rounded-md border border-border/70 bg-muted/30", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground"
      >
        {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <span>Thinking</span>
        {pending ? <ThinkingPulse /> : null}
      </button>
      {open && visible ? (
        <div className="border-t border-border/60 px-2 py-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
          {visible}
        </div>
      ) : null}
    </div>
  );
}
