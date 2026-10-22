"use client";

import { useEffect, useState } from "react";

import { fetchMatchStatus } from "@/lib/agent-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function MatchTab() {
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchMatchStatus()
      .then((body) => {
        if (!cancelled) setMatch(body);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load match");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Badge>Match</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Match desk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : match ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service</span>
                <span>{match.service}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{match.status}</span>
              </div>
              <Separator />
              <p>{match.message}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Loading match status…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
