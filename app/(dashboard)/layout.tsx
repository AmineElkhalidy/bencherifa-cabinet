import { requireAuth } from "@/lib/auth/rbac";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="flex h-svh w-full bg-background text-foreground">
      <Sidebar role={session.role} className="hidden md:flex" />
      <div className="flex h-full min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
