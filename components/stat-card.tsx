import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
};

const toneStyles: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  className,
}: Props) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            {hint ? (
              <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          {Icon ? (
            <div
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl",
                toneStyles[tone]
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
