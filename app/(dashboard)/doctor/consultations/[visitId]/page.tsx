import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ConsultationView } from "./consultation-view";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const metadata = { title: "Consultation" };

export default async function ConsultationPage(props: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await props.params;
  const session = await requireRole("DOCTOR");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      consultation: {
        include: {
          documents: { orderBy: { createdAt: "desc" } },
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

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title={`Consultation — ${visit.patient.name}`}
        description={`Visit on ${visit.date.toLocaleDateString("en-US")} · ${visit.visitType}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/doctor/waiting-list">
              <ArrowLeft className="h-4 w-4" /> Waiting list
            </Link>
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <ConsultationView
          visit={{
            id: visit.id,
            date: visit.date.toISOString(),
            visitType: visit.visitType,
            price: visit.price,
            status: visit.status,
          }}
          patient={{
            id: visit.patient.id,
            name: visit.patient.name,
            age: visit.patient.age,
            gender: visit.patient.gender,
            phoneNumber: visit.patient.phoneNumber,
            cin: visit.patient.cin,
            insuranceProvider: visit.patient.insuranceProvider,
            allergies: visit.patient.allergies,
            surgicalHistory: visit.patient.surgicalHistory,
            contraindications: visit.patient.contraindications,
          }}
          consultation={
            visit.consultation
              ? {
                  id: visit.consultation.id,
                  reasonForVisit: visit.consultation.reasonForVisit,
                  hps: visit.consultation.hps,
                  rs: visit.consultation.rs,
                  pe: visit.consultation.pe,
                  vitals: visit.consultation.vitals,
                  eco: visit.consultation.eco,
                  bloodWork: visit.consultation.bloodWork,
                  clinicalNotes: visit.consultation.clinicalNotes,
                  diagnosis: visit.consultation.diagnosis,
                  prescribedTreatment: visit.consultation.prescribedTreatment,
                  dosageInstructions: visit.consultation.dosageInstructions,
                  allergiesConsidered: visit.consultation.allergiesConsidered,
                  followUpDate:
                    visit.consultation.followUpDate?.toISOString() ?? null,
                  notes: visit.consultation.notes,
                  hasCnss: visit.consultation.hasCnss,
                  documents: visit.consultation.documents.map((d) => ({
                    id: d.id,
                    fileUrl: d.fileUrl,
                    documentType: d.documentType,
                    createdAt: d.createdAt.toISOString(),
                  })),
                  prescription: visit.consultation.prescription
                    ? {
                        prescriptionDate:
                          visit.consultation.prescription.prescriptionDate.toISOString(),
                        items: visit.consultation.prescription.items.map(
                          (item) => ({
                            medication: item.medication,
                            medicationType: item.medicationType,
                            duration: item.duration,
                            doseMorning: item.doseMorning,
                            doseNoon: item.doseNoon,
                            doseEvening: item.doseEvening,
                          })
                        ),
                      }
                    : null,
                }
              : null
          }
        />
      </div>
    </>
  );
}
