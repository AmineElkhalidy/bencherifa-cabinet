import { Header } from "@/components/layout/header";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { requireAuth } from "@/lib/auth/rbac";
import type { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error("Utilisateur connecté introuvable dans la base de données.");
  }

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Mon profil"
        description="Consultez les détails de votre compte et mettez à jour votre mot de passe."
      />
      <div className="flex-1 overflow-auto p-6">
        <ProfileSettings
          profile={{
            username: user.username,
            role: user.role as Role,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          }}
        />
      </div>
    </>
  );
}
