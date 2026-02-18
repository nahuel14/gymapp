import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Dumbbell, BookOpen, CalendarClock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

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
    .select("full_name, role")
    .eq("id", user.id as never)
    .single();

  const typedProfile =
    profile as
      | {
          full_name: string | null;
          role: UserRole | null;
        }
      | null;

  if (!typedProfile?.role) {
    redirect("/auth?view=login");
  }

  return {
    role: typedProfile.role,
    fullName: typedProfile.full_name ?? "",
  };
}

function getNavItems(role: UserRole): NavItem[] {
  if (role === "COACH") {
    return [
      { href: "/coach", label: "Estudiantes" },
      { href: "/coach/library", label: "Librería de ejercicios" },
    ];
  }

  return [{ href: "/student", label: "Sesión de hoy" }];
}

function getRoleLabel(role: UserRole) {
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

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-border bg-card px-4 py-6">
        <div className="mb-8 flex items-center gap-2">
          <Dumbbell className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Gymapp</p>
            <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
            >
              {role === "COACH" && item.href === "/coach" ? (
                <CalendarClock className="h-4 w-4 text-primary" />
              ) : null}
              {role === "COACH" && item.href === "/coach/library" ? (
                <BookOpen className="h-4 w-4 text-primary" />
              ) : null}
              {role === "STUDENT" && item.href === "/student" ? (
                <CalendarClock className="h-4 w-4 text-primary" />
              ) : null}
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
      </aside>

      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
