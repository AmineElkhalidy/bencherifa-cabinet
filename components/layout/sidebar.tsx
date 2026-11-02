"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  Banknote,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export const RECEPTION_ITEMS: NavItem[] = [
  { href: "/reception", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/reception/patients", label: "Patients", icon: Users },
  {
    href: "/reception/visits/new",
    label: "Nouvelle visite",
    icon: CalendarPlus,
  },
];

export const DOCTOR_ITEMS: NavItem[] = [
  { href: "/doctor", label: "Tableau de bord", icon: LayoutDashboard },
  {
    href: "/doctor/waiting-list",
    label: "Salle d'attente",
    icon: ClipboardList,
  },
  { href: "/doctor/archives", label: "Archives", icon: Archive },
  { href: "/doctor/analytics", label: "Analytique", icon: Activity },
  {
    href: "/doctor/expenses",
    label: "Dépenses",
    icon: Banknote,
  },
  { href: "/reception/patients", label: "Patients", icon: Users },
];

export const SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings/users", label: "Utilisateurs", icon: UserCog },
  { href: "/settings/backups", label: "Sauvegardes", icon: Settings },
];

export function Sidebar({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const primary = role === "DOCTOR" ? DOCTOR_ITEMS : RECEPTION_ITEMS;
  const showSettings = role === "DOCTOR";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setIsCollapsed(localStorage.getItem("cabinet-sidebar") === "collapsed");
      } catch {
        // localStorage can be unavailable in locked-down browsers.
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    setIsCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(
          "cabinet-sidebar",
          next ? "collapsed" : "expanded",
        );
      } catch {
        // Preference persistence is optional.
      }
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-64",
          className,
        )}
      >
        <div
          className={cn(
            "relative flex items-center gap-2 pt-6",
            isCollapsed ? "justify-center px-3" : "justify-between px-5",
          )}
        >
          <BrandMark compact={isCollapsed} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className={cn(
                  "h-9 w-9 text-muted-foreground hover:text-sidebar-foreground",
                  isCollapsed &&
                    "absolute left-[3.45rem] top-6 z-10 h-7 w-7 rounded-full border border-sidebar-border bg-sidebar shadow-sm",
                )}
                aria-label={
                  isCollapsed
                    ? "Agrandir le menu"
                    : "Réduire le menu"
                }
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Agrandir" : "Réduire"}
            </TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "mx-3 mt-2 rounded-lg bg-sidebar-accent/60 px-3 py-2",
                isCollapsed && "mx-auto grid h-10 w-10 place-items-center px-0",
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <Stethoscope className="h-3.5 w-3.5 text-sidebar-primary" />
                <span
                  className={cn(
                    "font-medium uppercase tracking-wider text-sidebar-primary",
                    isCollapsed && "sr-only",
                  )}
                >
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          {isCollapsed ? (
            <TooltipContent side="right">{ROLE_LABELS[role]}</TooltipContent>
          ) : null}
        </Tooltip>

        <nav
          className={cn(
            "mt-4 flex-1 space-y-1 overflow-y-auto pb-4 scrollbar-thin",
            isCollapsed ? "px-2" : "px-3",
          )}
        >
          <SectionLabel collapsed={isCollapsed}>Navigation</SectionLabel>
          {primary.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={isCollapsed}
            />
          ))}

          {showSettings ? (
            <>
              <div className="my-3 border-t border-sidebar-border" />
              <SectionLabel collapsed={isCollapsed}>
                Administration
              </SectionLabel>
              {SETTINGS_ITEMS.map((item) => (
                <NavItemLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={isCollapsed}
                />
              ))}
            </>
          ) : null}
        </nav>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "mx-3 mb-4 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-muted-foreground",
                isCollapsed && "mx-auto grid h-10 w-10 place-items-center p-0",
              )}
            >
              {isCollapsed ? (
                <ShieldCheck className="h-4 w-4 text-sidebar-primary" />
              ) : (
                <>
                  <p className="font-medium text-sidebar-foreground">
                    Données protégées
                  </p>
                  <p className="mt-1 leading-snug">
                    Toutes les informations cliniques sont stockées sur le volume Docker dédié.
                  </p>
                </>
              )}
            </div>
          </TooltipTrigger>
          {isCollapsed ? (
            <TooltipContent side="right">Données protégées</TooltipContent>
          ) : null}
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}

function SectionLabel({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <div
      className={cn(
        "px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        collapsed && "sr-only",
      )}
    >
      {children}
    </div>
  );
}

function NavItemLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== "/reception" &&
      item.href !== "/doctor" &&
      pathname.startsWith(item.href));

  const link = (
    <Link
      href={item.href}
      aria-label={item.label}
      className={cn(
        "group flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-sidebar-primary-foreground"
            : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
        )}
      />
      <span className={cn("truncate", collapsed && "sr-only")}>
        {item.label}
      </span>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
