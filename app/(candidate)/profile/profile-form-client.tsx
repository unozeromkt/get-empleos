"use client";

import { useState, useTransition, useRef } from "react";
import { CheckCircle2, Upload, ExternalLink, Save, X, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { TagInput } from "@/components/profile/TagInput";
import { updateCandidateProfileAction, uploadCVAction } from "@/lib/actions/candidates";
import type { Profile, Candidate } from "@/lib/types/database";

const EDUCATION_OPTIONS = [
  { value: "bachiller",    label: "Bachiller" },
  { value: "tecnico",      label: "Técnico" },
  { value: "tecnologo",    label: "Tecnólogo" },
  { value: "profesional",  label: "Profesional" },
  { value: "especialista", label: "Especialista" },
  { value: "maestria",     label: "Maestría" },
  { value: "doctorado",    label: "Doctorado" },
];

const AVAILABILITY_OPTIONS = [
  { value: "inmediata", label: "Inmediata" },
  { value: "15_dias",   label: "En 15 días" },
  { value: "30_dias",   label: "En 30 días" },
];

interface Props {
  profile:   Profile;
  candidate: Candidate | null;
}

export function ProfileFormClient({ profile, candidate }: Props) {
  const [saved,        setSaved]        = useState(false);
  const [saveError,    setSaveError]    = useState("");
  const [isPending,    startTransition] = useTransition();
  const [cvPending,    setCvPending]    = useState(false);
  const [cvError,      setCvError]      = useState("");
  const [hasCv,        setHasCv]        = useState(!!candidate?.cv_url);
  const [cvUpdatedAt,  setCvUpdatedAt]  = useState<string | null>(candidate?.cv_updated_at ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name:        profile.full_name ?? "",
    email:            profile.email     ?? "",
    phone:            profile.phone     ?? "",
    city:             profile.city      ?? "",
    career:           candidate?.career ?? "",
    years_experience: String(candidate?.years_experience ?? 0),
    education_level:  candidate?.education_level ?? "profesional",
    availability:     candidate?.availability    ?? "inmediata",
    expected_salary:  String(candidate?.expected_salary ?? ""),
    summary:          candidate?.summary         ?? "",
    linkedin_url:     candidate?.linkedin_url    ?? "",
  });

  const [skills,    setSkills]    = useState<string[]>(candidate?.skills    ?? []);
  const [languages, setLanguages] = useState<string[]>(candidate?.languages ?? []);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaved(false);

    const formData = new FormData();
    Object.entries(form).forEach(([key, val]) => formData.set(key, val));
    formData.set("skills",    skills.join(","));
    formData.set("languages", languages.join(","));

    startTransition(async () => {
      const result = await updateCandidateProfileAction(formData);
      if (result?.error) {
        const errObj = result.error as unknown as Record<string, string[]>;
        const msg = errObj._form?.[0] ?? Object.values(errObj)[0]?.[0] ?? "Error al guardar.";
        setSaveError(msg);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCvError("");
    setCvPending(true);

    const formData = new FormData();
    formData.set("cv", file);

    const result = await uploadCVAction(formData);
    setCvPending(false);

    if (result?.error) {
      setCvError(typeof result.error === "string" ? result.error : "Error al subir el CV.");
    } else {
      setHasCv(true);
      setCvUpdatedAt(new Date().toISOString());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Mi perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Mantén tu información actualizada para aumentar tus posibilidades.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Foto y CV */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display font-semibold text-brand-navy mb-4">Foto y documentos</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Foto con recorte */}
            <AvatarUpload
              currentUrl={profile.avatar_url ?? null}
              name={form.full_name || profile.email}
            />

            {/* CV */}
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-navy mb-2">Hoja de vida (CV)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleCVUpload}
              />

              {hasCv ? (
                /* Vista previa cuando hay CV cargado */
                <div className="border border-brand-green/30 bg-brand-green/5 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-green/15 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-brand-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-navy truncate">
                      hoja_de_vida.pdf
                    </p>
                    {cvUpdatedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Actualizado el{" "}
                        {new Date(cvUpdatedAt).toLocaleDateString("es-CO", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    )}
                    <p className="text-xs text-brand-green flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3 h-3" />
                      CV listo para postulaciones
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={cvPending}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-brand-navy border border-brand-blue/20 hover:border-brand-navy/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cvPending ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {cvPending ? "Subiendo..." : "Actualizar"}
                  </button>
                </div>
              ) : (
                /* Zona de carga cuando no hay CV */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-brand-blue transition-colors cursor-pointer"
                >
                  {cvPending ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
                      <p className="text-sm text-gray-500">Subiendo...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        Arrastra tu CV aquí o{" "}
                        <span className="text-brand-blue font-medium">selecciona un archivo</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF · Máx. 5 MB</p>
                    </>
                  )}
                </div>
              )}

              {cvError && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-2">
                  <X className="w-3.5 h-3.5" />
                  {cvError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Datos personales */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display font-semibold text-brand-navy mb-4">Datos personales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre completo">
              <Input
                required
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
              />
            </Field>
            <Field label="Correo electrónico">
              <Input type="email" value={form.email} readOnly className="bg-gray-50 text-gray-400 cursor-not-allowed" />
            </Field>
            <Field label="Teléfono">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="300 123 4567" />
            </Field>
            <Field label="Ciudad de residencia">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Medellín" />
            </Field>
          </div>
        </div>

        {/* Información profesional */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display font-semibold text-brand-navy mb-4">Información profesional</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Carrera o área de estudio">
              <Input
                value={form.career}
                onChange={(e) => set("career", e.target.value)}
                placeholder="Ingeniería de Sistemas"
              />
            </Field>
            <Field label="Nivel de educación">
              <select
                value={form.education_level}
                onChange={(e) => set("education_level", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {EDUCATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Años de experiencia">
              <Input
                type="number"
                min="0"
                max="50"
                value={form.years_experience}
                onChange={(e) => set("years_experience", e.target.value)}
              />
            </Field>
            <Field label="Disponibilidad">
              <select
                value={form.availability}
                onChange={(e) => set("availability", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {AVAILABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Aspiración salarial (COP/mes)">
              <Input
                type="number"
                value={form.expected_salary}
                onChange={(e) => set("expected_salary", e.target.value)}
                placeholder="2500000"
              />
            </Field>
            <Field label="LinkedIn">
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={form.linkedin_url}
                  onChange={(e) => set("linkedin_url", e.target.value)}
                  className="pl-9"
                  placeholder="linkedin.com/in/tu-perfil"
                />
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Resumen profesional">
              <textarea
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Describe brevemente tu experiencia y habilidades..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{form.summary.length}/500</p>
            </Field>
          </div>
        </div>

        {/* Habilidades e idiomas */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display font-semibold text-brand-navy mb-4">Habilidades e idiomas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Habilidades" hint="Escribe y presiona coma o Enter">
              <TagInput
                tags={skills}
                onChange={setSkills}
                placeholder="React, TypeScript, Excel…"
              />
            </Field>
            <Field label="Idiomas" hint="Escribe y presiona coma o Enter">
              <TagInput
                tags={languages}
                onChange={setLanguages}
                placeholder="Español, Inglés…"
              />
            </Field>
          </div>
        </div>

        {/* Guardar */}
        <div className="flex items-center justify-end gap-3">
          {saveError && (
            <span className="text-sm text-red-600">{saveError}</span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-brand-green">
              <CheckCircle2 className="w-4 h-4" />
              Cambios guardados
            </span>
          )}
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
                Guardar cambios
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-navy mb-1.5">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1 text-xs">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
