"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

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
  const scrollerRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return undefined;
    const onScroll = () => {
      stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node || !stickToBottomRef.current) return undefined;
    const pin = () => {
      if (stickToBottomRef.current && scrollerRef.current) {
        scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      }
    };
    pin();
    const frame = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(frame);
  });

  return (
    <div
      ref={scrollerRef}
      className={cn("min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-3", className)}
      {...props}
    >
      <div className="flex w-full min-w-0 flex-col gap-3 py-3">{children}</div>
    </div>
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
