type DeleteRole = "ADMIN" | "COACH" | "STUDENT" | "SUPER_STUDENT";

export function getDeleteScope(role: DeleteRole): {
  deletesPlans: boolean;
  deletesTemplates: boolean;
  nullifiesCoachId: boolean;
} {
  if (role === "STUDENT") {
    return { deletesPlans: true, deletesTemplates: false, nullifiesCoachId: false };
  }
  if (role === "SUPER_STUDENT") {
    return { deletesPlans: true, deletesTemplates: true, nullifiesCoachId: true };
  }
  return { deletesPlans: false, deletesTemplates: true, nullifiesCoachId: true };
}

export function buildDeleteSummary(
  role: string,
  planCount: number,
  templateCount: number
): string {
  if (role === "STUDENT") {
    if (planCount === 0) return "No tiene planes de entrenamiento activos.";
    const label = planCount === 1 ? "plan" : "planes";
    return `Se eliminarán ${planCount} ${label} de entrenamiento con todas sus sesiones y ejercicios.`;
  }
  if (role === "SUPER_STUDENT") {
    const parts: string[] = [];
    if (planCount > 0) parts.push(`${planCount} ${planCount === 1 ? "plan" : "planes"} de entrenamiento`);
    if (templateCount > 0) parts.push(`${templateCount} ${templateCount === 1 ? "plantilla" : "plantillas"} de entrenamiento`);
    if (parts.length === 0) return "No tiene planes ni plantillas de entrenamiento.";
    return `Se eliminarán ${parts.join(" y ")} con todas sus sesiones y ejercicios.`;
  }
  if (templateCount === 0) return "No tiene plantillas de entrenamiento.";
  const label = templateCount === 1 ? "plantilla" : "plantillas";
  return `Se eliminarán ${templateCount} ${label} de entrenamiento con todas sus sesiones y ejercicios.`;
}
