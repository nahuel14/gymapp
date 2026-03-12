"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  BookOpen,
  CalendarClock,
  Dumbbell,
  LayoutDashboard,
  LayoutTemplate,
  Menu,
  UserCircle,
  X,
} from "lucide-react";
import type { Database } from "@/types/supabase";

type UserRole = Database["public"]["Enums"]["user_role"];

type NavItem = {
  href: string;
  label: string;
};

type DashboardShellProps = {
  children: ReactNode;
  fullName: string;
  navItems: NavItem[];
  role: UserRole;
  roleLabel: string;
};

function NavIcon({ href, role }: { href: string; role: UserRole }) {
  if (href === "/admin/dashboard") {
    return <LayoutDashboard className="h-4 w-4 text-primary" />;
  }
  if ((role === "COACH" || role === "ADMIN") && href === "/coach") {
    return <CalendarClock className="h-4 w-4 text-primary" />;
  }
  if ((role === "COACH" || role === "ADMIN") && href === "/coach/templates") {
    return <LayoutTemplate className="h-4 w-4 text-primary" />;
  }
  if ((role === "COACH" || role === "ADMIN") && href === "/coach/library") {
    return <BookOpen className="h-4 w-4 text-primary" />;
  }
  if (role === "STUDENT" && href === "/student") {
    return <CalendarClock className="h-4 w-4 text-primary" />;
  }
  if (href === "/profile") {
    return <UserCircle className="h-4 w-4 text-primary" />;
  }
  return null;
}

function SidebarContent({
  fullName,
  navItems,
  role,
  roleLabel,
  onNavigate,
}: {
  fullName: string;
  navItems: NavItem[];
  role: UserRole;
  roleLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="mb-8 flex items-center gap-2">
        <Dumbbell className="h-6 w-6 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Gymapp</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
          >
            <NavIcon href={item.href} role={role} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sesión
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {fullName || "Usuario"}
        </p>
      </div>
    </>
  );
}

export function DashboardShell({ children, fullName, navItems, role, roleLabel }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <SidebarContent fullName={fullName} navItems={navItems} role={role} roleLabel={roleLabel} />
      </aside>

      <div className="flex min-h-screen w-full flex-1 flex-col">
        <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Gymapp</p>
              <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/60"
              aria-label="Cerrar menú"
            />
            <div className="absolute left-0 top-0 flex h-full w-[85%] max-w-xs flex-col border-r border-border bg-card px-4 py-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Gymapp</p>
                    <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground"
                  aria-label="Cerrar menú"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <SidebarContent
                fullName={fullName}
                navItems={navItems}
                role={role}
                roleLabel={roleLabel}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="w-full flex-1 bg-background pt-16 md:pt-0">{children}</main>
      </div>
    </div>
  );
}
