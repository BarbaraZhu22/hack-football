"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function ThinkingBlock({
  text = "",
  open = false,
  onToggle,
  className,
}) {
  if (!text) return null;

  return (
    <div className={cn("rounded-md border border-border/70 bg-muted/30", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground"
      >
        {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <span>Thinking</span>
      </button>
      {open ? (
        <div className="border-t border-border/60 px-2 py-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
          {text}
        </div>
      ) : null}
    </div>
  );
}
