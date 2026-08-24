"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  confirmJobProfileAction,
  getJobDocumentStatusAction,
  retryJobDocumentAction,
  runWorkerNowAction,
} from "@/lib/actions/ai-jobs";
import { missingFieldsForPublish, type JobProfile } from "@/lib/ai/schemas/job-profile";
import type { Company, JobArea } from "@/lib/types/database";

type Importance = "must_have" | "required" | "preferred";

const IMPORTANCE_LABEL: Record<Importance, string> = {
  must_have: "Indispensable",
  required: "Requerido",
  preferred: "Deseable",
};

const IMPORTANCE_STYLE: Record<Importance, string> = {
  must_have: "bg-status-shortlisted/10 text-status-shortlisted border-status-shortlisted/30",
  required: "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
  preferred: "bg-gray-100 text-gray-600 border-gray-300",
};

const PROCESSING_STATES = ["uploaded", "extracting_text", "extracting_profile"];

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Documento recibido…",
  extracting_text: "Leyendo el documento…",
  extracting_profile: "Extrayendo los requisitos con IA…",
};

interface Props {
  documentId: string;
  initialStatus: string;
  initialErrorCode: string | null;
  initialErrorMessage: string | null;
  profileVersionId: string | null;
  profile: JobProfile | null;
  areas: JobArea[];
  companies: Company[];
  defaultCompanyId: string | null;
}

export function JobProfileReview(props: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(props.initialStatus);
  const [errorCode, setErrorCode] = useState(props.initialErrorCode);
  const [errorMessage, setErrorMessage] = useState(props.initialErrorMessage);

  // ── Polling mientras la cola procesa el documento ──
  useEffect(() => {
    if (!PROCESSING_STATES.includes(status)) return;

    const interval = setInterval(async () => {
      const result = await getJobDocumentStatusAction(props.documentId);
      if ("error" in result) return;

      setStatus(result.status);
      setErrorCode(result.errorCode);
      setErrorMessage(result.errorMessage);

      if (!PROCESSING_STATES.includes(result.status)) {
        clearInterval(interval);
        router.refresh();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, props.documentId, router]);

  if (PROCESSING_STATES.includes(status)) {
    return <Processing status={status} documentId={props.documentId} />;
  }

  if (status === "failed") {
    return (
      <Failed
        documentId={props.documentId}
        code={errorCode}
        message={errorMessage}
      />
    );
  }

  if (!props.profile || !props.profileVersionId) {
    return (
      <div className="rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">
        El documento se procesó pero no se encontró el perfil extraído.
      </div>
    );
  }

  return <ReviewForm {...props} profile={props.profile} profileVersionId={props.profileVersionId} />;
}

// ─── Estado: procesando ───────────────────────────────────────────────────────

function Processing({ status, documentId }: { status: string; documentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [ran, setRan] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-brand-light p-8 text-center space-y-4">
      <Loader2 className="w-10 h-10 mx-auto animate-spin text-brand-blue" />
      <div>
        <p className="font-medium text-brand-navy">{STATUS_LABEL[status] ?? "Procesando…"}</p>
        <p className="text-sm text-gray-500 mt-1">
          Esto suele tardar menos de un minuto. Puedes dejar esta pantalla abierta.
        </p>
      </div>

      {/* En local pg_cron no alcanza a localhost, así que hace falta empujar la cola a mano */}
      <div className="pt-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await runWorkerNowAction();
              setRan(
                result.summary.claimed === 0
                  ? "No había nada pendiente en la cola."
                  : `Procesados ${result.summary.succeeded} de ${result.summary.claimed}.`
              );
            })
          }
          className="text-xs text-gray-500 underline hover:text-brand-blue disabled:opacity-50"
        >
          {isPending ? "Procesando…" : "Procesar ahora (desarrollo)"}
        </button>
        {ran && <p className="text-xs text-gray-500 mt-1">{ran}</p>}
      </div>
      <input type="hidden" value={documentId} readOnly />
    </div>
  );
}

// ─── Estado: fallido ──────────────────────────────────────────────────────────

function Failed({
  documentId,
  code,
  message,
}: {
  documentId: string;
  code: string | null;
  message: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-red-900">No se pudo procesar el documento</p>
          <p className="text-sm text-red-700 mt-1">
            {message ?? "Ocurrió un error durante el procesamiento."}
          </p>
          {code && <p className="text-xs text-red-600 mt-2 font-mono">{code}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await retryJobDocumentAction(documentId);
              router.refresh();
            })
          }
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/jobs/new")}>
          Crear la oferta manualmente
        </Button>
      </div>
    </div>
  );
}

