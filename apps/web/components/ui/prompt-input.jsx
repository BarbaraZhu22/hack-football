"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function PromptInput({ className, onSubmit, disabled, placeholder, ...props }) {
  const [value, setValue] = React.useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit?.(trimmed);
    setValue("");
  }

  return (
    <form
      className={cn("flex items-end gap-2 border-t bg-background p-3", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <textarea
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "Ask the agent…"}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
          }
        }}
        className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="icon" disabled={disabled || !value.trim()}>
        <SendHorizontal />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}

export { PromptInput };
