import Image from "next/image";

import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

/**
 * Ordonnance icon from /cabinet-ordonnance-icon.svg
 * (red heart #c41e3a, white cross, green pulse — santé & médecine).
 * Uses <img> for reliable screen + print rendering.
 */
export function PrescriptionMark({
  className,
  watermark = false,
  priority = false,
}: {
  className?: string;
  watermark?: boolean;
  priority?: boolean;
}) {
  return (
    <Image
      src="/cabinet-ordonnance-icon.svg"
      alt={APP_CONFIG.clinicName}
      width={160}
      height={180}
      priority={priority}
      unoptimized
      className={cn(
        "h-auto w-auto object-contain",
        watermark && "opacity-[0.09]",
        className
      )}
    />
  );
}
