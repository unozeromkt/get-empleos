"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, Sparkles, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  confirmCandidateProfileAction,
  getCVProcessingStatusAction,
  runCandidateWorkerNowAction,
} from "@/lib/actions/ai-candidates";
import type { FieldSuggestion, FlatCandidateFields } from "@/lib/ai/candidate-mapper";
import type { CandidateProfile } from "@/lib/ai/schemas/candidate-profile";

const PROCESSING_STATES = ["uploaded", "extracting_text", "extracting_profile"];

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Hoja de vida recibida…",
  extracting_text: "Leyendo tu hoja de vida…",
  extracting_profile: "Extrayendo tu experiencia…",
};

const FIELD_LABEL: Record<string, string> = {
  full_name: "Nombre completo",
  phone: "Teléfono",
  city: "Ciudad",
  education_level: "Nivel educativo",
  career: "Carrera o área de estudio",
  years_experience: "Años de experiencia",
  linkedin_url: "LinkedIn",
  summary: "Resumen profesional",
  skills: "Habilidades",
  languages: "Idiomas",
};

const EDUCATION_LABEL: Record<string, string> = {
  bachiller: "Bachiller",
  tecnico: "Técnico",
  tecnologo: "Tecnólogo",
  profesional: "Profesional",
  especialista: "Especialista",
  maestria: "Maestría",
  doctorado: "Doctorado",
};

function displayValue(field: string, value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (field === "education_level" && typeof value === "string") {
    return EDUCATION_LABEL[value] ?? value;
  }
  return String(value);
}

interface Props {
  initialStatus: string;
  profileVersionId: string | null;
  profile: CandidateProfile | null;
  confidence: number;
  filled: Partial<FlatCandidateFields>;
  suggestions: FieldSuggestion[];
  alreadyConfirmed: boolean;
}

export function CVProfileReview(props: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(props.initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!PROCESSING_STATES.includes(status)) return;

    const interval = setInterval(async () => {
      const result = await getCVProcessingStatusAction();
      if (!("status" in result)) return;

      setStatus(result.status);
      if ("errorMessage" in result) setErrorMessage(result.errorMessage ?? null);

      if (!PROCESSING_STATES.includes(result.status)) {
        clearInterval(interval);
        router.refresh();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, router]);

  if (PROCESSING_STATES.includes(status)) return <Processing status={status} />;

  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-900">No pudimos leer tu hoja de vida</p>
            <p className="text-sm text-red-700 mt-1">
              {errorMessage ??
                "El archivo no tiene texto seleccionable. Si es un escaneo o una imagen, súbelo en PDF o Word con texto."}
            </p>
            <p className="text-sm text-red-700 mt-2">
              Puedes completar tu perfil manualmente sin problema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!props.profile || !props.profileVersionId) {
    return (
      <div className="rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">
        Todavía no hemos procesado ninguna hoja de vida. Súbela desde tu perfil.
      </div>
    );
  }

  return <ReviewForm {...props} profile={props.profile} profileVersionId={props.profileVersionId} />;
}

function Processing({ status }: { status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-gray-200 bg-brand-light p-8 text-center space-y-4">
      <Loader2 className="w-10 h-10 mx-auto animate-spin text-brand-blue" />
      <div>
        <p className="font-medium text-brand-navy">{STATUS_LABEL[status] ?? "Procesando…"}</p>
        <p className="text-sm text-gray-500 mt-1">
          Estamos leyendo tu experiencia para completar tu perfil automáticamente.
        </p>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await runCandidateWorkerNowAction();
            router.refresh();
          })
        }
        className="text-xs text-gray-500 underline hover:text-brand-blue disabled:opacity-50"
      >
        {isPending ? "Procesando…" : "Procesar ahora (desarrollo)"}
      </button>
    </div>
  );
}

