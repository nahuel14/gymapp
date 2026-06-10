type CoachForm = {
  target_sets: number;
  target_reps: number[];
  target_weight: (number | null)[];
  target_rpe: number;
  rest_seconds: number;
  coach_notes: string;
  actual_sets?: number;
  actual_reps?: number[];
  actual_rpe?: number;
  student_notes?: string;
};

type StudentForm = {
  actual_sets: number;
  actual_reps: number[];
  actual_rpe: number | null;
  student_notes: string;
  target_sets?: number;
  target_reps?: number[];
  target_weight?: (number | null)[];
  target_rpe?: number;
  coach_notes?: string;
};

export function buildCoachPayload(form: CoachForm) {
  return {
    target_sets: form.target_sets,
    target_reps: form.target_reps,
    target_weight: form.target_weight,
    target_rpe: form.target_rpe,
    rest_seconds: form.rest_seconds,
    coach_notes: form.coach_notes,
  };
}

export function buildStudentPayload(form: StudentForm) {
  return {
    actual_sets: form.actual_sets,
    actual_reps: form.actual_reps,
    actual_rpe: form.actual_rpe,
    student_notes: form.student_notes,
  };
}

export function shouldMarkCompleteFromStudent(
  actual_sets: number | null | undefined
): boolean {
  return !!(actual_sets && actual_sets > 0);
}

export function validateActualReps(
  actual_sets: number,
  actual_reps: number[]
): { valid: boolean; error?: string } {
  if (actual_reps.length !== actual_sets) {
    return {
      valid: false,
      error: `Se esperan ${actual_sets} sets pero hay ${actual_reps.length} repeticiones`,
    };
  }
  if (actual_reps.some((r) => r < 0)) {
    return { valid: false, error: "Las repeticiones no pueden ser negativas" };
  }
  return { valid: true };
}

export function canStudentEditTargets(): boolean {
  return false;
}

function buildAdminPayload(form: CoachForm & Partial<StudentForm>) {
  return {
    target_sets: form.target_sets,
    target_reps: form.target_reps,
    target_weight: form.target_weight,
    target_rpe: form.target_rpe,
    rest_seconds: form.rest_seconds,
    coach_notes: form.coach_notes,
    actual_sets: form.actual_sets,
    actual_reps: form.actual_reps,
    actual_rpe: form.actual_rpe,
    student_notes: form.student_notes,
  };
}

export function buildPayloadByMode(
  form: CoachForm & Partial<StudentForm>,
  editingAs: "coach" | "student" | "admin"
) {
  if (editingAs === "admin") return buildAdminPayload(form);
  return editingAs === "coach" ? buildCoachPayload(form) : buildStudentPayload(form as StudentForm);
}
