"use client";

import { useState, useTransition, useEffect } from "react";
import {
  UserPlus, Mail, X, Search, Square, CheckSquare,
  Pencil, Save, Loader2, Trash2, Users, User, ShieldCheck,
} from "lucide-react";
import { DumbbellIcon } from "@/components/DumbbellIcon";
import type { Tables, Database } from "@/types/supabase";
import {
  inviteUser,
  assignCoachToStudent,
  removeCoachFromStudent,
  updateUserAsAdmin,
  deleteUser,
  getUserDeleteSummary,
} from "@/app/actions/admin";
import { buildDeleteSummary } from "@/lib/admin/delete";
import { useRouter } from "next/navigation";

type UserRole = Database["public"]["Enums"]["user_role"];
type Profile = Tables<"profiles">;

type AdminDashboardClientProps = {
  profiles: Profile[];
  assignments: { coach_id: string; student_id: string }[];
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  COACH: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  STUDENT: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  COACH: "Coach",
  STUDENT: "Estudiante",
};

export function AdminDashboardClient({
  profiles,
  assignments: initialAssignments,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");

  // Optimistic local assignments (keeps modal in sync without a full page reload)
  const [assignments, setAssignments] = useState(initialAssignments);
  useEffect(() => { setAssignments(initialAssignments); }, [initialAssignments]);

  // Invite modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", last_name: "", role: "STUDENT" as UserRole });

  // Edit modal
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ name: "", last_name: "", role: "STUDENT" as UserRole });

  // Coach assignment modal
  const [assigningStudent, setAssigningStudent] = useState<Profile | null>(null);

  // Delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const coaches = profiles.filter((p) => p.role === "COACH" || p.role === "ADMIN");

  const filteredProfiles = profiles.filter((p) => {
    const name = `${(p as any).name ?? ""} ${(p as any).last_name ?? ""}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase()) || (p.email ?? "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  // ── Invite ──────────────────────────────────────────────────
  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await inviteUser(inviteForm.email, `${inviteForm.name} ${inviteForm.last_name}`, inviteForm.role);
        setIsInviteOpen(false);
        setInviteForm({ email: "", name: "", last_name: "", role: "STUDENT" });
        router.refresh();
      } catch {
        // no-op: the form stays open on error
      }
    });
  };

  // ── Edit ─────────────────────────────────────────────────────
  const openEdit = (user: Profile) => {
    setEditingUser(user);
    setEditForm({ name: (user as any).name ?? "", last_name: (user as any).last_name ?? "", role: (user.role as UserRole) ?? "STUDENT" });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    startTransition(async () => {
      await updateUserAsAdmin(editingUser.id, editForm.name, editForm.last_name, editForm.role);
      setEditingUser(null);
      router.refresh();
    });
  };

  // ── Assignment ───────────────────────────────────────────────
  const handleToggleAssignment = (coachId: string, studentId: string) => {
    const isAssigned = assignments.some((a) => a.coach_id === coachId && a.student_id === studentId);
    // Optimistic update
    setAssignments((prev) =>
      isAssigned
        ? prev.filter((a) => !(a.coach_id === coachId && a.student_id === studentId))
        : [...prev, { coach_id: coachId, student_id: studentId }]
    );
    startTransition(async () => {
      try {
        if (isAssigned) {
          await removeCoachFromStudent(coachId, studentId);
        } else {
          await assignCoachToStudent(coachId, studentId);
        }
      } catch {
        // Rollback on error
        setAssignments(initialAssignments);
      }
    });
  };

  // ── Delete ───────────────────────────────────────────────────
  const openDeleteConfirm = (profile: Profile) => {
    setConfirmDelete(profile);
    setDeleteSummary(null);
    setIsLoadingSummary(true);
    startTransition(async () => {
      try {
        const summary = await getUserDeleteSummary(profile.id);
        setDeleteSummary(buildDeleteSummary(summary.role, summary.planCount, summary.templateCount));
      } finally {
        setIsLoadingSummary(false);
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    startTransition(async () => {
      await deleteUser(confirmDelete.id);
      setConfirmDelete(null);
      router.refresh();
    });
  };

  // ── Helpers ───────────────────────────────────────────────────
  const getSecondaryInfo = (profile: Profile) => {
    if (profile.role === "STUDENT") {
      const count = assignments.filter((a) => a.student_id === profile.id).length;
      return `${count} coach${count !== 1 ? "es" : ""} asignado${count !== 1 ? "s" : ""}`;
    }
    if (profile.role === "COACH") return "Coach";
    return "Administrador";
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-4xl mx-auto md:px-6 md:py-8">

      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black tracking-tight text-foreground">Panel de Control</h1>
          <p className="text-xs text-muted-foreground">Gestiona usuarios, roles y asignaciones de BeeGym.</p>
        </div>
        <button
          onClick={() => setIsInviteOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition shrink-0"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span className="sm:hidden">AGREGAR</span>
          <span className="hidden sm:inline">AGREGAR USUARIO</span>
        </button>
      </header>

      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input
          id="admin-search"
          name="admin-search"
          type="text"
          autoComplete="off"
          placeholder="Buscar por nombre o email..."
          className="w-full bg-card border-2 border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary transition-all font-medium text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* User list */}
      {filteredProfiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-border">
          <User className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Sin resultados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40"
            >
              {/* Fila 1: Avatar + Nombre + Badge */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  {profile.role === "ADMIN" ? (
                    <ShieldCheck className="h-5 w-5 text-purple-400" />
                  ) : profile.role === "COACH" ? (
                    <DumbbellIcon className="h-5 w-5 text-blue-400" />
                  ) : (
                    <User className="h-5 w-5 text-yellow-400" />
                  )}
                </div>
                <p className="flex-1 text-sm font-black text-foreground">
                  {(profile as any).name} {(profile as any).last_name}
                </p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 ${ROLE_BADGE[profile.role ?? "STUDENT"]}`}>
                  {ROLE_LABEL[profile.role ?? "STUDENT"]}
                </span>
              </div>

              {/* Fila 2: Email + info secundaria (izq) | Acciones (der) */}
              <div className="flex items-center justify-between pl-13">
                <div className="flex flex-col gap-0.5 min-w-0 mr-2">
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{getSecondaryInfo(profile)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {profile.role === "STUDENT" && (
                    <button
                      onClick={() => setAssigningStudent(profile)}
                      title="Asignar coaches"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <Users className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(profile)}
                    title="Editar usuario"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(profile)}
                    disabled={isPending}
                    title="Eliminar usuario"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: Invite ──────────────────────────────────────── */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border-t-2 border-x-2 sm:border-2 border-border w-full sm:max-w-md rounded-t-4xl sm:rounded-[2.5rem] flex flex-col max-h-[92dvh] sm:max-h-[90dvh] shadow-2xl shadow-primary/10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

            {/* Encabezado fijo */}
            <div className="shrink-0 px-6 pt-4 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-foreground tracking-tight">Agregar Usuario</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Nuevo acceso a BeeGym</p>
                </div>
                <button onClick={() => setIsInviteOpen(false)} className="ml-4 shrink-0 h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Contenido scrollable */}
            <div className="overflow-y-auto px-6 pb-24 pt-2 sm:px-8 sm:pb-8 sm:pt-0">
              <form onSubmit={handleInvite} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nombre</label>
                  <input required type="text" autoComplete="given-name"
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    placeholder="Ej: Juan"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Apellido</label>
                  <input required type="text" autoComplete="family-name"
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    placeholder="Ej: Pérez"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Email</label>
                  <input required type="email" autoComplete="email"
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    placeholder="juan@gmail.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Rol Inicial</label>
                  <div className="flex rounded-2xl border-2 border-border overflow-hidden">
                    {(["STUDENT", "COACH"] as UserRole[]).map((r) => (
                      <button key={r} type="button" onClick={() => setInviteForm({ ...inviteForm, role: r })}
                        className={`flex-1 py-3.5 font-black text-xs tracking-widest uppercase transition ${inviteForm.role === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/60"}`}>
                        {r === "STUDENT" ? "Estudiante" : "Coach"}
                      </button>
                    ))}
                  </div>
                </div>
                <button disabled={isPending}
                  className="mt-2 bg-foreground text-background py-5 rounded-3xl font-black text-sm shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50">
                  {isPending ? "PROCESANDO..." : "ENVIAR INVITACIÓN"}
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: Edit ────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border-t-2 border-x-2 sm:border-2 border-border w-full sm:max-w-md rounded-t-4xl sm:rounded-[2.5rem] px-6 pt-6 pb-24 sm:p-8 shadow-2xl shadow-primary/10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black text-foreground tracking-tight">Editar Usuario</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 rounded-full hover:bg-muted transition">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nombre</label>
                <input required type="text" autoComplete="given-name"
                  className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Apellido</label>
                <input required type="text" autoComplete="family-name"
                  className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Rol del Usuario</label>
                <select
                  className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-black text-xs appearance-none"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                >
                  <option value="STUDENT">ESTUDIANTE</option>
                  <option value="COACH">COACH</option>
                  <option value="ADMIN">ADMINISTRADOR</option>
                </select>
              </div>
              <button disabled={isPending}
                className="mt-4 flex items-center justify-center gap-2 bg-foreground text-background py-5 rounded-3xl font-black text-sm shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50">
                {isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> ACTUALIZANDO...</>
                ) : (
                  <><Save className="h-5 w-5" /> GUARDAR</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Coach assignment (bottom-sheet mobile / centered desktop) ── */}
      {assigningStudent && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-base font-black uppercase tracking-tight text-zinc-100">Asignar Coaches</h4>
                  <p className="text-xs text-zinc-500">{(assigningStudent as any).name} {(assigningStudent as any).last_name}</p>
                </div>
              </div>
              <button
                onClick={() => { setAssigningStudent(null); router.refresh(); }}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pb-2 flex flex-col gap-2 max-h-72 overflow-y-auto">
              {coaches.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No hay coaches registrados.</p>
              ) : (
                coaches.map((coach) => {
                  const isAssigned = assignments.some(
                    (a) => a.coach_id === coach.id && a.student_id === assigningStudent.id
                  );
                  return (
                    <button
                      key={coach.id}
                      onClick={() => handleToggleAssignment(coach.id, assigningStudent.id)}
                      disabled={isPending}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all disabled:opacity-50 ${
                        isAssigned
                          ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {isAssigned ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-yellow-400" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0" />
                      )}
                      <span className="font-black">{(coach as any).name} {(coach as any).last_name}</span>
                      <span className={`ml-auto text-[10px] uppercase tracking-wider font-black ${isAssigned ? "text-yellow-400" : "text-zinc-600"}`}>
                        {coach.role}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pb-8 sm:pb-4" />
          </div>
        </div>
      )}

      {/* ── MODAL: Delete confirmation ──────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">
                  Eliminar Usuario
                </h4>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-2">
              <p className="text-sm text-zinc-300 font-black">
                {(confirmDelete as any).name} {(confirmDelete as any).last_name}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{confirmDelete.email}</p>
              <div className="mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                {isLoadingSummary ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Calculando datos a eliminar...
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">{deleteSummary}</p>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-3">Esta acción no se puede deshacer.</p>
            </div>
            <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isPending || isLoadingSummary}
                className="flex-1 h-14 rounded-2xl bg-red-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95 disabled:opacity-50"
              >
                {isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
