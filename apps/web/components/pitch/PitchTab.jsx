"use client";

import dynamic from "next/dynamic";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScene } from "@/lib/scene/SceneProvider";

const PitchCanvas = dynamic(() => import("@/components/three/PitchCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
      Loading pitch…
    </div>
  ),
});

export default function PitchTab() {
  const { state } = useScene();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Pitch</Badge>
        <span className="text-sm text-muted-foreground">
          {state.players.length} players · {state.arrows.length} arrows
        </span>
      </div>
      <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">3D pitch</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-3">
          <PitchCanvas />
        </CardContent>
      </Card>
    </div>
  );
}
