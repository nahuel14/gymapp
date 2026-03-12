import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { DashboardShell } from "./DashboardShell";

type UserRole = Database["public"]["Enums"]["user_role"];

type DashboardLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
};

async function getCurrentUserRole() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, last_name, role")
    .eq("id", user.id as never)
    .single();

  const typedProfile =
    profile as
      | {
          name: string | null;
          last_name: string | null;
          role: UserRole | null;
        }
      | null;

  if (!typedProfile?.role) {
    redirect("/auth?view=login");
  }

  return {
    role: typedProfile.role,
    fullName: `${typedProfile.name || ""} ${typedProfile.last_name || ""}`.trim(),
  };
}

function getNavItems(role: UserRole): NavItem[] {
  const commonItems: NavItem[] = [
    { href: "/profile", label: "Mi Perfil" },
  ];

  if (role === "ADMIN") {
    return [
      { href: "/admin/dashboard", label: "Administración" },
      { href: "/coach", label: "Estudiantes" },
      { href: "/coach/templates", label: "Plantillas" },
      { href: "/coach/library", label: "Librería de ejercicios" },
      ...commonItems,
    ];
  }

  if (role === "COACH") {
    return [
      { href: "/coach", label: "Estudiantes" },
      { href: "/coach/templates", label: "Plantillas" },
      { href: "/coach/library", label: "Librería de ejercicios" },
      ...commonItems,
    ];
  }

  return [
    { href: "/student", label: "Sesión de hoy" },
    ...commonItems,
  ];
}

function getRoleLabel(role: UserRole) {
  if (role === "ADMIN") {
    return "Administrador";
  }
  if (role === "COACH") {
    return "Coach";
  }
  return "Estudiante";
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { role, fullName } = await getCurrentUserRole();
  const navItems = getNavItems(role);
  const roleLabel = getRoleLabel(role);

  return (
    <DashboardShell role={role} roleLabel={roleLabel} fullName={fullName} navItems={navItems}>
      {children}
    </DashboardShell>
  );
}
