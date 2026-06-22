"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProgressData } from "@/app/api/progress/[studentId]/route";

async function fetchStudentProgress(studentId: string, weeks: number): Promise<ProgressData> {
  const res = await fetch(`/api/progress/${studentId}?weeks=${weeks}`);
  if (!res.ok) throw new Error("Error al cargar progreso");
  return res.json() as Promise<ProgressData>;
}

export function useStudentProgress(studentId: string, weeks = 52) {
  return useQuery({
    queryKey: ["student", "progress", studentId, weeks],
    queryFn: () => fetchStudentProgress(studentId, weeks),
    enabled: !!studentId,
  });
}
