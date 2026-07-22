import { Badge } from "@/components/ui/badge";
import { VISIT_STATUS_LABELS, type VisitStatus } from "@/lib/constants";

export function VisitStatusBadge({ status }: { status: string }) {
  const variant =
    status === "Pending" ? "warning" : status === "Completed" ? "success" : "muted";
  const label =
    VISIT_STATUS_LABELS[status as VisitStatus] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
