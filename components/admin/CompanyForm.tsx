"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { Save, Building2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCompanyAction, updateCompanyAction, uploadCompanyLogoAction } from "@/lib/actions/companies";
import type { Company } from "@/lib/types/database";

const INDUSTRIES = [
  "Manufactura", "Logística y transporte", "Comercio y ventas",
  "Tecnología", "Servicios financieros", "Salud", "Educación",
  "Construcción", "Alimentos y bebidas", "Retail", "Otro",
];

const COLOMBIA_CITIES = [
  "Medellín", "Bogotá", "Cali", "Barranquilla", "Cartagena",
  "Bucaramanga", "Pereira", "Manizales", "Santa Marta", "Cúcuta",
  "Ibagué", "Villavicencio", "Montería", "Pasto", "Armenia",
];

interface Props {
  company?: Company;
}

export function CompanyForm({ company }: Props) {
  const [form, setForm] = useState({
    name:        company?.name        ?? "",
    city:        company?.city        ?? "",
    industry:    company?.industry    ?? "",
    website:     company?.website     ?? "",
    description: company?.description ?? "",
  });
  const [errors,     setErrors]     = useState<Record<string, string[]>>({});
  const [isPending,  startTransition] = useTransition();
  const [logoUrl,    setLogoUrl]    = useState<string | null>(company?.logo_url ?? null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError,  setLogoError]  = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.set(k, v));

    startTransition(async () => {
      const result = company
        ? await updateCompanyAction(company.id, formData)
        : await createCompanyAction(formData);

      if (result?.error) setErrors(result.error as Record<string, string[]>);
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!company?.id) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError("");
    setLogoLoading(true);
    const formData = new FormData();
    formData.set("logo", file);
    const result = await uploadCompanyLogoAction(company.id, formData);
    setLogoLoading(false);

    if (result?.error) {
      setLogoError(result.error);
    } else if (result?.logo_url) {
      setLogoUrl(result.logo_url + `?t=${Date.now()}`);
    }
    e.target.value = "";
  };

  const formError = errors._form?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {formError}
        </div>
      )}

      {/* Logo — solo visible al editar */}
      {company && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display font-semibold text-brand-navy mb-4">Logo de la empresa</h2>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo" width={80} height={80} className="w-full h-full object-contain p-2" />
              ) : (
                <Building2 className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoLoading}
                className="border-brand-blue/20 text-brand-blue"
              >
                {logoLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
                    Subiendo...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    {logoUrl ? "Cambiar logo" : "Subir logo"}
                  </span>
                )}
              </Button>
              {logoError && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1.5">
                  <X className="w-3 h-3" />{logoError}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">PNG, JPG · Máx. 2 MB · Fondo transparente recomendado</p>
            </div>
          </div>
        </div>
      )}

      {/* Datos básicos */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
        <h2 className="font-display font-semibold text-brand-navy">Información de la empresa</h2>

        <div>
          <label className="block text-sm font-medium text-brand-navy mb-1.5">Nombre *</label>
          <Input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ej: Almacenes Éxito S.A."
          />
          {errors.name?.[0] && <p className="text-xs text-red-500 mt-1">{errors.name[0]}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">Ciudad</label>
            <select
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar ciudad</option>
              {COLOMBIA_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">Sector / Industria</label>
            <select
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar sector</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-navy mb-1.5">Sitio web</label>
          <Input
            type="url"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://www.empresa.com"
          />
          {errors.website?.[0] && <p className="text-xs text-red-500 mt-1">{errors.website[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-navy mb-1.5">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Breve descripción de la empresa, su misión o actividad principal..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/1000</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Guardando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {company ? "Guardar cambios" : "Crear empresa"}
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
