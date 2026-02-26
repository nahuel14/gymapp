 "use client";

import { useState, useTransition } from "react";
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
  CheckSquare
} from "lucide-react";
import type { Tables, Database } from "@/types/supabase";
import { 
  inviteUser, 
  updateUserRole, 
  assignCoachToStudent, 
  removeCoachFromStudent 
} from "@/app/actions/admin";

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
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    last_name: "",
    role: "STUDENT" as UserRole
  });

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

      {/* Users Table */}
      <div className="bg-card border-2 border-border rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-border bg-muted/30">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuario</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rol</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asignación de Coaches</th>
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
                    <select 
                      className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-primary transition"
                      value={profile.role || "STUDENT"}
                      onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                      disabled={isPending}
                    >
                      <option value="STUDENT">ESTUDIANTE</option>
                      <option value="COACH">COACH</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
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
    </div>
  );
}
