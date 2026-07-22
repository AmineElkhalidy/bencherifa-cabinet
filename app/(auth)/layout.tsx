import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (session) {
    redirect(session.role === "DOCTOR" ? "/doctor" : "/reception");
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[26rem] w-[26rem] rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border/60" />
      </div>
      {children}
    </main>
  );
}
