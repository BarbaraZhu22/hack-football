"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MessageSquare } from "lucide-react";

import AgentChat from "@/components/chat/AgentChat";
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
  { href: "/pitch", label: "Pitch" },
  { href: "/match", label: "Match" },
  { href: "/tactics", label: "Tactics" },
];

export default function DeskLayout({ children }) {
  const pathname = usePathname();
  const { theme, setTheme, themes } = useTheme();
  const activeTheme = themes.find((item) => item.id === theme);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/pitch" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              FD
            </span>
            <span className="hidden sm:inline">Football Desk</span>
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

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-h-0">{children}</main>

        <aside className="hidden min-h-0 lg:block">
          <AgentChat />
        </aside>
      </div>

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
            <AgentChat />
          </div>
        </details>
      </div>
    </div>
  );
}
