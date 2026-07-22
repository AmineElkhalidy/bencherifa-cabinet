import { Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

export function BrandMark({
  className,
  size = "md",
  compact = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}) {
  const sizes = {
    sm: { box: "h-8 w-8", icon: "h-4 w-4", title: "text-sm", subtitle: "text-[10px]" },
    md: { box: "h-10 w-10", icon: "h-5 w-5", title: "text-base", subtitle: "text-xs" },
    lg: { box: "h-12 w-12", icon: "h-6 w-6", title: "text-lg", subtitle: "text-xs" },
  }[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "grid place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
          sizes.box
        )}
      >
        <Stethoscope className={cn(sizes.icon)} />
      </div>
      <div className={cn("flex flex-col leading-tight", compact && "sr-only")}>
        <span className={cn("font-semibold tracking-tight", sizes.title)}>
          {APP_CONFIG.clinicName}
        </span>
        <span
          className={cn(
            "uppercase tracking-[0.2em] text-muted-foreground",
            sizes.subtitle
          )}
        >
          Medical · {APP_CONFIG.location}
        </span>
      </div>
    </div>
  );
}
