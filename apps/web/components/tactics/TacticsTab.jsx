"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScene } from "@/lib/scene/SceneProvider";

export default function TacticsTab() {
  const { run, state } = useScene();

  function demoArrow() {
    run([
      {
        type: "arrow.add",
        id: "demo-run",
        from: [-4, 0.2, 0],
        to: [6, 0.2, -3],
      },
      {
        type: "highlight",
        target: "player",
        id: "10",
      },
    ]);
  }

  function clearTactics() {
    run([{ type: "arrow.clear" }, { type: "highlight", target: "player", id: null }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <Badge>Tactics</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Tactics board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Draw runs and highlights on the pitch via scene commands. Agent replies
            can also push the same actions.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={demoArrow}>
              Demo arrow
            </Button>
            <Button size="sm" variant="outline" onClick={clearTactics}>
              Clear
            </Button>
          </div>
          <p className="text-muted-foreground">
            Active arrows: {state.arrows.length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
