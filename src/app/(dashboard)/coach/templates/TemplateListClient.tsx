"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, LayoutTemplate, X, Users, Copy } from "lucide-react";
import { createTemplatePlan, duplicatePlan, deleteTemplatePlan } from "@/app/(dashboard)/coach/student/actions";
import { reassignTemplate } from "@/app/actions/admin";

type TemplatePlan = {
  id: number;
  name: string;
  created_at: string;
  coach_id: string;
  week_count: number;
  days_per_week: number;
  owner_name?: string;
  owner_last_name?: string;
  owner_role?: string;
};

type AssignableUser = {
  id: string;
  name: string;
  last_name: string;
  role: string;
};

interface TemplateListClientProps {
  initialTemplates: TemplatePlan[];
  isAdmin?: boolean;
  currentUserId?: string;
  assignableUsers?: AssignableUser[];
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  COACH: "Coach",
  STUDENT: "Alumno",
  SUPER_STUDENT: "Autogestionado",
};

export default function TemplateListClient({
  initialTemplates,
  isAdmin = false,
  currentUserId,
  assignableUsers = [],
}: TemplateListClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localTemplates, setLocalTemplates] = useState<TemplatePlan[]>(initialTemplates);
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);
  const [templateToReassign, setTemplateToReassign] = useState<TemplatePlan | null>(null);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialTemplates) {
      setLocalTemplates(initialTemplates);
    }
  }, [initialTemplates]);

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

  const handleOpenReassign = (template: TemplatePlan) => {
    setTemplateToReassign(template);
    setSelectedNewOwnerId("");
  };

  const handleConfirmReassign = () => {
    if (!templateToReassign || !selectedNewOwnerId) return;
    startTransition(async () => {
      try {
        await reassignTemplate(templateToReassign.id, selectedNewOwnerId);
        setTemplateToReassign(null);
        router.refresh();
        queryClient.invalidateQueries({ queryKey: ["templates"] });
      } catch (error) {
        console.error("Error reassigning template:", error);
      }
    });
  };

  // Users available for reassignment (exclude current owner)
  const reassignOptions = templateToReassign
    ? assignableUsers.filter(u => u.id !== templateToReassign.coach_id)
    : assignableUsers;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black tracking-tight text-foreground">Plantillas</h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Todas las plantillas del sistema" : "Crea y gestiona tus planes de entrenamiento maestros"}
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
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onDuplicate={() => handleDuplicateTemplate(template.id)}
              onEdit={() => router.push(`/coach/templates/${template.id}/edit`)}
              onPreview={() => router.push(`/coach/templates/${template.id}`)}
              onDelete={() => setTemplateToDelete(template.id)}
              onReassign={() => handleOpenReassign(template)}
            />
          ))}
        </div>
      )}

      {/* ── MODAL: Eliminar plantilla ──────────────────────────── */}
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

      {/* ── MODAL: Reasignar plantilla ──────────────────────────── */}
      {templateToReassign && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-base font-black uppercase tracking-tight text-zinc-100">Reasignar Plantilla</h4>
                  <p className="text-xs text-zinc-500 truncate max-w-48">{templateToReassign.name}</p>
                </div>
              </div>
              <button
                onClick={() => setTemplateToReassign(null)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pb-4 flex flex-col gap-4">
              {/* Propietario actual */}
              {templateToReassign.owner_name && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-widest font-black">Propietario actual:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                    templateToReassign.owner_role === "STUDENT"
                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}>
                    {templateToReassign.owner_role === "STUDENT" && "⚠ "}
                    {templateToReassign.owner_name} {templateToReassign.owner_last_name}
                  </span>
                </div>
              )}

              {/* Selector de nuevo propietario */}
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {reassignOptions.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">No hay otros usuarios disponibles.</p>
                ) : (
                  reassignOptions.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedNewOwnerId(u.id)}
                      disabled={isPending}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all disabled:opacity-50 ${
                        selectedNewOwnerId === u.id
                          ? "border-blue-400/60 bg-blue-400/10 text-blue-300"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <span className="font-black flex-1 text-left">{u.name} {u.last_name}</span>
                      <span className="text-[10px] uppercase tracking-wider font-black text-zinc-500">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 pb-8 sm:pb-6 flex gap-3">
              <button
                onClick={() => setTemplateToReassign(null)}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReassign}
                disabled={isPending || !selectedNewOwnerId}
                className="flex-1 h-14 rounded-2xl bg-blue-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-400 active:scale-95 disabled:opacity-50"
              >
                {isPending ? "Reasignando..." : "Reasignar"}
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
  isAdmin,
  currentUserId,
  onDuplicate,
  onEdit,
  onPreview,
  onDelete,
  onReassign,
}: {
  template: TemplatePlan;
  isAdmin: boolean;
  currentUserId?: string;
  onDuplicate: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onReassign: () => void;
}) {
  const isOwner = template.coach_id === currentUserId;
  const isOrphaned = template.owner_role === "STUDENT";
  const canEdit = isAdmin || isOwner;

  const ownerBadge = isAdmin && template.owner_name ? (
    <span className={`inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
      isOrphaned
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
        : "bg-muted text-muted-foreground border-transparent"
    }`}>
      {isOrphaned && "⚠ "}
      {template.owner_name} {template.owner_last_name}
    </span>
  ) : null;

  const actionButtons = canEdit ? (
    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
      {isAdmin && (
        <>
          <button onClick={onReassign} title="Reasignar propietario"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
            <Users className="h-4 w-4" />
          </button>
          <button onClick={onDuplicate} title="Duplicar plantilla"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Copy className="h-4 w-4" />
          </button>
        </>
      )}
      <button onClick={onEdit}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <Edit className="h-4 w-4" />
      </button>
      <button onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  return (
    <div
      onClick={onPreview}
      className="group flex flex-col rounded-2xl border border-border bg-card px-4 py-3 shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer gap-1"
    >
      {/* Row 1: title + badge (desktop) */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black text-foreground leading-snug">{template.name}</p>
        <span className="hidden sm:block">{ownerBadge}</span>
      </div>

      {/* Badge own row (mobile only) */}
      {ownerBadge && <span className="sm:hidden self-start">{ownerBadge}</span>}

      {/* Stats + buttons */}
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-0.5">
          <span className="text-xs text-muted-foreground">
            {template.week_count} {template.week_count === 1 ? "semana" : "semanas"}
          </span>
          <span className="hidden sm:block text-xs text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground">
            {template.days_per_week} {template.days_per_week === 1 ? "día" : "días"}/sem
          </span>
        </div>
        {actionButtons}
      </div>
    </div>
  );
}
