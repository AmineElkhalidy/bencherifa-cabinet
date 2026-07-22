"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  IdCard,
  Loader2,
  Phone,
  Save,
  ShieldAlert,
  Stethoscope,
  Sparkles,
  UserPlus,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  GENDERS,
  GENDER_LABELS,
  INSURANCE_LABELS,
  INSURANCE_PROVIDERS,
} from "@/lib/constants";
import {
  createPatient,
  type PatientFormState,
  updatePatient,
} from "@/app/actions/patients";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Returns true when the entered number looks like a birth year
 * (4-digit year >= 1900 and not in the future).
 */
function isBirthYear(n: number): boolean {
  return n >= 1900 && n <= CURRENT_YEAR;
}

/**
 * Given the raw value the receptionist typed, return the resolved age
 * that should be stored. If the value looks like a birth year, calculate
 * the age from it; otherwise use it directly.
 */
function resolveAge(raw: number): number {
  if (isBirthYear(raw)) return CURRENT_YEAR - raw;
  return raw;
}

type Props = {
  mode: "create" | "edit";
  patient?: {
    id: string;
    name: string;
    age: string;
    gender: string;
    phoneNumber: string | null;
    cin: string | null;
    insuranceProvider: string;
    surgicalHistory: string;
    allergies: string;
    contraindications: string;
  };
};

export function PatientForm({ mode, patient }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const action =
    mode === "edit" && patient
      ? updatePatient.bind(null, patient.id)
      : createPatient;

  const [state, formAction, isPending] = useActionState<
    PatientFormState,
    FormData
  >(action, null);

  // The raw value the receptionist typed (could be an age or a birth year)
  const defaultRaw = mode === "edit" && patient?.age ? patient.age : "";
  const [rawValue, setRawValue] = useState<string>(defaultRaw);
  const hiddenAgeRef = useRef<HTMLInputElement>(null);

  const parsedRaw = parseInt(rawValue, 10);
  const isBirthYearMode = !isNaN(parsedRaw) && isBirthYear(parsedRaw);
  // The age that will actually be sent to the server
  const resolvedAge = !isNaN(parsedRaw) && parsedRaw > 0
    ? resolveAge(parsedRaw)
    : "";

  // Keep the hidden age input in sync
  useEffect(() => {
    if (hiddenAgeRef.current) {
      hiddenAgeRef.current.value = resolvedAge.toString();
    }
  }, [resolvedAge]);

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        mode === "edit" ? "Patient updated" : "Patient registered"
      );
      startTransition(() => {
        if (mode === "create" && state.patient) {
          router.push(`/reception/patients/${state.patient.id}`);
        } else if (mode === "edit" && patient) {
          router.push(`/reception/patients/${patient.id}`);
        }
        router.refresh();
      });
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, mode, patient]);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Identity
          </CardTitle>
          <CardDescription>
            Administrative information required during registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field
            id="name"
            label="Full name"
            required
            error={state?.fieldErrors?.name?.[0]}
          >
            <Input
              id="name"
              name="name"
              defaultValue={patient?.name ?? ""}
              placeholder="Ex. Salma El Idrissi"
              required
            />
          </Field>

          <Field
            id="ageInput"
            label="Age"
            icon={CalendarDays}
            required
            error={state?.fieldErrors?.age?.[0]}
            hint="Enter the age (e.g. 32) or the birth year (e.g. 1990)"
          >
            {/* Hidden field carries the resolved age to the server */}
            <input
              ref={hiddenAgeRef}
              type="hidden"
              name="age"
              defaultValue={resolvedAge}
            />
            <div className="relative">
              <Input
                id="ageInput"
                type="number"
                min={0}
                max={CURRENT_YEAR}
                placeholder="32 or 1990"
                defaultValue={defaultRaw}
                required
                onChange={(e) => setRawValue(e.target.value)}
              />
              {isBirthYearMode && resolvedAge !== "" && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-sm font-medium text-primary">
                  = {resolvedAge} yrs
                </span>
              )}
            </div>
          </Field>

          <Field
            id="gender"
            label="Gender"
            required
            error={state?.fieldErrors?.gender?.[0]}
          >
            <Select name="gender" defaultValue={patient?.gender ?? "Female"}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            id="phoneNumber"
            label="Phone"
            icon={Phone}
            error={state?.fieldErrors?.phoneNumber?.[0]}
          >
            <Input
              id="phoneNumber"
              name="phoneNumber"
              defaultValue={patient?.phoneNumber ?? ""}
              placeholder="06 12 34 56 78 (optional)"
              type="tel"
            />
          </Field>

          <Field
            id="cin"
            label="CIN"
            icon={IdCard}
            error={state?.fieldErrors?.cin?.[0]}
          >
            <Input
              id="cin"
              name="cin"
              defaultValue={patient?.cin ?? ""}
              placeholder="AB123456 (optional)"
            />
          </Field>

          <Field
            id="insuranceProvider"
            label="Insurance"
            error={state?.fieldErrors?.insuranceProvider?.[0]}
          >
            <Select
              name="insuranceProvider"
              defaultValue={patient?.insuranceProvider ?? "NONE"}
            >
              <SelectTrigger id="insuranceProvider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_PROVIDERS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {INSURANCE_LABELS[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Medical history
          </CardTitle>
          <CardDescription>
            Visible to the doctor during consultations. Optional, but
            recommended.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="surgicalHistory" label="Surgical history" icon={Sparkles}>
            <Textarea
              id="surgicalHistory"
              name="surgicalHistory"
              defaultValue={patient?.surgicalHistory ?? ""}
              placeholder="Past procedures, approximate dates..."
              rows={3}
            />
          </Field>
          <Field id="allergies" label="Allergies" icon={ShieldAlert}>
            <Textarea
              id="allergies"
              name="allergies"
              defaultValue={patient?.allergies ?? ""}
              placeholder="Medications, food, latex..."
              rows={3}
            />
          </Field>
          <Field id="contraindications" label="Contraindications">
            <Textarea
              id="contraindications"
              name="contraindications"
              defaultValue={patient?.contraindications ?? ""}
              placeholder="Medication or clinical restrictions."
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === "edit" ? "Save changes" : "Create patient"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  icon: Icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
