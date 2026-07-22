"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Beaker,
  ClipboardList,
  FileSearch,
  FileText,
  HeartPulse,
  IdCard,
  Loader2,
  Phone,
  Pill,
  Printer,
  Save,
  ScanSearch,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { VisitStatusBadge } from "@/components/visits/visit-status-badge";
import {
  GENDER_LABELS,
  INSURANCE_LABELS,
  type Gender,
  type InsuranceProvider,
} from "@/lib/constants";
import { formatMAD, initialsOf } from "@/lib/utils";
import {
  completeConsultation,
  saveConsultationDraft,
  type ConsultationFormState,
} from "@/app/actions/consultations";
import { savePrescriptionDraft } from "@/app/actions/prescriptions";

import { DocumentUploader } from "./document-uploader";
import {
  ORDONNANCE_FORM_ID,
  PrescriptionEditor,
  type PrescriptionItemDraft,
} from "./prescription-editor";

type Patient = {
  id: string;
  name: string;
  age: string;
  gender: string;
  phoneNumber: string | null;
  cin: string | null;
  insuranceProvider: string;
  allergies: string;
  surgicalHistory: string;
  contraindications: string;
};

type ConsultationDoc = {
  id: string;
  fileUrl: string;
  documentType: string;
  createdAt: string;
};

type PrescriptionData = {
  prescriptionDate: string;
  items: PrescriptionItemDraft[];
};

type Consultation = {
  id: string;
  reasonForVisit: string;
  hps: string;
  rs: string;
  pe: string;
  vitals: string;
  eco: string;
  bloodWork: string;
  clinicalNotes: string;
  diagnosis: string;
  prescribedTreatment: string;
  dosageInstructions: string;
  allergiesConsidered: string;
  followUpDate: string | null;
  notes: string;
  hasCnss: boolean;
  documents: ConsultationDoc[];
  prescription: PrescriptionData | null;
};

type Visit = {
  id: string;
  date: string;
  visitType: string;
  price: number;
  status: string;
};