function ReviewForm({
  profile,
  profileVersionId,
  confidence,
  filled,
  suggestions,
  alreadyConfirmed,
}: Props & { profile: CandidateProfile; profileVersionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filledEntries = Object.entries(filled).filter(([, v]) => v !== undefined);
  const nothingToApply = filledEntries.length === 0 && suggestions.length === 0;

  function handleSubmit(formData: FormData) {
    formData.set("profile_version_id", profileVersionId);

    startTransition(async () => {
      const result = await confirmCandidateProfileAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/profile");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-gray-200 p-5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand-navy">
            Esto extrajimos de tu hoja de vida
          </span>
          <ConfidenceBadge value={confidence} />
        </div>
        <p className="text-sm text-gray-500">
          Revísalo antes de continuar. Nada se guarda hasta que lo confirmes, y{" "}
          <strong className="text-brand-navy">nunca reemplazamos lo que ya habías escrito</strong>.
        </p>
      </div>

      {alreadyConfirmed && (
        <div className="rounded-xl bg-brand-green/10 border border-brand-green/30 p-3 text-sm text-brand-green">
          Ya confirmaste este perfil. Puedes volver a aplicarlo si lo necesitas.
        </div>
      )}

      {profile.profile_metadata.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <p className="font-medium mb-1">Ten en cuenta</p>
          <ul className="list-disc list-inside space-y-0.5">
            {profile.profile_metadata.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Campos vacíos que se van a completar */}
      {filledEntries.length > 0 && (
        <section className="rounded-2xl border border-gray-200 p-5 space-y-3">
          <div>
            <h2 className="font-display font-semibold text-brand-navy">
              Vamos a completar estos campos
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Estaban vacíos en tu perfil.</p>
          </div>

          <ul className="space-y-2">
            {filledEntries.map(([field, value]) => (
              <li
                key={field}
                className="flex items-start gap-2 rounded-xl bg-brand-light p-3 text-sm"
              >
                <Check className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-brand-navy">
                    {FIELD_LABEL[field] ?? field}:{" "}
                  </span>
                  <span className="text-gray-700">{displayValue(field, value)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Discrepancias: la persona decide, nunca se aplican solas */}
      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-gray-200 p-5 space-y-3">
          <div>
            <h2 className="font-display font-semibold text-brand-navy">
              Encontramos algo distinto a lo que tenías
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tú decides. Si no marcas nada, se conserva lo que ya habías escrito.
            </p>
          </div>

          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.field} className="rounded-xl border border-gray-200 p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="accept"
                    value={suggestion.field}
                    className="mt-1"
                  />
                  <div className="text-sm min-w-0">
                    <span className="font-medium text-brand-navy">{suggestion.label}</span>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-gray-500">
                        Tu valor actual:{" "}
                        <span className="text-brand-navy">{suggestion.currentValue}</span>
                      </p>
                      <p className="text-gray-500">
                        En tu hoja de vida:{" "}
                        <span className="text-brand-blue font-medium">
                          {suggestion.suggestedValue}
                        </span>
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Marca la casilla para usar el valor de tu hoja de vida.
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nothingToApply && (
        <div className="rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-600">
          Tu perfil ya está al día con lo que dice tu hoja de vida. No hay nada que cambiar.
        </div>
      )}

      {/* Resumen de lo leído, informativo */}
      <section className="rounded-2xl border border-gray-200 p-5 space-y-2">
        <h2 className="font-display font-semibold text-brand-navy">Resumen de tu hoja de vida</h2>
        <Row label="Experiencia" value={`${profile.experience.length} puesto(s)`} />
        <Row label="Formación" value={`${profile.education.length} título(s)`} />
        <Row label="Habilidades detectadas" value={`${profile.skills.length}`} />
        <Row label="Idiomas" value={profile.languages.map((l) => l.language).join(", ") || "—"} />
        <Row
          label="Certificaciones"
          value={profile.certifications.map((c) => c.name).join(", ") || "—"}
        />
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              Confirmar y continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/profile")}>
          Editar manualmente
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="font-medium text-brand-navy">{label}: </span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const style =
    value >= 0.8
      ? "bg-brand-green/10 text-brand-green border-brand-green/30"
      : value >= 0.6
        ? "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30"
        : "bg-red-50 text-red-600 border-red-200";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${style}`}>
      <Sparkles className="w-3 h-3" />
      {percent}%
    </span>
  );
}
