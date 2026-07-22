import { PRESCRIPTION_CABINET } from "@/lib/prescription/cabinet";
import { cn } from "@/lib/utils";

import { PrescriptionMark } from "./prescription-mark";

export type PrescriptionSheetItem = {
  medication: string;
  medicationType: string;
  duration: string;
  doseMorning: number;
  doseNoon: number;
  doseEvening: number;
};

export type PrescriptionSheetProps = {
  patientName: string;
  prescriptionDate: Date | string;
  items: PrescriptionSheetItem[];
  className?: string;
  mode?: "preview" | "print";
};

function formatTreatmentDuration(duration: string) {
  const trimmed = duration.trim();
  if (!trimmed) return "";

  const numericMatch = trimmed.match(/^(\d+)$/);
  if (numericMatch) {
    const days = Number(numericMatch[1]);
    return `(${days} ${days > 1 ? "jours" : "jour"})`;
  }

  const frenchMatch = trimmed.match(/^(\d+)\s*jour(s)?$/i);
  if (frenchMatch) {
    const days = Number(frenchMatch[1]);
    return `(${days} ${days > 1 ? "jours" : "jour"})`;
  }

  return `(${trimmed})`;
}

function formatMedicationLabel(medication: string, medicationType: string) {
  const name = medication.trim();
  const form = medicationType.trim();
  return form ? `${name} — ${form}` : name;
}

function formatPrescriptionDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

export function PrescriptionSheet({
  patientName,
  prescriptionDate,
  items,
  className,
  mode = "preview",
}: PrescriptionSheetProps) {
  const cabinet = PRESCRIPTION_CABINET;
  const isPrint = mode === "print";

  return (
    <article
      className={cn(
        "prescription-sheet relative mx-auto grid min-h-[297mm] w-full max-w-[210mm] grid-rows-[auto_1fr_auto] bg-white text-black",
        isPrint ? "shadow-none" : "shadow-lg ring-1 ring-black/10",
        className
      )}
    >
      <div
        className={cn(
          "prescription-sheet-header px-8 pt-8",
          isPrint && "px-9 pt-9"
        )}
        role="banner"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <div
            className={cn(
              "space-y-1 text-[11px] leading-snug",
              isPrint && "text-xs"
            )}
          >
            <p className={cn("text-sm font-bold tracking-wide", isPrint && "text-base")}>
              {cabinet.doctorNameFr}
            </p>
            <p className="font-semibold" style={{ color: cabinet.accentGreen }}>
              {cabinet.specialtyFr}
            </p>
            <p className={cn("text-[10px] text-neutral-700", isPrint && "text-[11px]")}>
              {cabinet.credentialsFr}
            </p>
          </div>

          <PrescriptionMark
            priority={isPrint}
            className={cn(
              "mx-auto h-[5.5rem] w-[4.9rem] shrink-0",
              isPrint && "h-[6.4rem] w-[5.8rem]"
            )}
          />

          <div
            className={cn(
              "space-y-1 text-right text-[11px] leading-snug",
              isPrint && "text-xs"
            )}
            dir="rtl"
          >
            <p className={cn("text-sm font-bold", isPrint && "text-base")}>
              {cabinet.doctorNameAr}
            </p>
            <p className="font-semibold" style={{ color: cabinet.accentGreen }}>
              {cabinet.specialtyAr}
            </p>
            <p className={cn("text-[10px] text-neutral-700", isPrint && "text-[11px]")}>
              {cabinet.credentialsAr}
            </p>
          </div>
        </div>

        <div className={cn("mt-5 flex items-center gap-3", isPrint && "mt-6")}>
          <span
            className="h-px flex-1"
            style={{ backgroundColor: cabinet.accentGreen }}
          />
          <h1
            className={cn(
              "text-center text-sm font-bold uppercase tracking-[0.2em]",
              isPrint && "text-base"
            )}
            style={{ color: cabinet.accentGreen }}
          >
            {cabinet.title}
          </h1>
          <span
            className="h-px flex-1"
            style={{ backgroundColor: cabinet.accentGreen }}
          />
        </div>

        <div
          className={cn(
            "mt-5 flex items-end justify-between gap-6 text-sm",
            isPrint && "mt-6 text-[15px]"
          )}
        >
          <p>
            <span className="font-semibold">{cabinet.location}</span>
            <span className="text-neutral-600"> le : </span>
            <span className="inline-block min-w-[5rem] border-b border-dotted border-neutral-400 font-medium">
              {formatPrescriptionDate(prescriptionDate)}
            </span>
          </p>
          <p className="flex flex-1 flex-wrap justify-end gap-1">
            <span className="font-semibold">Nom &amp; Prénom :</span>
            <span className="inline-block min-w-[12rem] border-b border-dotted border-neutral-400 font-medium">
              {patientName || "\u00a0"}
            </span>
          </p>
        </div>
      </div>

      <section className="prescription-sheet-body relative min-h-0 px-10 py-8">
        <PrescriptionMark
          watermark
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 h-[16rem] w-[13rem] -translate-x-1/2 -translate-y-1/2",
            isPrint && "h-[18rem] w-[14.5rem]"
          )}
        />

        <ol className="relative z-10 space-y-5 text-base">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-baseline gap-2 text-[15px] leading-snug"
            >
              <span className="w-6 shrink-0 font-semibold tabular-nums">
                {index + 1}.
              </span>
              <span className="shrink-0 font-medium">
                {formatMedicationLabel(item.medication, item.medicationType)}
              </span>
              <span
                className="mx-1 min-w-[2rem] flex-1 border-b border-dotted border-neutral-400"
                aria-hidden
              />
              <DoseSchedule
                morning={item.doseMorning}
                noon={item.doseNoon}
                evening={item.doseEvening}
                duration={item.duration}
              />
            </li>
          ))}
        </ol>
      </section>

      <footer
        className={cn(
          "prescription-sheet-footer border-t border-neutral-300 px-8 py-4 text-[11px] text-neutral-800",
          isPrint && "px-9 py-5 text-xs"
        )}
      >
        <p
          className={cn(
            "flex flex-wrap items-center justify-center gap-2 font-medium",
            isPrint && "text-[13px]"
          )}
        >
          <PhoneIcon />
          {cabinet.phones.join(" - ")}
        </p>
        <p
          className={cn(
            "mt-2 flex flex-wrap items-start justify-center gap-2 text-center",
            isPrint && "mt-3 text-[12px]"
          )}
        >
          <PinIcon />
          <span>
            {cabinet.addressFr}
            <br />
            <span dir="rtl" className="inline-block">
              {cabinet.addressAr}
            </span>
          </span>
        </p>
      </footer>
    </article>
  );
}

function DoseSchedule({
  morning,
  noon,
  evening,
  duration,
}: {
  morning: number;
  noon: number;
  evening: number;
  duration: string;
}) {
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-right text-sm font-semibold text-neutral-800">
      <span className="whitespace-nowrap tabular-nums">
        {morning} - {noon} - {evening}
      </span>
      {formatTreatmentDuration(duration) ? (
        <span className="whitespace-nowrap text-xs font-medium text-neutral-600">
          {formatTreatmentDuration(duration)}
        </span>
      ) : null}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      style={{ color: PRESCRIPTION_CABINET.accentGreen }}
      fill="currentColor"
      aria-hidden
    >
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-3.5 w-3.5 shrink-0"
      style={{ color: PRESCRIPTION_CABINET.accentGreen }}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z" />
    </svg>
  );
}
