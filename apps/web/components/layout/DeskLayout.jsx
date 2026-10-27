"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gamepad2,
  ChevronDown,
  Whistle,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";

import AgentChat from "@/components/chat/AgentChat";
import IncidentAgentPanel from "@/components/chat/IncidentAgentPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/overview", label: "Overview", Icon: LayoutDashboard },
  { href: "/pitch", label: "Incident", Icon: Whistle },
  { href: "/game", label: "Game", Icon: Gamepad2 },
];

const tooltipClass = "pointer-events-none absolute left-full top-1/2 z-[60] ml-3 -translate-y-1/2 whitespace-nowrap rounded-control border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

export default function DeskLayout({ children }) {
  const pathname = usePathname();

  // Overview and the full-screen game use the whole content area without an agent rail.
  const isGamePage = pathname === "/game" || pathname === "/tactics";
  const showAgentRail = pathname !== "/overview" && !isGamePage;
  const isIncidentPage = pathname === "/pitch";
  const AgentPanel = isIncidentPage ? IncidentAgentPanel : AgentChat;

  return (
    <div className={cn(
      "desk-shell flex min-h-dvh bg-background lg:h-dvh lg:overflow-hidden",
      isGamePage && "h-dvh min-h-0 overflow-hidden",
    )}>
      <aside className="sticky top-0 z-40 flex h-dvh w-14 shrink-0 flex-col items-center border-r border-border bg-card/95 px-2 py-3 backdrop-blur sm:w-[68px]">
        <Link
          href="/overview"
          aria-label="Reverse Whistle"
          className="group relative inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold tracking-tight text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          RW
          <span className={tooltipClass}>Reverse Whistle</span>
        </Link>

        <nav aria-label="Primary navigation" className="mt-5 flex w-full flex-col items-center gap-2">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Button
                key={href}
                asChild
                variant={active ? "default" : "ghost"}
                size="icon"
                className="group relative rounded-md"
              >
                <Link href={href} aria-label={label} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
                  <span className={tooltipClass}>{label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "grid min-h-0 w-full flex-1 gap-3 px-2 py-3 sm:gap-4 sm:px-3 sm:py-4",
            isGamePage && "gap-0 px-0 py-0",
            showAgentRail && "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]",
          )}
        >
          <main className={cn("h-full min-h-0 min-w-0", isGamePage ? "overflow-hidden" : "overflow-y-auto")}>
            {children}
          </main>

          {showAgentRail ? (
            <aside className="hidden h-full min-h-0 min-w-0 lg:block">
              <Suspense fallback={null}>
                <AgentPanel />
              </Suspense>
            </aside>
          ) : null}
        </div>

        {showAgentRail ? (
          <div className="border-t bg-card p-3 lg:hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="size-4" />
                  Agent chat
                </span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className={cn("mt-3 h-[420px]")}>
                <Suspense fallback={null}>
                  <AgentPanel />
                </Suspense>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}