export function ConsultationView({
  visit,
  patient,
  consultation,
}: {
  visit: Visit;
  patient: Patient;
  consultation: Consultation | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const prescriptionFormRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("anamnese");
  const [consultationId, setConsultationId] = useState<string | null>(
    consultation?.id ?? null
  );
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const action = completeConsultation.bind(null, visit.id);

  const [state, formAction, isPending] = useActionState<
    ConsultationFormState,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Consultation saved and visit completed");
      startTransition(() => router.push("/doctor/waiting-list"));
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  async function persistPrescriptionDraft(): Promise<boolean> {
    const prescriptionForm = prescriptionFormRef.current;
    if (!prescriptionForm) return true;

    const result = await savePrescriptionDraft(
      visit.id,
      new FormData(prescriptionForm)
    );

    if (result?.error) {
      toast.error(result.error);
      return false;
    }

    if (result?.ok && result.consultationId) {
      setConsultationId(result.consultationId);
    }

    return true;
  }

  function prescriptionFormHasMedications(): boolean {
    const form = prescriptionFormRef.current;
    if (!form) return false;

    const data = new FormData(form);
    for (let i = 0; ; i++) {
      const medication = data.get(`items[${i}].medication`);
      if (medication === null) break;
      if (String(medication).trim()) return true;
    }
    return false;
  }

  async function handlePrintPrescription() {
    if (!prescriptionFormHasMedications()) {
      toast.error("Add at least one medication before printing.");
      return;
    }

    setIsPrinting(true);
    try {
      const saved = await persistPrescriptionDraft();
      if (!saved) return;

      window.open(
        `/doctor/consultations/${visit.id}/prescription`,
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setIsPrinting(false);
    }
  }

  async function handleTabChange(next: string) {
    if (next === activeTab) return;

    setIsSavingDraft(true);
    try {
      if (activeTab === "ordonnance") {
        const saved = await persistPrescriptionDraft();
        if (!saved) return;
      }

      const form = formRef.current;
      if (form) {
        const result = await saveConsultationDraft(
          visit.id,
          new FormData(form)
        );
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        if (result?.consultationId) {
          setConsultationId(result.consultationId);
        }
      }

      setActiveTab(next);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleComplete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (activeTab === "ordonnance") {
      setIsSavingDraft(true);
      try {
        const prescriptionOk = await persistPrescriptionDraft();
        if (!prescriptionOk) return;
      } finally {
        setIsSavingDraft(false);
      }
    }

    const form = formRef.current;
    if (!form) return;

    startTransition(() => {
      formAction(new FormData(form));
    });
  }

  const initial = consultation;
  const isBusy = isPending || isSavingDraft || isPrinting;
  const showPrintPrescription = activeTab === "ordonnance";

  return (
    <>
      <form
        id={ORDONNANCE_FORM_ID}
        ref={prescriptionFormRef}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <form
        ref={formRef}
        onSubmit={handleComplete}
        className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]"
      >
        <PatientPane patient={patient} visit={visit} />

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Consultation file
                </CardTitle>
                <CardDescription>
                  Document the visit step by step. Drafts auto-save when you
                  switch tabs.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">
                  {new Date(visit.date).toLocaleDateString("en-US")}
                </Badge>
                <Badge variant="muted">{visit.visitType}</Badge>
                <VisitStatusBadge status={visit.status} />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <CardHeader className="space-y-4">
                <div className="space-y-1.5">
                  <CardTitle>Clinical workspace</CardTitle>
                  <CardDescription>
                    Move through the tabs to capture history, examination,
                    diagnosis, prescription, and attached documents.
                  </CardDescription>
                </div>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
                  <TabsTrigger value="anamnese" className="gap-2 py-2">
                    <ClipboardList className="h-4 w-4" /> History
                  </TabsTrigger>
                  <TabsTrigger value="exam" className="gap-2 py-2">
                    <Stethoscope className="h-4 w-4" /> Exam
                  </TabsTrigger>
                  <TabsTrigger value="paraclinic" className="gap-2 py-2">
                    <Beaker className="h-4 w-4" /> Tests
                  </TabsTrigger>
                  <TabsTrigger value="diagnosis" className="gap-2 py-2">
                    <FileSearch className="h-4 w-4" /> Diagnosis
                  </TabsTrigger>
                  <TabsTrigger value="ordonnance" className="gap-2 py-2">
                    <FileText className="h-4 w-4" /> Ordonnance
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="gap-2 py-2">
                    <ScanSearch className="h-4 w-4" /> Documents
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="space-y-5 border-t border-border pt-6">
                <TabsContent
                  value="anamnese"
                  forceMount
                  className="mt-0 space-y-5 data-[state=inactive]:hidden"
                >
                  <Field
                    label="Reason for visit"
                    hint="Main complaint reported by the patient."
                  >
                    <Textarea
                      name="reasonForVisit"
                      rows={3}
                      defaultValue={initial?.reasonForVisit ?? ""}
                      placeholder="Ex. Epigastric abdominal pain for 3 days..."
                    />
                  </Field>
                  <Field
                    label="HPI — History of Present Illness"
                    hint="Onset, character, intensity, aggravating and relieving factors."
                  >
                    <Textarea
                      name="hps"
                      rows={6}
                      defaultValue={initial?.hps ?? ""}
                      placeholder="Describe the chronological course of symptoms..."
                    />
                  </Field>
                  <Field
                    label="ROS — Review of Systems"
                    hint="Review the main organ systems."
                  >
                    <Textarea
                      name="rs"
                      rows={5}
                      defaultValue={initial?.rs ?? ""}
                      placeholder="Cardiovascular, respiratory, digestive, neurological..."
                    />
                  </Field>
                </TabsContent>

                <TabsContent
                  value="exam"
                  forceMount
                  className="mt-0 space-y-5 data-[state=inactive]:hidden"
                >
                  <Field
                    label="Vital signs"
                    hint="BP, HR, temperature, RR, SpO2, weight, height, BMI."
                    icon={HeartPulse}
                  >
                    <Textarea
                      name="vitals"
                      rows={3}
                      defaultValue={initial?.vitals ?? ""}
                      placeholder="BP 130/80 · HR 78 bpm · Temp 37.2 C · SpO2 98% · Weight 72 kg"
                    />
                  </Field>
                  <Field
                    label="PE — Physical Examination"
                    hint="Inspection, palpation, percussion, and auscultation by system."
                    icon={Activity}
                  >
                    <Textarea
                      name="pe"
                      rows={6}
                      defaultValue={initial?.pe ?? ""}
                      placeholder="General condition preserved, conjunctiva not pale, abdomen soft..."
                    />
                  </Field>
                </TabsContent>

                <TabsContent
                  value="paraclinic"
                  forceMount
                  className="mt-0 space-y-5 data-[state=inactive]:hidden"
                >
                  <Field
                    label="Ultrasound / Imaging"
                    hint="Summary of available imaging exams."
                    icon={ScanSearch}
                  >
                    <Textarea
                      name="eco"
                      rows={4}
                      defaultValue={initial?.eco ?? ""}
                      placeholder="Abdominal ultrasound: no stones, homogeneous liver..."
                    />
                  </Field>
                  <Field
                    label="Blood work / Laboratory"
                    hint="Key lab findings."
                    icon={Beaker}
                  >
                    <Textarea
                      name="bloodWork"
                      rows={4}
                      defaultValue={initial?.bloodWork ?? ""}
                      placeholder="Normal CBC, CRP 6 mg/L, glucose 0.92 g/L..."
                    />
                  </Field>
                  <Field
                    label="Additional clinical notes"
                    icon={ClipboardList}
                  >
                    <Textarea
                      name="clinicalNotes"
                      rows={4}
                      defaultValue={initial?.clinicalNotes ?? ""}
                      placeholder="Additional observations, hypotheses, decisions..."
                    />
                  </Field>
                </TabsContent>

                <TabsContent
                  value="diagnosis"
                  forceMount
                  className="mt-0 space-y-5 data-[state=inactive]:hidden"
                >
                  <Field
                    label="Diagnostic"
                    hint="Main diagnosis and differentials."
                    icon={FileSearch}
                  >
                    <Input
                      name="diagnosis"
                      defaultValue={initial?.diagnosis ?? ""}
                      placeholder="Ex. Acute gastritis"
                    />
                  </Field>
                  <Field
                    label="Prescribed treatment"
                    hint="Medication and base dosages."
                    icon={Pill}
                  >
                    <Textarea
                      name="prescribedTreatment"
                      rows={4}
                      defaultValue={initial?.prescribedTreatment ?? ""}
                      placeholder="Omeprazole 20 mg, 1 tablet/day for 14 days..."
                    />
                  </Field>
                  <Field
                    label="Dosage & detailed instructions"
                    hint="Administration advice, duration, warning signs."
                  >
                    <Textarea
                      name="dosageInstructions"
                      rows={3}
                      defaultValue={initial?.dosageInstructions ?? ""}
                      placeholder="On an empty stomach, 30 minutes before breakfast..."
                    />
                  </Field>
                  <Field
                    label="Allergies considered"
                    icon={AlertTriangle}
                  >
                    <Textarea
                      name="allergiesConsidered"
                      rows={2}
                      defaultValue={initial?.allergiesConsidered ?? ""}
                      placeholder="Penicillin avoided — allergic patient."
                    />
                  </Field>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Follow-up date">
                      <Input
                        name="followUpDate"
                        type="date"
                        defaultValue={
                          initial?.followUpDate
                            ? initial.followUpDate.slice(0, 10)
                            : ""
                        }
                      />
                    </Field>
                    <Field label="Coverage" icon={Sparkles}>
                      <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm">
                        <Checkbox
                          name="hasCnss"
                          defaultChecked={initial?.hasCnss ?? false}
                        />
                        <span>CNSS / mutual coverage</span>
                      </label>
                    </Field>
                  </div>
                  <Field
                    label="Additional notes"
                    hint="Visible only to the doctor in archives."
                  >
                    <Textarea
                      name="notes"
                      rows={3}
                      defaultValue={initial?.notes ?? ""}
                    />
                  </Field>
                </TabsContent>

                <TabsContent
                  value="ordonnance"
                  forceMount
                  className="mt-0 space-y-5 data-[state=inactive]:hidden"
                >
                  <PrescriptionEditor
                    visitId={visit.id}
                    patientName={patient.name}
                    initialDate={
                      initial?.prescription?.prescriptionDate?.slice(0, 10) ??
                      new Date().toISOString().slice(0, 10)
                    }
                    initialItems={initial?.prescription?.items ?? []}
                    onPrint={handlePrintPrescription}
                    isPrinting={isPrinting}
                  />
                </TabsContent>

                <TabsContent
                  value="documents"
                  forceMount
                  className="mt-0 space-y-5 data-[state=inactive]:hidden"
                >
                  <DocumentUploader
                    consultationId={consultationId}
                    initialDocuments={initial?.documents ?? []}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-muted-foreground md:max-w-xl">
              Notes and prescription save when you switch tabs. Print the
              ordonnance anytime — completing the visit is not required. Mark
              the visit as{" "}
              <span className="font-semibold text-success">Completed</span>{" "}
              when finished.
              {isSavingDraft ? (
                <span className="ml-2 inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/doctor/waiting-list")}
                disabled={isBusy}
              >
                Cancel
              </Button>
              {showPrintPrescription ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrintPrescription}
                  disabled={isBusy}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Print prescription
                </Button>
              ) : null}
              <Button type="submit" size="lg" disabled={isBusy}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Complete consultation
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

function PatientPane({ patient, visit }: { patient: Patient; visit: Visit }) {
  return (
    <aside className="space-y-6 xl:sticky xl:top-6">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {initialsOf(patient.name)}
          </div>
          <CardTitle className="mt-2">{patient.name}</CardTitle>
          <CardDescription>
            {GENDER_LABELS[patient.gender as Gender] ?? patient.gender} ·{" "}
            {patient.age}
          </CardDescription>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <VisitStatusBadge status={visit.status} />
            <Badge variant="muted">{visit.visitType}</Badge>
            <Badge variant="muted">{formatMAD(visit.price)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow
            icon={Phone}
            label="Phone"
            value={patient.phoneNumber || "—"}
          />
          <InfoRow
            icon={IdCard}
            label="CIN"
            value={patient.cin || "—"}
            mono
          />
          <InfoRow
            icon={ShieldCheck}
            label="Insurance"
            value={
              <Badge variant="muted">
                {INSURANCE_LABELS[
                  patient.insuranceProvider as InsuranceProvider
                ] ?? patient.insuranceProvider}
              </Badge>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Critical history
          </CardTitle>
          <CardDescription>
            Allergies, surgical history, and contraindications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <HistoryBlock
            icon={Syringe}
            title="Allergies"
            value={patient.allergies}
          />
          <HistoryBlock
            icon={Scissors}
            title="Surgical history"
            value={patient.surgicalHistory}
          />
          <HistoryBlock
            icon={ShieldAlert}
            title="Contraindications"
            value={patient.contraindications}
          />
        </CardContent>
      </Card>
    </aside>
  );
}

function Field({
  label,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div
          className={`text-sm font-medium text-foreground ${mono ? "font-mono uppercase" : ""}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function HistoryBlock({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  const has = !!value?.trim();
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p
        className={`text-sm whitespace-pre-line ${has ? "text-foreground" : "text-muted-foreground"}`}
      >
        {has ? value : "—"}
      </p>
    </div>
  );
}
