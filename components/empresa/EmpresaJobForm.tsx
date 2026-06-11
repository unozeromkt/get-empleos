"use client";

import { useState, useTransition } from "react";
import { Save, Send, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createEmpresaJobAction,
  updateEmpresaJobAction,
  submitEmpresaJobAction,
  deleteEmpresaJobAction,
} from "@/lib/actions/empresa";
import type { Job, JobArea } from "@/lib/types/database";

const COLOMBIA_CITIES = [
  "Medellín", "Bogotá", "Cali", "Barranquilla", "Cartagena",
  "Bucaramanga", "Pereira", "Manizales", "Santa Marta", "Cúcuta",
  "Ibagué", "Villavicencio", "Montería", "Pasto", "Armenia",
];

const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto",     label: "Remoto" },
  { value: "hibrido",    label: "Híbrido" },
];

const CONTRACT_TYPES = [
  { value: "tiempo_completo", label: "Tiempo completo" },
  { value: "tiempo_parcial",  label: "Tiempo parcial" },
  { value: "temporal",        label: "Temporal" },
  { value: "por_obra",        label: "Por obra o labor" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:          { label: "Borrador",            color: "bg-gray-100 text-gray-600" },
  pending_review: { label: "En revisión",          color: "bg-amber-100 text-amber-700" },
  active:         { label: "Activa",              color: "bg-emerald-100 text-emerald-700" },
  paused:         { label: "Pausada",             color: "bg-blue-100 text-blue-700" },
  closed:         { label: "Cerrada",             color: "bg-red-100 text-red-600" },
};

interface Props {
  job?: Job;
  areas: JobArea[];
}

export function EmpresaJobForm({ job, areas }: Props) {
  const [form, setForm] = useState({
    title:          job?.title          ?? "",
    area_id:        job?.area_id?.toString() ?? "",
    modality:       job?.modality       ?? "",
    contract_type:  job?.contract_type  ?? "",
    city:           job?.city           ?? "",
    department:     job?.department     ?? "",
    vacancies:      job?.vacancies?.toString() ?? "1",
    salary_min:     job?.salary_min?.toString() ?? "",
    salary_max:     job?.salary_max?.toString() ?? "",
    salary_visible: job?.salary_visible !== false ? "true" : "false",
    description:    job?.description    ?? "",
    requirements:   job?.requirements   ?? "",
    benefits:       job?.benefits       ?? "",
    expires_at:     job?.expires_at ? job.expires_at.substring(0, 10) : "",
  });

  const [errors,     setErrors]     = useState<Record<string, string[]>>({});
  const [submitMsg,  setSubmitMsg]  = useState("");
  const [isPending,  startTransition] = useTransition();
  const [isSubmitting, startSubmit]   = useTransition();
  const [isDeleting,   startDelete]   = useTransition();

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const currentStatus = job?.status ?? "draft";
  const statusInfo = STATUS_LABELS[currentStatus] ?? STATUS_LABELS.draft;
  const canEdit   = currentStatus === "draft";
  const canSubmit = currentStatus === "draft";
  const canDelete = currentStatus === "draft";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitMsg("");
    const data = buildFormData();

    startTransition(async () => {
      const result = job
        ? await updateEmpresaJobAction(job.id, data)
        : await createEmpresaJobAction(data);

      if (result?.error) setErrors(result.error as unknown as Record<string, string[]>);
    });
  };

  const handlePublish = () => {
    if (!job) return;
    startSubmit(async () => {
      const result = await submitEmpresaJobAction(job.id);
      if (result?.error) {
        setSubmitMsg(result.error);
      } else {
        setSubmitMsg("¡Oferta publicada! Ya es visible para los candidatos.");
      }
    });
  };

  const handleDelete = () => {
    if (!job || !confirm("¿Eliminar esta oferta? Esta acción no se puede deshacer.")) return;
    startDelete(async () => {
      await deleteEmpresaJobAction(job.id);
    });
  };

  const buildFormData = () => {
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.set(k, v));
    return data;
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/empresa/jobs" className="text-gray-400 hover:text-brand-navy transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-navy">
              {job ? "Editar oferta" : "Nueva oferta"}
            </h1>
            {job && (
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>

        {canDelete && job && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-400 hover:text-red-600 transition-colors p-2"
            title="Eliminar oferta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Aviso cuando no se puede editar */}
      {!canEdit && job && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-5">
          {`Esta oferta está ${statusInfo.label.toLowerCase()} y no puede editarse.`}
        </div>
      )}

      {submitMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-5 ${
          submitMsg.includes("error") || submitMsg.includes("Error")
            ? "bg-red-50 border border-red-200 text-red-600"
            : "bg-emerald-50 border border-emerald-200 text-emerald-700"
        }`}>
          {submitMsg}
        </div>
      )}

      {errors._form?.[0] && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-5">
          {errors._form[0]}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Título */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
          <h2 className="font-display font-semibold text-brand-navy">Información básica</h2>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">
              Título del cargo <span className="text-red-500">*</span>
            </label>
            <Input
              required
              disabled={!canEdit}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ej: Analista de Logística"
            />
            {errors.title?.[0] && <p className="text-xs text-red-500 mt-1">{errors.title[0]}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Área</label>
              <select
                disabled={!canEdit}
                value={form.area_id}
                onChange={(e) => set("area_id", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="">Seleccionar área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Vacantes</label>
              <Input
                type="number"
                min="1"
                max="999"
                disabled={!canEdit}
                value={form.vacancies}
                onChange={(e) => set("vacancies", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Modalidad</label>
              <select
                disabled={!canEdit}
                value={form.modality}
                onChange={(e) => set("modality", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="">Seleccionar</option>
                {MODALITIES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Tipo de contrato</label>
              <select
                disabled={!canEdit}
                value={form.contract_type}
                onChange={(e) => set("contract_type", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="">Seleccionar</option>
                {CONTRACT_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Ciudad <span className="text-red-500">*</span></label>
              <select
                required
                disabled={!canEdit}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="">Seleccionar ciudad</option>
                {COLOMBIA_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Fecha de expiración</label>
              <Input
                type="date"
                disabled={!canEdit}
                value={form.expires_at}
                onChange={(e) => set("expires_at", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Salario */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
          <h2 className="font-display font-semibold text-brand-navy">Salario (COP)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Mínimo</label>
              <Input
                type="number"
                min="0"
                disabled={!canEdit}
                value={form.salary_min}
                onChange={(e) => set("salary_min", e.target.value)}
                placeholder="1.300.000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Máximo</label>
              <Input
                type="number"
                min="0"
                disabled={!canEdit}
                value={form.salary_max}
                onChange={(e) => set("salary_max", e.target.value)}
                placeholder="2.500.000"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={form.salary_visible === "true"}
              onChange={(e) => set("salary_visible", e.target.checked ? "true" : "false")}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Mostrar salario en la oferta pública</span>
          </label>
        </div>

        {/* Descripción */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
          <h2 className="font-display font-semibold text-brand-navy">Descripción del cargo</h2>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              disabled={!canEdit}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              placeholder="Describe las responsabilidades y el día a día del cargo..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-60"
            />
            {errors.description?.[0] && (
              <p className="text-xs text-red-500 mt-1">{errors.description[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">Requisitos</label>
            <textarea
              disabled={!canEdit}
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              rows={4}
              placeholder="Formación, experiencia y habilidades requeridas..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">Beneficios</label>
            <textarea
              disabled={!canEdit}
              value={form.benefits}
              onChange={(e) => set("benefits", e.target.value)}
              rows={3}
              placeholder="Beneficios adicionales al salario..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* Acciones */}
        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              disabled={isPending}
              variant="outline"
              className="border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white flex-1"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Guardar borrador
                </span>
              )}
            </Button>

            {job && canSubmit && (
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handlePublish}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white flex-1"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Publicando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Publicar oferta
                  </span>
                )}
              </Button>
            )}
          </div>
        )}

        {!canEdit && !canSubmit && (
          <p className="text-sm text-gray-400 text-center">
            Esta oferta no puede modificarse en su estado actual.
          </p>
        )}
      </form>
    </div>
  );
}
