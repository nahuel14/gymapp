"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Dumbbell, Edit, Trash2, LayoutTemplate, X } from "lucide-react";
import { createTemplatePlan, duplicatePlan, deleteTemplatePlan } from "@/app/(dashboard)/coach/student/actions";

type TemplatePlan = {
  id: number;
  name: string;
  created_at: string;
  coach_id: string;
  session_count?: number;
  exercise_count?: number;
};

interface TemplateListClientProps {
  initialTemplates: TemplatePlan[];
}

export default function TemplateListClient({ initialTemplates }: TemplateListClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [localTemplates, setLocalTemplates] = useState<TemplatePlan[]>(initialTemplates);
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialTemplates) {
      setLocalTemplates(initialTemplates);
    }
  }, [initialTemplates]);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/user");
        const { user } = await response.json();
        if (user?.role) {
          setUserRole(user.role);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchUserRole();
  }, []);

  const handleCreateTemplate = async () => {
    try {
      const response = await fetch("/api/user");
      const { user } = await response.json();
      if (!user) {
        router.push("/login");
        return;
      }
      const result = await createTemplatePlan("Nueva Plantilla", user.id);
      if (result.success) {
        router.push(`/coach/templates/${result.templateId}/edit`);
      }
    } catch (error) {
      console.error("Error creating template:", error);
    }
  };

  const handleDuplicateTemplate = async (templateId: number) => {
    try {
      await duplicatePlan(templateId);
      router.refresh();
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (error) {
      console.error("Error duplicating template:", error);
    }
  };

  const handleConfirmDeleteTemplate = () => {
    if (templateToDelete === null) return;
    const idToDelete = templateToDelete;
    setTemplateToDelete(null);

    startTransition(async () => {
      setLocalTemplates(prev => prev.filter(t => t.id !== idToDelete));
      try {
        await deleteTemplatePlan(idToDelete);
        router.refresh();
        queryClient.invalidateQueries({ queryKey: ["templates"] });
      } catch (error: any) {
        console.error("Error deleting template:", error);
        setLocalTemplates(initialTemplates);
      }
    });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black tracking-tight text-foreground">Plantillas</h1>
          <p className="text-xs text-muted-foreground">
            Crea y gestiona tus planes de entrenamiento maestros
          </p>
        </div>
        <button
          onClick={handleCreateTemplate}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Nueva Plantilla</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </header>

      {/* Templates Grid/List */}
      {localTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border-2 border-dashed border-border">
          <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-base font-black text-foreground mb-1">No hay plantillas aún</h3>
          <p className="text-xs text-muted-foreground text-center max-w-md mb-6">
            Crea tu primera plantilla para diseñar programas de entrenamiento reutilizables
          </p>
          <button
            onClick={handleCreateTemplate}
            className="flex items-center gap-2 rounded-2xl border-2 border-border px-4 py-2.5 text-sm font-black text-muted-foreground transition-all hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Crear Primera Plantilla
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {localTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDuplicate={() => handleDuplicateTemplate(template.id)}
              onEdit={() => router.push(`/coach/templates/${template.id}/edit`)}
              onPreview={() => router.push(`/coach/templates/${template.id}`)}
              onDelete={() => setTemplateToDelete(template.id)}
              userRole={userRole}
            />
          ))}
        </div>
      )}

      {/* MODAL ELIMINAR PLANTILLA */}
      {templateToDelete !== null && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Eliminar Plantilla</h4>
              </div>
              <button
                onClick={() => setTemplateToDelete(null)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-2">
              <p className="text-sm text-zinc-400 leading-relaxed">
                ¿Estás seguro de eliminar esta plantilla? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
              <button
                onClick={() => setTemplateToDelete(null)}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteTemplate}
                disabled={isPending}
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

function TemplateCard({
  template,
  onDuplicate: _onDuplicate,
  onEdit,
  onPreview,
  onDelete,
  userRole,
}: {
  template: TemplatePlan;
  onDuplicate: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
  userRole: string | null;
}) {
  const canEdit = userRole === "COACH" || userRole === "ADMIN";

  return (
    <div
      onClick={onPreview}
      className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer"
    >
      <div className="flex flex-1 flex-col min-w-0 justify-center">
        <p className="text-sm font-black text-foreground truncate">{template.name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-muted-foreground">
          <span className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            {template.session_count || 0} sesiones
          </span>
          <span className="flex items-center gap-1 text-xs">
            <Dumbbell className="h-3 w-3" />
            {template.exercise_count || 0} ejercicios
          </span>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-1 shrink-0 pl-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
