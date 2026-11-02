import { Header } from "@/components/layout/header";
import {
  PatientsTable,
  type PatientRow,
} from "@/components/patients/patients-table";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const metadata = { title: "Patients" };

export default async function PatientsListPage() {
  const session = await requireRole("RECEPTIONIST", "DOCTOR");

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      phoneNumber: true,
      cin: true,
      insuranceProvider: true,
      createdAt: true,
      _count: { select: { visits: true } },
    },
  });

  const rows: PatientRow[] = patients.map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    phoneNumber: p.phoneNumber,
    cin: p.cin,
    insuranceProvider: p.insuranceProvider,
    createdAt: p.createdAt.toISOString(),
    visitCount: p._count.visits,
  }));

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Patients"
        description={`${patients.length} patient(s) total. Search by name, CIN, or phone.`}
      />
      <div className="flex-1 overflow-auto p-6">
        <PatientsTable patients={rows} canDelete={session.role === "DOCTOR"} />
      </div>
    </>
  );
}
