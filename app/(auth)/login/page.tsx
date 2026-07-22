import type { Metadata } from "next";
import { Lock } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-background px-4 py-8 sm:px-6 md:px-8 lg:px-10">
      <section className="w-full max-w-sm space-y-8 sm:max-w-md md:max-w-lg">
        <BrandMark className="justify-center" size="lg" />

        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Lock className="h-3.5 w-3.5" /> Espace sécurisé
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Bienvenue</h1>
          <p className="text-sm text-muted-foreground">
            Connectez-vous avec les identifiants fournis par la clinique.
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-muted-foreground">
          Si vous rencontrez des problèmes de connexion, veuillez contacter le médecin responsable de la
          clinique.
        </p>
      </section>
    </main>
  );
}
