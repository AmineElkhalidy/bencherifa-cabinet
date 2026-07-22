import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware className combiner used by every Shadcn UI primitive.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Moroccan Dirhams. Falls back gracefully when
 * `Intl` lacks the locale.
 */
export function formatMAD(value: number) {
  try {
    return new Intl.NumberFormat("en-MA", {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} MAD`;
  }
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
