"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { initialsOf } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

type Props = {
  username: string;
  role: Role;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function Header({ username, role, title, description, actions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Déconnexion réussie");
        router.replace("/login");
        router.refresh();
      } else {
        toast.error("Impossible de se déconnecter");
      }
    });
  }

  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.classList.toggle("dark");
    try {
      localStorage.setItem("cabinet-theme", isDark ? "dark" : "light");
    } catch {
      // localStorage may be disabled — ignore
    }
  }

  return (
    <header className="app-dashboard-header flex flex-col gap-4 border-b border-border bg-card/60 px-6 py-5 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>{APP_CONFIG.clinicName}</span>
          <span aria-hidden>•</span>
          <Badge variant="muted" className="rounded-md px-2 py-0.5 text-[10px]">
            {ROLE_LABELS[role]}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Changer le thème"
          onClick={toggleTheme}
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-full border border-border bg-card pl-1 pr-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initialsOf(username)}</AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left sm:flex">
                <span className="text-xs font-semibold leading-none">
                  {username}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {role === "DOCTOR" && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              disabled={isPending}
              onSelect={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{isPending ? "Déconnexion..." : "Se déconnecter"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
