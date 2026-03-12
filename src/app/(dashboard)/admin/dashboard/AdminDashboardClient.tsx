 "use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  UserPlus, 
  Users, 
  Shield, 
  UserCheck, 
  Mail, 
  Plus,
  X,
  Check,
  Search,
  Square,
  CheckSquare,
  Pencil,
  Save,
  Loader2,
  Trash2
} from "lucide-react";
import type { Tables, Database } from "@/types/supabase";
import { 
  inviteUser, 
  updateUserRole, 
  assignCoachToStudent, 
  removeCoachFromStudent,
  updateUserAsAdmin,
  deleteUser
} from "@/app/actions/admin";
import { useQueryClient } from "@tanstack/react-query";

type UserRole = Database["public"]["Enums"]["user_role"];
type Profile = Tables<"profiles">;

type AdminDashboardClientProps = {
  profiles: Profile[];
  assignments: { coach_id: string; student_id: string }[];
};

export function AdminDashboardClient({ 
  profiles, 
  assignments 
}: AdminDashboardClientProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  
  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    last_name: "",
    role: "STUDENT" as UserRole
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: "",
    last_name: "",
    role: "STUDENT" as UserRole
  });

  const handleEditClick = (user: Profile) => {
    const u = user as any;
    setEditingUser(user);
    setEditForm({
      name: u.name || "",
      last_name: u.last_name || "",
      role: u.role || "STUDENT"
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    startTransition(async () => {
      try {
        await updateUserAsAdmin(
          editingUser.id,
          editForm.name,
          editForm.last_name,
          editForm.role
        );
        setEditingUser(null);
        alert("Usuario actualizado con éxito");
      } catch (error: any) {
        alert("Error al actualizar: " + error.message);
      }
    });
  };

  const filteredProfiles = profiles.filter(p => {
    const profile = p as any;
    const fullName = `${profile.name || ""} ${profile.last_name || ""}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           profile.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const coaches = profiles.filter(p => p.role === "COACH" || p.role === "ADMIN");
  const students = profiles.filter(p => p.role === "STUDENT");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await inviteUser(inviteForm.email, `${inviteForm.name} ${inviteForm.last_name}`, inviteForm.role);
        setIsInviteModalOpen(false);
        setInviteForm({ email: "", name: "", last_name: "", role: "STUDENT" });
        alert("Usuario invitado con éxito");
      } catch (error: any) {
        alert("Error al invitar: " + error.message);
      }
    });
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!confirm(`¿Estás seguro de cambiar el rol a ${newRole}?`)) return;
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
      } catch (error: any) {
        alert("Error al actualizar rol: " + error.message);
      }
    });
  };

  const toggleAssignment = async (coachId: string, studentId: string) => {
    const isAssigned = assignments.some(a => a.coach_id === coachId && a.student_id === studentId);
    
    startTransition(async () => {
      try {
        if (isAssigned) {
          await removeCoachFromStudent(coachId, studentId);
        } else {
          await assignCoachToStudent(coachId, studentId);
        }
      } catch (error: any) {
        alert("Error en asignación: " + error.message);
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("¿Eliminar este usuario definitivamente?")) return;

    startTransition(async () => {
      try {
        await deleteUser(userId);
        await queryClient.invalidateQueries();
        router.refresh();
      } catch (error: any) {
        alert("Error al eliminar usuario: " + error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Panel de Control</h1>
          <p className="text-muted-foreground text-sm font-medium">Gestiona usuarios, roles y asignaciones de Gymapp.</p>
        </div>
        <button 
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition"
        >
          <UserPlus className="h-5 w-5" />
          INVITAR USUARIO
        </button>
      </header>

      {/* Search and Filters */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          placeholder="Buscar por nombre o email..." 
          className="w-full bg-card border-2 border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary transition-all font-medium text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {filteredProfiles.map((profile) => (
          <div key={profile.id} className="rounded-[1.5rem] border-2 border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-lg font-black text-foreground">
                {(profile as any).name} {(profile as any).last_name}
              </span>
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground break-all">
                <Mail className="h-4 w-4 shrink-0" /> {profile.email}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border ${
                profile.role === 'ADMIN' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                profile.role === 'COACH' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                'bg-orange-50 text-orange-600 border-orange-100'
              }`}>
                {profile.role}
              </span>
              {profile.role === "STUDENT" ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {assignments.filter(a => a.student_id === profile.id).length} coach(es)
                </span>
              ) : (
                <span className="text-xs font-medium italic text-muted-foreground">N/A</span>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button 
                onClick={() => handleEditClick(profile)}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-foreground hover:text-background transition-all active:scale-95"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteUser(profile.id)}
                disabled={isPending}
                className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="hidden bg-card border-2 border-border rounded-[2rem] overflow-hidden shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-border bg-muted/30">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuario</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rol</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-border">
              {filteredProfiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-foreground">
                        {(profile as any).name} {(profile as any).last_name}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {profile.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border ${
                      profile.role === 'ADMIN' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      profile.role === 'COACH' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-orange-50 text-orange-600 border-orange-100'
                    }`}>
                      {profile.role}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {profile.role === "STUDENT" ? (
                      <div className="flex flex-wrap gap-2">
                        {coaches.map(coach => {
                          const isAssigned = assignments.some(a => a.coach_id === coach.id && a.student_id === profile.id);
                          return (
                            <button
                              key={coach.id}
                              onClick={() => toggleAssignment(coach.id, profile.id)}
                              disabled={isPending}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition border-2 ${
                                isAssigned 
                                  ? "bg-primary/10 border-primary text-primary" 
                                  : "bg-muted/50 border-transparent text-muted-foreground hover:border-muted-foreground/20"
                              }`}
                            >
                              {isAssigned ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                              {(coach as any).name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEditClick(profile)}
                        className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-foreground hover:text-background transition-all active:scale-95"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(profile.id)}
                        disabled={isPending}
                        className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border-2 border-border w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl shadow-primary/10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-foreground tracking-tight">Invitar Usuario</h2>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-2 rounded-full hover:bg-muted transition">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nombre</label>
                  <input 
                    required
                    type="text" 
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    placeholder="Ej: Nahuel"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Apellido</label>
                  <input 
                    required
                    type="text" 
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    placeholder="Ej: Gym"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm({...inviteForm, last_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Email</label>
                <input 
                  required
                  type="email" 
                  className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                  placeholder="nahuel@gym.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Rol Inicial</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setInviteForm({...inviteForm, role: "STUDENT"})}
                    className={`p-4 rounded-2xl border-2 font-black text-xs transition ${inviteForm.role === "STUDENT" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                  >
                    ESTUDIANTE
                  </button>
                  <button 
                    type="button"
                    onClick={() => setInviteForm({...inviteForm, role: "COACH"})}
                    className={`p-4 rounded-2xl border-2 font-black text-xs transition ${inviteForm.role === "COACH" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                  >
                    COACH
                  </button>
                </div>
              </div>

              <button 
                disabled={isPending}
                className="mt-4 bg-foreground text-background py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
              >
                {isPending ? "PROCESANDO..." : "ENVIAR INVITACIÓN"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border-2 border-border w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl shadow-primary/10 animate-in zoom-in-95 duration-200">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nombre</label>
                  <input 
                    required
                    type="text" 
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Apellido</label>
                  <input 
                    required
                    type="text" 
                    className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Rol del Usuario</label>
                <select 
                  className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-black text-xs appearance-none"
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value as UserRole})}
                >
                  <option value="STUDENT">ESTUDIANTE</option>
                  <option value="COACH">COACH</option>
                  <option value="ADMIN">ADMINISTRADOR</option>
                </select>
              </div>

              <button 
                disabled={isPending}
                className="mt-4 flex items-center justify-center gap-2 bg-foreground text-background py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> ACTUALIZANDO...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" /> GUARDAR CAMBIOS
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
