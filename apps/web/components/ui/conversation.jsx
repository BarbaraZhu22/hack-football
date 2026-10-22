"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

function Conversation({ className, children, ...props }) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function ConversationContent({ className, children, ...props }) {
  return (
    <ScrollArea className={cn("flex-1 px-3", className)} {...props}>
      <div className="flex flex-col gap-3 py-3">{children}</div>
    </ScrollArea>
  );
}

function ConversationEmpty({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Conversation, ConversationContent, ConversationEmpty };
