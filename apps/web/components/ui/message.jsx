"use client";

import { cn } from "@/lib/utils";

function Message({ className, from, ...props }) {
  const isUser = from === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}
      {...props}
    />
  );
}

function MessageContent({ className, from, children, ...props }) {
  const isUser = from === "user";
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground"
          : "border bg-card text-card-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Message, MessageContent };
