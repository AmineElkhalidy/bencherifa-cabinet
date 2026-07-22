"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENDER_LABELS,
  VISIT_TYPES,
  VISIT_TYPE_LABELS,
  type Gender,
} from "@/lib/constants";
import { initialsOf } from "@/lib/utils";
import { createVisit, type VisitCreateState } from "@/app/actions/visits";

type Patient = {
  id: string;
  name: string;
  cin: string | null;
  phoneNumber: string | null;
  gender: Gender;
  age: string;
};

export function NewVisitForm({
  patients,
  defaultPatientId,
  defaultPrice,
}: {
  patients: Patient[];
  defaultPatientId?: string;
  defaultPrice: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const initialPatientId =
    defaultPatientId && patients.some((p) => p.id === defaultPatientId)
      ? defaultPatientId
      : patients[0]?.id ?? "";
  const initialPatient = patients.find((p) => p.id === initialPatientId);

  const [patientId, setPatientId] = useState<string>(initialPatientId);
  const [patientSearch, setPatientSearch] = useState<string>(
    initialPatient ? formatPatientSearchLabel(initialPatient) : ""
  );
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(event.target as Node)) {
        setPatientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.cin?.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const [visitType, setVisitType] = useState<"Consultation" | "Control">(
    "Consultation"
  );
  const [price, setPrice] = useState(String(defaultPrice));
  const [consultationPrice, setConsultationPrice] = useState(String(defaultPrice));

  const [state, formAction, isPending] = useActionState<
    VisitCreateState,
    FormData
  >(createVisit, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Visit created — patient added to the waiting list");
      startTransition(() => {
        router.push("/reception");
        router.refresh();
      });
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  function handleVisitTypeChange(nextVisitType: "Consultation" | "Control") {
    setVisitType(nextVisitType);

    if (nextVisitType === "Control") {
      if (price !== "0") {
        setConsultationPrice(price);
      }
      setPrice("0");
      return;
    }

    setPrice(
      consultationPrice.trim() && consultationPrice !== "0"
        ? consultationPrice
        : String(defaultPrice)
    );
  }

  function handlePriceChange(nextPrice: string) {
    setPrice(nextPrice);

    if (visitType === "Consultation") {
      setConsultationPrice(nextPrice);
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="visitType" value={visitType} />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Visit details
            </CardTitle>
            <CardDescription>
              The date and time are automatically set to now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient</Label>
              <div className="relative" ref={patientSearchRef}>
                <Input
                  id="patientId-input"
                  placeholder="Search patient by name or CIN..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setPatientDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (!patientId) setPatientSearch("");
                    setPatientDropdownOpen(true);
                  }}
                />
                {patientDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-md max-h-60 overflow-auto">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((p) => (
                        <div
                          key={p.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientSearch(formatPatientSearchLabel(p));
                            setPatientDropdownOpen(false);
                          }}
                        >
                          {p.name} {p.cin ? `— ${p.cin}` : ""}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No patients found.</div>
                    )}
                  </div>
                )}
              </div>
              {selectedPatient ? (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initialsOf(selectedPatient.name)}
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {GENDER_LABELS[selectedPatient.gender]} ·{" "}
                      {selectedPatient.age}
                      {selectedPatient.phoneNumber
                        ? ` · ${selectedPatient.phoneNumber}`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visitType">Visit type</Label>
                <Select
                  value={visitType}
                  onValueChange={(v) =>
                    handleVisitTypeChange(v as "Consultation" | "Control")
                  }
                >
                  <SelectTrigger id="visitType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {VISIT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (MAD)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  step="0.01"
                  min="0"
                  readOnly={visitType === "Control"}
                />
                {visitType === "Control" ? (
                  <p className="text-xs text-muted-foreground">
                    Follow-up visits are automatically priced at 0 MAD.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {state?.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isPending || !patientId}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Add to waiting list
          </Button>
        </div>
      </div>
    </form>
  );
}

function formatPatientSearchLabel(patient: Pick<Patient, "name" | "cin">) {
  return `${patient.name}${patient.cin ? ` — ${patient.cin}` : ""}`;
}
