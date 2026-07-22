import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          Your role does not allow you to view this section. If you think this
          is a mistake, contact the responsible doctor.
        </p>
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
