"use client";

import { LayoutGrid } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function TacticsTab() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Badge>Analysis</Badge>
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Workspace</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Deeper analysis is on the way</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          This page is reserved for season-level trends, referee consistency dashboards and cross-match benchmarks. The design is still in progress.
        </p>
      </div>

      <Card className="flex min-h-[360px] flex-1 items-center justify-center">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted">
            <LayoutGrid className="size-6 text-muted-foreground" />
          </div>
          <Badge variant="outline">Placeholder</Badge>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Season trends, consistency benchmarks and cross-match analytics will live here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
