"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrescriptionPrintToolbar({ visitId }: { visitId: string }) {
  return (
    <div className="prescription-toolbar sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur print:hidden">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/doctor/consultations/${visitId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to consultation
        </Link>
      </Button>
      <Button type="button" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print prescription
      </Button>
    </div>
  );
}
