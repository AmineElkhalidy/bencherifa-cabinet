import { Header } from "@/components/layout/header";
import { UsersAdmin, type UserRow } from "@/components/users/users-admin";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/constants";

export const metadata = { title: "Users" };

export default async function UsersSettingsPage() {
  const session = await requireRole("DOCTOR");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role as Role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="User management"
        description="Create clinic accounts, assign roles, and reset passwords."
      />
      <div className="flex-1 overflow-auto p-6">
        <UsersAdmin users={rows} currentUserId={session.userId} />
      </div>
    </>
  );
}
