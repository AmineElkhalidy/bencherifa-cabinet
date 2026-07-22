"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

import {
  changeOwnPassword,
  type ProfileActionState,
} from "@/app/actions/profile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/date";
import { initialsOf } from "@/lib/utils";

export type ProfileData = {
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export function ProfileSettings({ profile }: { profile: ProfileData }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <AccountCard profile={profile} />
      <ChangePasswordCard />
    </div>
  );
}

function AccountCard({ profile }: { profile: ProfileData }) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Compte
        </CardTitle>
        <CardDescription>
          Vos identifiants et votre rôle. Contactez un docteur pour changer de rôle ou
          réinitialiser le mot de passe d'un autre utilisateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-base">
              {initialsOf(profile.username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-lg font-semibold">{profile.username}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{ROLE_LABELS[profile.role]}</Badge>
              {profile.role === "DOCTOR" ? (
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
              ) : null}
            </div>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <dt className="text-muted-foreground">Nom d'utilisateur</dt>
            <dd className="font-medium">{profile.username}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <dt className="text-muted-foreground">Rôle</dt>
            <dd className="font-medium">{ROLE_LABELS[profile.role]}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <dt className="text-muted-foreground">Membre depuis</dt>
            <dd className="text-right font-medium">
              {formatDateTime(profile.createdAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Dernière mise à jour</dt>
            <dd className="text-right font-medium">
              {formatRelative(profile.updatedAt)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ProfileActionState,
    FormData
  >(changeOwnPassword, null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Mot de passe mis à jour");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Changer le mot de passe
        </CardTitle>
        <CardDescription>
          Saisissez votre mot de passe actuel, puis choisissez-en un nouveau (au moins 8
          caractères). Vous resterez connecté après l'enregistrement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-md space-y-5" noValidate>
          <PasswordField
            id="currentPassword"
            name="currentPassword"
            label="Mot de passe actuel"
            autoComplete="current-password"
            show={showCurrent}
            onToggle={() => setShowCurrent((s) => !s)}
            error={state?.fieldErrors?.currentPassword?.[0]}
          />
          <PasswordField
            id="newPassword"
            name="newPassword"
            label="Nouveau mot de passe"
            autoComplete="new-password"
            show={showNew}
            onToggle={() => setShowNew((s) => !s)}
            error={state?.fieldErrors?.newPassword?.[0]}
          />
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmer le nouveau mot de passe"
            autoComplete="new-password"
            show={showConfirm}
            onToggle={() => setShowConfirm((s) => !s)}
            error={state?.fieldErrors?.confirmPassword?.[0]}
          />

          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {isPending ? "Enregistrement..." : "Mettre à jour le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  show,
  onToggle,
  error,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="pr-11"
          aria-invalid={!!error}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          tabIndex={-1}
        >
          {show ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
