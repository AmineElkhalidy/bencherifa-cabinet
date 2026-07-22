import { notFound } from "next/navigation";

import "./print.css";

import { PrescriptionSheet } from "@/components/prescription/prescription-sheet";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

import { PrescriptionPrintToolbar } from "./print-toolbar";

export const metadata = { title: "Ordonnance" };

export default async function PrescriptionPrintPage(props: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await props.params;
  await requireRole("DOCTOR");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      consultation: {
        include: {
          prescription: {
            include: {
              items: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!visit) notFound();

  const prescription = visit.consultation?.prescription;
  if (!prescription || prescription.items.length === 0) {
    notFound();
  }

  return (
    <>
      <PrescriptionPrintToolbar visitId={visitId} />
      <div className="prescription-print-page min-h-0 flex-1 overflow-auto bg-neutral-200 p-4 print:bg-white print:p-0">
        <div id="prescription-print" className="mx-auto print:max-w-none">
          <PrescriptionSheet
            mode="print"
            patientName={visit.patient.name}
            prescriptionDate={prescription.prescriptionDate}
            items={prescription.items.map((item) => ({
              medication: item.medication,
              medicationType: item.medicationType,
              duration: item.duration,
              doseMorning: item.doseMorning,
              doseNoon: item.doseNoon,
              doseEvening: item.doseEvening,
            }))}
          />
        </div>
      </div>
    </>
  );
}
