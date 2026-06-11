"use client";

import { useState, useTransition, useEffect } from "react";
import { Save, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoUpload } from "@/components/empresa/LogoUpload";
import { updateEmpresaProfileAction } from "@/lib/actions/empresa";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/types/database";

function normalizeWebsiteField(val: string): string {
  if (!val.trim()) return val;
  return /^https?:\/\//i.test(val) ? val : `https://${val}`;
}

const INDUSTRIES = [
  "Manufactura", "Logística y transporte", "Comercio y ventas",
  "Tecnología", "Servicios financieros", "Salud", "Educación",
  "Construcción", "Alimentos y bebidas", "Retail",
  "Recursos humanos", "Consultoría", "Otro",
];

const CITIES = [
  "Medellín", "Bogotá", "Cali", "Barranquilla", "Cartagena",
  "Bucaramanga", "Pereira", "Manizales", "Santa Marta", "Cúcuta",
  "Ibagué", "Villavicencio", "Montería", "Pasto", "Armenia",
];

export default function EmpresaPerfilPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({
    name: "", nit: "", legal_rep: "",
    city: "", industry: "", website: "", description: "",
  });
  const [errors, setErrors]   = useState<Record<string, string[]>>({});
  const [saved, setSaved]     = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("companies")
        .select("*")
        .eq("created_by", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCompany(data as Company);
            setForm({
              name:        data.name        ?? "",
              nit:         data.nit         ?? "",
              legal_rep:   data.legal_rep   ?? "",
              city:        data.city        ?? "",
              industry:    data.industry    ?? "",
              website:     data.website     ?? "",
              description: data.description ?? "",
            });
          }
        });
    });
  }, []);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setErrors({});
    setSaved(false);
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.set(k, v));

    startTransition(async () => {
      const result = await updateEmpresaProfileAction(company.id, data);
      if (result?.error) {
        setErrors(result.error as unknown as Record<string, string[]>);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="w-6 h-6 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">
            Perfil de empresa
          </h1>
          <p className="text-gray-500 text-sm">
            Estado:{" "}
            <span className={
              company.status === "approved" ? "text-emerald-600 font-medium" :
              company.status === "rejected" ? "text-red-600 font-medium" :
              "text-amber-600 font-medium"
            }>
              {company.status === "approved" ? "Aprobada" :
               company.status === "rejected" ? "Rechazada" : "Pendiente de revisión"}
            </span>
          </p>
        </div>
      </div>

      {company.status === "rejected" && company.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <strong>Motivo de rechazo:</strong> {company.rejection_reason}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors._form?.[0] && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {errors._form[0]}
          </div>
        )}

        {/* Logo */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display font-semibold text-brand-navy mb-4">Logo de la empresa</h2>
          <LogoUpload
            currentUrl={company.logo_url ?? null}
            companyName={company.name}
          />
        </div>

        {/* Datos legales */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
          <h2 className="font-display font-semibold text-brand-navy">Datos legales</h2>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">
              Razón social <span className="text-red-500">*</span>
            </label>
            <Input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Almacenes Éxito S.A."
            />
            {errors.name?.[0] && <p className="text-xs text-red-500 mt-1">{errors.name[0]}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">NIT</label>
              <Input
                value={form.nit}
                onChange={(e) => set("nit", e.target.value)}
                placeholder="900.123.456-7"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Representante legal
              </label>
              <Input
                value={form.legal_rep}
                onChange={(e) => set("legal_rep", e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
          </div>
        </div>

        {/* Info general */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
          <h2 className="font-display font-semibold text-brand-navy">Información general</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Ciudad</label>
              <select
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar ciudad</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">Sector</label>
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
              type="text"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              onBlur={(e) => set("website", normalizeWebsiteField(e.target.value))}
              placeholder="www.empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              maxLength={1000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/1000</p>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="bg-brand-navy hover:bg-brand-navy/90 text-white"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Guardando...
            </span>
          ) : saved ? (
            <span className="flex items-center gap-2">
              ✓ Guardado
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Guardar cambios
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
