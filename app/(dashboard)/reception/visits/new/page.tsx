import Link from "next/link";
import { Plus } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { DEFAULT_VISIT_PRICE, type Gender } from "@/lib/constants";

import { NewVisitForm } from "./new-visit-form";

export const metadata = { title: "New visit" };

export default async function NewVisitPage(props: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await requireRole("RECEPTIONIST", "DOCTOR");
  const { patientId } = await props.searchParams;

  const patients = await prisma.patient.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      cin: true,
      phoneNumber: true,
      gender: true,
      age: true,
    },
  });

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="New visit"
        description="Select the patient and place them on the doctor's waiting list."
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {patients.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No patients</CardTitle>
                <CardDescription>
                  Create the patient record before scheduling a visit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={Plus}
                  title="No patients registered"
                  description="Register the first patient to get started."
                  action={
                    <Button asChild>
                      <Link href="/reception/patients/new">
                        <Plus className="h-4 w-4" /> New patient
                      </Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <NewVisitForm
              defaultPatientId={patientId}
              defaultPrice={DEFAULT_VISIT_PRICE}
              patients={patients.map((p) => ({
                id: p.id,
                name: p.name,
                cin: p.cin,
                phoneNumber: p.phoneNumber,
                gender: p.gender as Gender,
                age: p.age,
              }))}
            />
          )}
        </div>
      </div>
    </>
  );
}
