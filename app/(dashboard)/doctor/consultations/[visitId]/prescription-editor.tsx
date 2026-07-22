"use client";

import { useEffect, useId, useState } from "react";
import { Eye, Loader2, Plus, Printer, Trash2 } from "lucide-react";

import { PrescriptionSheet } from "@/components/prescription/prescription-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Inputs use the `form` attribute to link to the hidden ordonnance form (avoids nesting inside the consultation form). */
export const ORDONNANCE_FORM_ID = "consultation-ordonnance-form";

export type PrescriptionItemDraft = {
  medication: string;
  medicationType: string;
  duration: string;
  doseMorning: number;
  doseNoon: number;
  doseEvening: number;
};

const EMPTY_ITEM: PrescriptionItemDraft = {
  medication: "",
  medicationType: "",
  duration: "",
  doseMorning: 0,
  doseNoon: 0,
  doseEvening: 0,
};

const MEDICATION_TYPE_SUGGESTIONS = [
  "Comprime",
  "Gelule",
  "Sachet",
  "Sirop",
  "Suspension buvable",
  "Solution buvable",
  "Poudre",
  "Ampoule",
  "Suppositoire",
  "Creme",
  "Pommade",
  "Gel",
  "Gouttes",
  "Spray",
  "Injection",
] as const;

type MedicationSuggestion = {
  name: string;
  activeIngredient: string;
  reimbursementRate: number | null;
};

export function PrescriptionEditor({
  visitId,
  patientName,
  initialDate,
  initialItems,
  onPrint,
  isPrinting = false,
}: {
  visitId: string;
  patientName: string;
  initialDate: string;
  initialItems: PrescriptionItemDraft[];
  onPrint: () => void | Promise<void>;
  isPrinting?: boolean;
}) {
  const [items, setItems] = useState<PrescriptionItemDraft[]>(
    initialItems.length > 0 ? initialItems : [{ ...EMPTY_ITEM }]
  );
  const [prescriptionDate, setPrescriptionDate] = useState(initialDate);
  const [showPreview, setShowPreview] = useState(false);

  const formId = ORDONNANCE_FORM_ID;
  const previewItems = items.filter((item) => item.medication.trim());
  const canPrint = previewItems.length > 0;

  function updateItem(
    index: number,
    field: keyof PrescriptionItemDraft,
    value: string
  ) {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (
          field === "medication" ||
          field === "medicationType" ||
          field === "duration"
        ) {
          return { ...row, [field]: value };
        }
        const n = Math.min(9, Math.max(0, Number(value) || 0));
        return { ...row, [field]: n };
      })
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Compose the ordonnance with the same layout as your printed stationery.
          When you are done listing medications, use{" "}
          <span className="font-medium text-foreground">Print prescription</span>{" "}
          — you do not need to complete the consultation first.
        </p>
      </div>

      <div className="space-y-5">
        <input type="hidden" name="visitId" value={visitId} form={formId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prescriptionDate">Prescription date</Label>
            <Input
              id="prescriptionDate"
              name="prescriptionDate"
              form={formId}
              type="date"
              value={prescriptionDate}
              onChange={(e) => setPrescriptionDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Patient</Label>
            <Input value={patientName} readOnly className="bg-muted/50" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-semibold">Medications</Label>
            <p className="text-xs text-muted-foreground">
              Type, duration, then doses: morning · noon · evening
            </p>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-border bg-card p-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]"
              >
                <MedicationAutocompleteField
                  formId={formId}
                  index={index}
                  value={item.medication}
                  onChange={(nextValue) => updateItem(index, "medication", nextValue)}
                />
                <MedicationTypeField
                  formId={formId}
                  index={index}
                  value={item.medicationType}
                  onChange={(nextValue) =>
                    updateItem(index, "medicationType", nextValue)
                  }
                />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Duration (days)
                  </Label>
                  <Input
                    name={`items[${index}].duration`}
                    form={formId}
                    value={item.duration}
                    onChange={(e) => updateItem(index, "duration", e.target.value)}
                    placeholder="Ex. 7"
                  />
                </div>
                <DoseInputs
                  formId={formId}
                  index={index}
                  item={item}
                  onChange={updateItem}
                />
                <div className="flex items-end justify-end xl:col-span-4 xl:justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Add medication
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="default"
            onClick={onPrint}
            disabled={!canPrint || isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print prescription
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowPreview((v) => !v)}
            disabled={!canPrint}
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide preview" : "Preview"}
          </Button>
        </div>
      </div>

      {showPreview && previewItems.length > 0 ? (
        <div className="overflow-x-auto rounded-lg bg-neutral-100 p-4 dark:bg-neutral-900">
          <PrescriptionSheet
            patientName={patientName}
            prescriptionDate={prescriptionDate}
            items={previewItems}
            mode="preview"
          />
        </div>
      ) : null}
    </div>
  );
}

