"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Dumbbell, Edit, Trash2 } from "lucide-react";
import { useTemplate } from "@/hooks/useTemplates";
import { ExerciseExcelGrid } from "@/app/(dashboard)/coach/student/ExerciseExcelGrid";
import { deleteTemplatePlan } from "@/app/(dashboard)/coach/student/actions";

export default function TemplateViewPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = Number(params.id);
  const { data: template, isLoading, error } = useTemplate(templateId);

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar esta plantilla? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      await deleteTemplatePlan(templateId);
      router.push("/coach/templates");
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Error al eliminar la plantilla");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Cargando plantilla...</div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error al cargar la plantilla</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-100 uppercase tracking-tight">
              {template.name}
            </h1>
            <p className="text-sm text-zinc-500">
              Plantilla • {template.sessions?.length || 0} sesiones • {template.total_exercises || 0} ejercicios
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/coach/templates/${templateId}/edit`)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 text-xs font-black text-zinc-300 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              <Edit className="h-3.5 w-3.5" />
              Editar
            </button>
            
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-black text-red-400 transition hover:bg-red-500/20 hover:border-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="space-y-6">
        {template.sessions && template.sessions.length > 0 ? (
          <>
            {/* Agrupar sesiones por semana */}
            {Object.entries(
              template.sessions.reduce((acc: Record<number, any[]>, session: any) => {
                const week = session.week_number;
                if (!acc[week]) acc[week] = [];
                acc[week].push(session);
                return acc;
              }, {})
            )
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([weekNumber, sessions]) => (
                <div key={weekNumber} className="space-y-4">
                  {/* Encabezado de Semana */}
                  <div className="flex items-center px-4 py-2 border-b-2 border-zinc-800">
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">
                      Semana {weekNumber}
                    </h3>
                  </div>
                  
                  {/* Sesiones de la semana */}
                  <div className="space-y-4">
                    {(sessions as any[]).map((session: any) => (
                      <div key={session.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                          <div>
                            <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
                              {session.day_name}
                            </h2>
                            <p className="text-xs text-zinc-500">
                              {session.session_exercises?.length || 0} ejercicios
                            </p>
                          </div>
                        </div>

                        {session.session_exercises && session.session_exercises.length > 0 ? (
                          <ExerciseExcelGrid exercises={session.session_exercises} role="COACH" />
                        ) : (
                          <div className="text-center py-12 rounded-xl border-2 border-dashed border-zinc-800">
                            <Dumbbell className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">
                              Sin ejercicios para este día
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </>
        ) : (
          <div className="text-center py-24 rounded-xl border-2 border-dashed border-zinc-800">
            <Calendar className="h-16 w-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-zinc-600 mb-2">Sin sesiones</h3>
            <p className="text-zinc-500 text-sm">
              Esta plantilla no tiene sesiones configuradas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
