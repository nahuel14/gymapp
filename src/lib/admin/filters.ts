type AdminUserRole = "ADMIN" | "COACH" | "STUDENT" | "SUPER_STUDENT";

export type AdminProfile = {
  id: string;
  email: string;
  name: string;
  last_name: string;
  role: AdminUserRole;
};

export type AdminAssignment = { coach_id: string; student_id: string };

export function filterProfiles(
  profiles: AdminProfile[],
  searchTerm: string
): AdminProfile[] {
  const lower = searchTerm.toLowerCase();
  if (!lower) return profiles;
  return profiles.filter((p) => {
    const fullName = `${p.name} ${p.last_name}`.toLowerCase();
    return fullName.includes(lower) || p.email.toLowerCase().includes(lower);
  });
}

export function getCoachProfiles(profiles: AdminProfile[]): AdminProfile[] {
  return profiles.filter((p) => p.role === "COACH" || p.role === "ADMIN");
}

export function isCoachAssignedToStudent(
  assignments: AdminAssignment[],
  coachId: string,
  studentId: string
): boolean {
  return assignments.some(
    (a) => a.coach_id === coachId && a.student_id === studentId
  );
}

export function toggleAssignment(
  assignments: AdminAssignment[],
  coachId: string,
  studentId: string
): AdminAssignment[] {
  const assigned = isCoachAssignedToStudent(assignments, coachId, studentId);
  if (assigned)
    return assignments.filter(
      (a) => !(a.coach_id === coachId && a.student_id === studentId)
    );
  return [...assignments, { coach_id: coachId, student_id: studentId }];
}

export function countCoachesForStudent(
  assignments: AdminAssignment[],
  studentId: string
): number {
  return assignments.filter((a) => a.student_id === studentId).length;
}

export function validateInviteForm(
  email: string,
  name: string
): { valid: boolean; error?: string } {
  if (!email || !email.includes("@"))
    return { valid: false, error: "Email inválido" };
  if (!name.trim()) return { valid: false, error: "El nombre es obligatorio" };
  return { valid: true };
}

export function canDeleteUser(
  currentUserId: string,
  targetUserId: string
): boolean {
  return currentUserId !== targetUserId;
}

export function computeRoleChangeImpact(
  userId: string,
  fromRole: AdminUserRole,
  toRole: AdminUserRole,
  assignments: AdminAssignment[]
): { count: number; text: string } {
  if (fromRole === toRole) return { count: 0, text: "" };
  const coachRoles = new Set<AdminUserRole>(["COACH", "ADMIN"]);

  if (fromRole === "STUDENT") {
    const count = assignments.filter((a) => a.student_id === userId).length;
    if (count === 0) return { count: 0, text: "" };
    return {
      count,
      text: `Este alumno tiene ${count} coach${count !== 1 ? "es" : ""} asignado${count !== 1 ? "s" : ""}. Al cambiar su rol, se eliminarán todas sus asignaciones de coaches.`,
    };
  }
  if (coachRoles.has(fromRole) && !coachRoles.has(toRole)) {
    const count = assignments.filter((a) => a.coach_id === userId).length;
    if (count === 0) return { count: 0, text: "" };
    return {
      count,
      text: `Este coach tiene ${count} alumno${count !== 1 ? "s" : ""} asignado${count !== 1 ? "s" : ""}. Al cambiar su rol, se eliminarán todas sus asignaciones con alumnos.`,
    };
  }
  return { count: 0, text: "" };
}