function MedicationTypeField({
  formId,
  index,
  value,
  onChange,
}: {
  formId: string;
  index: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const datalistId = useId();

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Type</Label>
      <Input
        name={`items[${index}].medicationType`}
        form={formId}
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex. Comprime"
        autoComplete="off"
      />
      <datalist id={datalistId}>
        {MEDICATION_TYPE_SUGGESTIONS.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      <p className="min-h-4 text-[11px] text-muted-foreground">
        Common forms: Comprime, Gelule, Sirop, Sachet...
      </p>
    </div>
  );
}

function MedicationAutocompleteField({
  formId,
  index,
  value,
  onChange,
}: {
  formId: string;
  index: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const datalistId = useId();
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/medications/search?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load medication suggestions.");
        }

        const payload = (await response.json()) as {
          suggestions?: MedicationSuggestion[];
        };
        setSuggestions(payload.suggestions ?? []);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [value]);

  const visibleSuggestions = value.trim().length >= 2 ? suggestions : [];
  const exactMatch = visibleSuggestions.find(
    (suggestion) =>
      suggestion.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase()
  );
  const helperText = isLoadingSuggestions
    ? "Searching Morocco medication catalog..."
    : exactMatch
      ? formatMedicationSuggestionMeta(exactMatch)
      : value.trim().length >= 2 && visibleSuggestions.length === 0
        ? "No Morocco catalog suggestion found."
        : "Suggestions prioritize medications marketed in Morocco.";

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        #{index + 1} - Medication
      </Label>
      <Input
        name={`items[${index}].medication`}
        form={formId}
        list={datalistId}
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange(nextValue);
          if (nextValue.trim().length < 2) {
            setSuggestions([]);
            setIsLoadingSuggestions(false);
          }
        }}
        placeholder="Ex. Doliprane 1000 Mg"
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={datalistId}>
        {visibleSuggestions.map((suggestion) => (
          <option
            key={`${suggestion.name}-${suggestion.activeIngredient}`}
            value={suggestion.name}
          >
            {formatMedicationSuggestionMeta(suggestion)}
          </option>
        ))}
      </datalist>
      <p className="min-h-4 text-[11px] text-muted-foreground">{helperText}</p>
    </div>
  );
}

function formatMedicationSuggestionMeta(suggestion: MedicationSuggestion) {
  const parts: string[] = [];

  if (suggestion.activeIngredient) {
    parts.push(suggestion.activeIngredient);
  }

  if (suggestion.reimbursementRate !== null) {
    parts.push(`${suggestion.reimbursementRate}% CNOPS`);
  }

  return parts.join(" - ");
}

function DoseInputs({
  formId,
  index,
  item,
  onChange,
}: {
  formId: string;
  index: number;
  item: PrescriptionItemDraft;
  onChange: (
    index: number,
    field: keyof PrescriptionItemDraft,
    value: string
  ) => void;
}) {
  const fields = [
    { key: "doseMorning" as const, label: "Matin", short: "M" },
    { key: "doseNoon" as const, label: "Midi", short: "Mi" },
    { key: "doseEvening" as const, label: "Soir", short: "S" },
  ];

  return (
    <div className="flex gap-2 xl:items-end">
      {fields.map(({ key, label, short }) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </Label>
          <Input
            name={`items[${index}].${key}`}
            form={formId}
            type="number"
            min={0}
            max={9}
            className="w-14 text-center tabular-nums"
            value={item[key]}
            onChange={(e) => onChange(index, key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
