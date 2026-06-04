"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell,
  LayoutDashboard,
  UserCircle,
  Users,
  ClipboardList,
  Library,
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

// Función centralizada para saber qué pestaña está activa
function checkIsActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  
  // Regla especial para "Alumnos" (porque es la ruta raíz /coach)
  if (href === "/coach") {
    return pathname === "/coach" || pathname.startsWith("/coach/student");
  }
  
  // Regla especial para Perfil (para que no se active accidentalmente)
  if (href === "/profile") {
    return pathname === "/profile";
  }

  // Para el resto (plantillas, librería, student, admin, etc.)
  return pathname === href || pathname.startsWith(href + "/");
}

function NavIcon({ href, role }: { href: string; role: UserRole }) {
  const iconClass = "h-4 w-4";
  
  if (href === "/admin/dashboard") {
    return <LayoutDashboard className={iconClass} />;
  }
  if ((role === "COACH" || role === "ADMIN") && href === "/coach") {
    return <Users className={iconClass} />;
  }
  if ((role === "COACH" || role === "ADMIN") && href === "/coach/templates") {
    return <ClipboardList className={iconClass} />;
  }
  if ((role === "COACH" || role === "ADMIN") && href === "/coach/library") {
    return <Library className={iconClass} />;
  }
  if (role === "STUDENT" && href === "/student") {
    return <Dumbbell className={iconClass} />;
  }
  if (href === "/profile") {
    return <UserCircle className={iconClass} />;
  }
  return null;
}

function SidebarContent({
  fullName,
  navItems,
  role,
  roleLabel,
}: {
  fullName: string;
  navItems: NavItem[];
  role: UserRole;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="mb-8 flex items-center gap-2">
        <Dumbbell className="h-6 w-6 text-yellow-400" />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-zinc-100">Gymapp</p>
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">{roleLabel}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = checkIsActive(pathname, item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                isActive 
                  ? "bg-yellow-400/10 text-yellow-400" 
                  : "text-zinc-400 hover:bg-yellow-400/10 hover:text-yellow-400"
              }`}
            >
              <NavIcon href={item.href} role={role} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Sesión
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-100">
          {fullName || "Usuario"}
        </p>
      </div>
    </>
  );
}

type BottomNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

function getBottomNavItems(role: UserRole): BottomNavItem[] {
  const coachAdminItems = [
    {
      href: "/coach",
      label: "Estudiantes",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/coach/templates",
      label: "Plantillas",
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      href: "/coach/library",
      label: "Biblioteca",
      icon: <Library className="h-5 w-5" />,
    },
    {
      href: "/profile",
      label: "Perfil",
      icon: <UserCircle className="h-5 w-5" />,
    },
  ];

  if (role === "ADMIN") {
    return [
      {
        href: "/admin/dashboard",
        label: "Admin",
        icon: <LayoutDashboard className="h-5 w-5" />,
      },
      ...coachAdminItems,
    ];
  }

  if (role === "COACH") {
    return coachAdminItems;
  }

  return [
    {
      href: "/student",
      label: "Rutina",
      icon: <Dumbbell className="h-6 w-6" />,
    },
    {
      href: "/profile",
      label: "Perfil",
      icon: <UserCircle className="h-6 w-6" />,
    },
  ];
}

function BottomNavigation({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const navItems = getBottomNavItems(role);

  return (
    <nav className="w-full shrink-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex w-full items-center justify-between px-1">
        {navItems.map((item) => {
          const isActive = checkIsActive(pathname, item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all active:scale-95 overflow-hidden"
            >
              <div className={`transition-all duration-200 ${
                isActive ? "text-yellow-400 scale-110" : "text-zinc-500"
              }`}>
                {item.icon}
              </div>
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all duration-200 truncate w-full text-center px-0.5 ${
                isActive ? "text-yellow-400" : "text-zinc-500"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DashboardShell({ children, fullName, navItems, role, roleLabel }: DashboardShellProps) {
  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-zinc-950">
      
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 px-4 py-6 md:flex">
        <SidebarContent fullName={fullName} navItems={navItems} role={role} roleLabel={roleLabel} />
      </aside>

      {/* Área Principal y Barra Inferior */}
      <div className="flex flex-1 flex-col min-w-0 h-dvh">
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950 relative">
          {children}
        </main>
        <BottomNavigation role={role} />
      </div>
    </div>
  );
}

