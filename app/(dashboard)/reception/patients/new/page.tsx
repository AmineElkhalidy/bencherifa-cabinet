import { Header } from "@/components/layout/header";
import { PatientForm } from "@/components/patients/patient-form";
import { requireRole } from "@/lib/auth/rbac";

export const metadata = { title: "New patient" };

export default async function NewPatientPage() {
  const session = await requireRole("RECEPTIONIST", "DOCTOR");

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="New patient"
        description="Register a patient in seconds. Medical history can be completed later."
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          <PatientForm
            mode="create"
            canEditMedicalHistory={session.role === "DOCTOR"}
          />
        </div>
      </div>
    </>
  );
}
