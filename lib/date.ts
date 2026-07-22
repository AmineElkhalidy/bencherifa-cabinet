import { endOfDay, format, formatDistanceToNow, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";

export function todayRange(now: Date = new Date()) {
  return { from: startOfDay(now), to: endOfDay(now) };
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MM/dd/yyyy HH:mm", { locale: enUS });
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MM/dd/yyyy", { locale: enUS });
}

export function formatTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "HH:mm", { locale: enUS });
}

export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNow(date, { addSuffix: true, locale: enUS });
}
