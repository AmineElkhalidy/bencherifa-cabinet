import { notFound } from "next/navigation";

import { Header } from "@/components/layout/header";
import { PatientForm } from "@/components/patients/patient-form";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const metadata = { title: "Edit patient" };

export default async function EditPatientPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await requireRole("RECEPTIONIST", "DOCTOR");
  const isDoctor = session.role === "DOCTOR";
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title={`Edit ${patient.name}`}
        description="Update the patient record. Changes are tracked with timestamps."
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          <PatientForm
            mode="edit"
            canEditMedicalHistory={isDoctor}
            patient={{
              id: patient.id,
              name: patient.name,
              age: patient.age,
              gender: patient.gender,
              phoneNumber: patient.phoneNumber,
              cin: patient.cin,
              insuranceProvider: patient.insuranceProvider,
              surgicalHistory: isDoctor ? patient.surgicalHistory : "",
              allergies: isDoctor ? patient.allergies : "",
              contraindications: isDoctor ? patient.contraindications : "",
            }}
          />
        </div>
      </div>
    </>
  );
}
