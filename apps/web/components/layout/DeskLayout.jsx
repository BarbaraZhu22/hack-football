"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MessageSquare } from "lucide-react";

import AgentChat from "@/components/chat/AgentChat";
import IncidentAgentPanel from "@/components/chat/IncidentAgentPanel";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/overview", label: "Overview" },
  { href: "/pitch", label: "Incident" },
  { href: "/tactics", label: "Analysis" },
];

export default function DeskLayout({ children }) {
  const pathname = usePathname();
  const { theme, setTheme, themes } = useTheme();
  const activeTheme = themes.find((item) => item.id === theme);

  // The overview desk hosts the agent in its centre column, so the shared
  // right-hand rail is dropped there to avoid two live copies of the chat.
  const showAgentRail = pathname !== "/overview";
  const isIncidentPage = pathname === "/pitch";
  const AgentPanel = isIncidentPage ? IncidentAgentPanel : AgentChat;

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:overflow-hidden">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="flex h-14 w-full items-center gap-4 px-3">
          <Link href="/overview" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              FI
            </span>
            {!isIncidentPage ? <span className="hidden sm:inline">Football Interpreter</span> : null}
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Button
                  key={tab.href}
                  asChild
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                >
                  <Link href={tab.href}>{tab.label}</Link>
                </Button>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {activeTheme?.label ?? "Theme"}
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Skin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                {themes.map((item) => (
                  <DropdownMenuRadioItem key={item.id} value={item.id}>
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div
        className={cn(
          "grid min-h-0 w-full flex-1 gap-4 px-3 py-4",
          showAgentRail && "lg:grid-cols-[minmax(0,1fr)_320px]",
        )}
      >
        <main className="h-full min-h-0">{children}</main>

        {showAgentRail ? (
          <aside className="hidden h-full min-h-0 lg:block">
            <AgentPanel />
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
              <AgentPanel />
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