// ─── Formulario de revisión ───────────────────────────────────────────────────

function ReviewForm({
  profile: initialProfile,
  profileVersionId,
  areas,
  companies,
  defaultCompanyId,
}: Props & { profile: JobProfile; profileVersionId: string }) {
  const [profile, setProfile] = useState<JobProfile>(initialProfile);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const missing = missingFieldsForPublish(profile);
  const warnings = profile.extraction_metadata.warnings;
  const confidence = profile.extraction_metadata.confidence;

  function update(patch: Partial<JobProfile>) {
    setProfile((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit(formData: FormData) {
    formData.set("profile", JSON.stringify(profile));
    formData.set("profile_version_id", profileVersionId);

    startTransition(async () => {
      const result = await confirmJobProfileAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Confianza y advertencias */}
      <div className="rounded-2xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand-navy">Confianza de la extracción</span>
          <ConfidenceBadge value={confidence} />
        </div>

        {missing.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-amber-900">
              <p className="font-medium">Faltan datos que el documento no traía:</p>
              <ul className="list-disc list-inside mt-1">
                {missing.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs">
                La IA no los inventa. Complétalos tú antes de publicar.
              </p>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl bg-brand-light border border-gray-200 p-3 text-sm text-gray-700">
            <p className="font-medium text-brand-navy mb-1">Advertencias</p>
            <ul className="list-disc list-inside space-y-0.5">
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Datos básicos */}
      <Section title="Datos del cargo">
        <Field label="Título" required>
          <input
            value={profile.title}
            onChange={(e) => update({ title: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Resumen">
          <textarea
            value={profile.summary ?? ""}
            onChange={(e) => update({ summary: e.target.value || null })}
            rows={3}
            className={inputClass}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Ciudad" required>
            <input
              name="city"
              value={profile.location.city ?? ""}
              onChange={(e) =>
                update({ location: { ...profile.location, city: e.target.value || null } })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Departamento">
            <input
              value={profile.location.region ?? ""}
              onChange={(e) =>
                update({ location: { ...profile.location, region: e.target.value || null } })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Modalidad">
            <select
              value={profile.location.work_mode}
              onChange={(e) =>
                update({
                  location: {
                    ...profile.location,
                    work_mode: e.target.value as JobProfile["location"]["work_mode"],
                  },
                })
              }
              className={inputClass}
            >
              <option value="onsite">Presencial</option>
              <option value="hybrid">Híbrido</option>
              <option value="remote">Remoto</option>
              <option value="unspecified">Sin especificar</option>
            </select>
          </Field>

          <Field label="Tipo de contrato">
            <select
              value={profile.employment_type}
              onChange={(e) =>
                update({ employment_type: e.target.value as JobProfile["employment_type"] })
              }
              className={inputClass}
            >
              <option value="full_time">Tiempo completo</option>
              <option value="part_time">Tiempo parcial</option>
              <option value="temporary">Temporal</option>
              <option value="contract">Por obra</option>
              <option value="internship">Práctica</option>
              <option value="unspecified">Sin especificar</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Habilidades: son los criterios que usará el matching */}
      <Section
        title="Habilidades y requisitos"
        hint="Estos son los criterios con los que se evaluará a cada candidato. Editarlos cambia el score."
      >
        {profile.required_skills.length === 0 ? (
          <EmptyHint>El documento no aportó habilidades. Añádelas manualmente.</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {profile.required_skills.map((skill, index) => (
              <li
                key={index}
                className="rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2"
              >
                <input
                  value={skill.raw_name}
                  onChange={(e) => {
                    const next = [...profile.required_skills];
                    next[index] = { ...skill, raw_name: e.target.value, canonical_name: e.target.value };
                    update({ required_skills: next });
                  }}
                  className="flex-1 min-w-[160px] rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none"
                />

                <select
                  value={skill.importance}
                  onChange={(e) => {
                    const next = [...profile.required_skills];
                    next[index] = { ...skill, importance: e.target.value as Importance };
                    update({ required_skills: next });
                  }}
                  className={`text-xs rounded-lg border px-2 py-1 ${IMPORTANCE_STYLE[skill.importance]}`}
                >
                  {(Object.keys(IMPORTANCE_LABEL) as Importance[]).map((key) => (
                    <option key={key} value={key}>
                      {IMPORTANCE_LABEL[key]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    update({
                      required_skills: profile.required_skills.filter((_, i) => i !== index),
                    })
                  }
                  className="text-gray-400 hover:text-red-600 p-1"
                  aria-label={`Eliminar ${skill.raw_name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {skill.evidence && (
                  <p className="w-full text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
                    &ldquo;{skill.evidence}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <AddButton
          label="Añadir habilidad"
          onClick={() =>
            update({
              required_skills: [
                ...profile.required_skills,
                {
                  raw_name: "",
                  canonical_name: "",
                  category: "technical",
                  importance: "required",
                  proficiency: null,
                  minimum_years: null,
                  evidence: "",
                },
              ],
            })
          }
        />
      </Section>

      {/* Responsabilidades */}
      <Section title="Responsabilidades">
        {profile.responsibilities.length === 0 ? (
          <EmptyHint>El documento no aportó responsabilidades.</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {profile.responsibilities.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <textarea
                  value={item.text}
                  rows={2}
                  onChange={(e) => {
                    const next = [...profile.responsibilities];
                    next[index] = { ...item, text: e.target.value };
                    update({ responsibilities: next });
                  }}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    update({
                      responsibilities: profile.responsibilities.filter((_, i) => i !== index),
                    })
                  }
                  className="text-gray-400 hover:text-red-600 p-2"
                  aria-label="Eliminar responsabilidad"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <AddButton
          label="Añadir responsabilidad"
          onClick={() =>
            update({
              responsibilities: [
                ...profile.responsibilities,
                { text: "", importance: "medium", evidence: "" },
              ],
            })
          }
        />
      </Section>

      {/* Solo lectura: lo demás se afina en la ficha de la oferta */}
      <Section title="Otros datos extraídos">
        <ReadOnlyList
          label="Experiencia mínima"
          items={
            profile.experience_requirements.minimum_years !== null
              ? [`${profile.experience_requirements.minimum_years} años`]
              : []
          }
        />
        <ReadOnlyList
          label="Formación"
          items={profile.education_requirements.map((e) =>
            [e.level, e.field].filter(Boolean).join(" en ")
          )}
        />
        <ReadOnlyList
          label="Idiomas"
          items={profile.languages.map((l) =>
            l.minimum_level ? `${l.language} (${l.minimum_level})` : l.language
          )}
        />
        <ReadOnlyList label="Certificaciones" items={profile.certifications.map((c) => c.name)} />
        <ReadOnlyList label="Beneficios" items={profile.benefits} />
        <ReadOnlyList label="Requisitos excluyentes" items={profile.knockout_requirements} />
      </Section>

      {/* Campos que decide el admin, no la IA */}
      <Section title="Publicación" hint="Estos datos los defines tú, no salen del documento.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Área" required>
            <select name="area_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecciona un área
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vacantes">
            <input type="number" name="vacancies" min={1} defaultValue={1} className={inputClass} />
          </Field>

          <Field label="Empresa">
            <select
              name="company_id"
              defaultValue={
                defaultCompanyId ?? companies.find((c) => c.is_platform_owner)?.id ?? ""
              }
              className={inputClass}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.is_platform_owner ? " (propia)" : ""}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="salary_visible" value="true" defaultChecked />
          Mostrar el salario en la oferta pública
        </label>

        {/* Aprobar ES publicar: la revisión humana ya ocurrió en esta pantalla,
            así que no tiene sentido un paso intermedio. Se puede despublicar
            después desde el formulario de edición. */}
        <input type="hidden" name="status" value="active" />

        <p className="text-sm text-gray-600 rounded-xl bg-brand-light border border-gray-200 p-3">
          Al aprobar, la oferta se publica en el portal público y los candidatos podrán
          postularse de inmediato.
        </p>
      </Section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creando oferta…
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Aprobar y publicar oferta
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Piezas de presentación ───────────────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold text-brand-navy">{title}</h2>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-navy mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-500 italic flex items-center gap-2">
      <X className="w-4 h-4 shrink-0" />
      {children}
    </p>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
    >
      <Plus className="w-4 h-4" />
      {label}
    </button>
  );
}

function ReadOnlyList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="text-sm">
      <span className="font-medium text-brand-navy">{label}: </span>
      {items.length > 0 ? (
        <span className="text-gray-700">{items.join(" · ")}</span>
      ) : (
        <span className="text-gray-400 italic">no especificado en el documento</span>
      )}
    </div>
  );
}

/**
 * La confianza es independiente del contenido extraído (spec §20): un perfil
 * puede estar bien formado y aun así merecer poca confianza si el documento
 * era pobre.
 */
function ConfidenceBadge({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const style =
    value >= 0.8
      ? "bg-brand-green/10 text-brand-green border-brand-green/30"
      : value >= 0.6
        ? "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30"
        : "bg-red-50 text-red-600 border-red-200";

  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${style}`}>
      {percent}%
    </span>
  );
}
