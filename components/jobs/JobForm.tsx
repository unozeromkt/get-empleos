"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobWithArea, Company } from "@/lib/types/database";
import { createJobAction, updateJobAction } from "@/lib/actions/jobs";

// Áreas de trabajo (se pueden cargar desde Supabase si se desea, por ahora estáticas)
const JOB_AREAS = [
  { id: 1,  name: "Ventas" },
  { id: 2,  name: "Logística" },
  { id: 3,  name: "Manufactura" },
  { id: 4,  name: "Administrativo" },
  { id: 5,  name: "Tecnología" },
  { id: 6,  name: "Servicio al cliente" },
  { id: 7,  name: "Finanzas" },
  { id: 8,  name: "Recursos humanos" },
  { id: 9,  name: "Operaciones" },
  { id: 10, name: "Marketing" },
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
  { value: "por_obra",        label: "Por obra" },
];

const COLOMBIA_CITIES = [
  "Medellín", "Bogotá", "Cali", "Barranquilla", "Cartagena",
  "Bucaramanga", "Pereira", "Manizales", "Santa Marta", "Cúcuta",
  "Ibagué", "Villavicencio", "Montería", "Pasto", "Armenia",
];

type FormData = {
  title:          string;
  company_id:     string;
  area_id:        string;
  modality:       string;
  contract_type:  string;
  city:           string;
  department:     string;
  vacancies:      string;
  salary_min:     string;
  salary_max:     string;
  salary_visible: boolean;
  featured:       boolean;
  status:         string;
  description:    string;
  requirements:   string;
  benefits:       string;
};

const DEFAULT_FORM: FormData = {
  title:          "",
  company_id:     "",
  area_id:        "1",
  modality:       "presencial",
  contract_type:  "tiempo_completo",
  city:           "Medellín",
  department:     "Antioquia",
  vacancies:      "1",
  salary_min:     "",
  salary_max:     "",
  salary_visible: true,
  featured:       false,
  status:         "active",
  description:    "",
  requirements:   "",
  benefits:       "",
};

function jobToForm(job: JobWithArea): FormData {
  return {
    title:          job.title,
    company_id:     job.company_id ?? "",
    area_id:        String(job.area_id ?? 1),
    modality:       job.modality       ?? "presencial",
    contract_type:  job.contract_type  ?? "tiempo_completo",
    city:           job.city,
    department:     job.department     ?? "",
    vacancies:      String(job.vacancies ?? 1),
    salary_min:     String(job.salary_min ?? ""),
    salary_max:     String(job.salary_max ?? ""),
    salary_visible: job.salary_visible ?? true,
    featured:       job.featured       ?? false,
    status:         job.status,
    description:    job.description,
    requirements:   job.requirements   ?? "",
    benefits:       job.benefits       ?? "",
  };
}

export function JobForm({ job, companies = [] }: { job?: JobWithArea; companies?: Company[] }) {
  const [form,     setForm]     = useState<FormData>(job ? jobToForm(job) : DEFAULT_FORM);
  const [errors,   setErrors]   = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData();
    Object.entries({ ...form, status: asDraft ? "draft" : form.status }).forEach(
      ([k, v]) => formData.set(k, String(v))
    );

    startTransition(async () => {
      const result = job
        ? await updateJobAction(job.id, formData)
        : await createJobAction(formData);

      if (result?.error) {
        setErrors(result.error as unknown as Record<string, string[]>);
      }
      // Si no hay error, el Server Action redirige automáticamente
    });
  };

  const formError = errors._form?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {formError}
        </div>
      )}

      {/* Información básica */}
      <Section title="Información básica">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Empresa *" error={errors.company_id?.[0]}>
              <select
                required
                value={form.company_id}
                onChange={(e) => set("company_id", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {companies.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay empresas registradas.{" "}
                  <a href="/admin/companies/new" className="underline font-medium">Crear una</a>
                </p>
              )}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Título del cargo *" error={errors.title?.[0]}>
              <Input
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ej: Asesor Comercial Externo"
              />
            </Field>
          </div>
          <Field label="Área" error={errors.area_id?.[0]}>
            <select
              value={form.area_id}
              onChange={(e) => set("area_id", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {JOB_AREAS.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Modalidad">
            <select
              value={form.modality}
              onChange={(e) => set("modality", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MODALITIES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de contrato">
            <select
              value={form.contract_type}
              onChange={(e) => set("contract_type", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CONTRACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Vacantes">
            <Input
              type="number"
              min="1"
              max="999"
              value={form.vacancies}
              onChange={(e) => set("vacancies", e.target.value)}
            />
          </Field>
          <Field label="Ciudad">
            <select
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COLOMBIA_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Departamento">
            <Input
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="Antioquia"
            />
          </Field>
        </div>
      </Section>

      {/* Salario */}
      <Section title="Salario">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Salario mínimo (COP)">
            <Input
              type="number"
              value={form.salary_min}
              onChange={(e) => set("salary_min", e.target.value)}
              placeholder="1300000"
            />
          </Field>
          <Field label="Salario máximo (COP)">
            <Input
              type="number"
              value={form.salary_max}
              onChange={(e) => set("salary_max", e.target.value)}
              placeholder="2500000"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <input
            type="checkbox"
            id="salary_visible"
            checked={form.salary_visible}
            onChange={(e) => set("salary_visible", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
          />
          <label htmlFor="salary_visible" className="text-sm text-gray-700">
            Mostrar salario en la oferta
          </label>
        </div>
      </Section>

      {/* Descripción */}
      <Section title="Descripción del cargo">
        {errors.description?.[0] && (
          <p className="text-xs text-red-500 mb-2">{errors.description[0]}</p>
        )}
        <textarea
          required
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={8}
          placeholder="Describe las funciones, responsabilidades y objetivo del cargo. Puedes usar **texto** para negrita y - para listas."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        />
      </Section>

      {/* Requisitos */}
      <Section title="Requisitos">
        <textarea
          value={form.requirements}
          onChange={(e) => set("requirements", e.target.value)}
          rows={5}
          placeholder="- Experiencia mínima de 2 años&#10;- Bachiller o técnico&#10;- Vehículo propio"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        />
      </Section>

      {/* Beneficios */}
      <Section title="Beneficios">
        <textarea
          value={form.benefits}
          onChange={(e) => set("benefits", e.target.value)}
          rows={5}
          placeholder="- Salario + comisiones&#10;- Seguro de vida&#10;- Capacitaciones"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        />
      </Section>

      {/* Opciones */}
      <Section title="Opciones de publicación">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="featured"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
            />
            <label htmlFor="featured" className="text-sm text-gray-700">
              Oferta destacada (aparece primero)
            </label>
          </div>
        </div>
      </Section>

      {/* Acciones */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
          disabled={isPending}
          className="text-sm text-gray-500 hover:text-brand-navy underline disabled:opacity-50"
        >
          Guardar como borrador
        </button>
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {job ? "Actualizar oferta" : "Publicar oferta"}
              </span>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <h2 className="font-display font-semibold text-brand-navy mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-navy mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
