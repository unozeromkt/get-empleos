import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Sparkles, Pencil, Eye } from "lucide-react";

import { JobTabs } from "@/components/admin/JobTabs";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { Button } from "@/components/ui/button";
import type { JobProfile } from "@/lib/ai/schemas/job-profile";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";
import type { JobStatus } from "@/lib/types/database";

interface Props {
  params: { id: string };
}

const IMPORTANCE_LABEL: Record<string, string> = {
  must_have: "Indispensable",
  required: "Requerido",
  preferred: "Deseable",
};

const IMPORTANCE_STYLE: Record<string, string> = {
  must_have: "bg-status-shortlisted/10 text-status-shortlisted border-status-shortlisted/30",
  required: "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
  preferred: "bg-gray-100 text-gray-600 border-gray-300",
};

export default async function JobProfilePage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, slug, status, city, ai_generated, current_profile_version_id, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!job) notFound();

  const { data: version } = await supabase
    .from("job_profile_versions")
    .select("id, version, profile, confidence, model_name, prompt_version, extractor_version, confirmed_at, source")
    .eq("job_id", params.id)
    .eq("status", "confirmed")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const profile = version?.profile as JobProfile | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium truncate max-w-[240px]">
          {job.title as string}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy flex items-center gap-2">
            {job.title as string}
            {job.ai_generated && (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/30"
                title="Creada a partir de un documento con IA"
              >
                <Sparkles className="w-3 h-3" />
                IA
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
            <JobStatusBadge status={job.status as JobStatus} />
            <span>{job.city as string}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/jobs/${job.slug as string}`} target="_blank">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-1.5" />
              Ver pública
            </Button>
          </Link>
          <Link href={`/admin/jobs/${job.id as string}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="w-4 h-4 mr-1.5" />
              Editar
            </Button>
          </Link>
        </div>
      </div>

      <JobTabs jobId={params.id} active="perfil" />

      {/* Cerrar el bucle: tras confirmar, el admin aterriza aquí y necesita
          saber por qué la oferta todavía no se ve en el portal público */}
      {job.status !== "active" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-900">
            Esta oferta está en <strong>{job.status === "draft" ? "borrador" : (job.status as string)}</strong> y
            no aparece en el portal público.
          </p>
          <Link href={`/admin/jobs/${job.id as string}/edit`}>
            <Button size="sm" className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              Publicar oferta
            </Button>
          </Link>
        </div>
      )}

      {!profile ? (
        <div className="rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-brand-navy font-medium">Esta oferta no tiene perfil estructurado</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Se creó manualmente. El perfil estructurado solo se genera al crear la oferta desde un
            documento con IA, y es lo que permite evaluar candidatos automáticamente.
          </p>
          <Link href="/admin/jobs/new-ai" className="inline-block mt-4">
            <Button variant="outline" size="sm">
              <Sparkles className="w-4 h-4 mr-1.5" />
              Crear una oferta con IA
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Trazabilidad: sin esto un score no se puede explicar meses después */}
          <div className="rounded-2xl border border-gray-200 bg-brand-light p-4 text-xs text-gray-600 flex flex-wrap gap-x-6 gap-y-1.5">
            <span>
              <strong className="text-brand-navy">Versión:</strong> {version?.version as number}
            </span>
            <span>
              <strong className="text-brand-navy">Origen:</strong> {version?.source as string}
            </span>
            <span>
              <strong className="text-brand-navy">Modelo:</strong> {(version?.model_name as string) ?? "—"}
            </span>
            <span>
              <strong className="text-brand-navy">Prompt:</strong> {version?.prompt_version as string}
            </span>
            <span>
              <strong className="text-brand-navy">Confianza:</strong>{" "}
              {version?.confidence ? `${Math.round(Number(version.confidence) * 100)}%` : "—"}
            </span>
            {version?.confirmed_at && (
              <span>
                <strong className="text-brand-navy">Aprobado:</strong>{" "}
                {formatDate(version.confirmed_at as string)}
              </span>
            )}
          </div>

          <Panel
            title="Criterios de evaluación"
            hint="Estos son los requisitos que se usarán para calcular el match de cada candidato."
          >
            {profile.required_skills.length === 0 ? (
              <Empty>No se extrajeron habilidades del documento.</Empty>
            ) : (
              <ul className="space-y-2">
                {profile.required_skills.map((skill, i) => (
                  <li key={i} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-brand-navy">{skill.raw_name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${IMPORTANCE_STYLE[skill.importance]}`}
                      >
                        {IMPORTANCE_LABEL[skill.importance]}
                      </span>
                      {skill.minimum_years !== null && (
                        <span className="text-xs text-gray-500">{skill.minimum_years}+ años</span>
                      )}
                    </div>
                    {skill.evidence && (
                      <p className="text-xs text-gray-500 italic mt-1.5 border-l-2 border-gray-200 pl-2">
                        &ldquo;{skill.evidence}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Responsabilidades">
            {profile.responsibilities.length === 0 ? (
              <Empty>No se extrajeron responsabilidades.</Empty>
            ) : (
              <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
                {profile.responsibilities.map((r, i) => (
                  <li key={i}>{r.text}</li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid sm:grid-cols-2 gap-5">
            <Panel title="Experiencia y formación">
              <Row
                label="Experiencia mínima"
                value={
                  profile.experience_requirements.minimum_years !== null
                    ? `${profile.experience_requirements.minimum_years} años`
                    : null
                }
              />
              <Row
                label="Formación"
                value={
                  profile.education_requirements
                    .map((e) => [e.level, e.field].filter(Boolean).join(" en "))
                    .join(" · ") || null
                }
              />
              <Row
                label="Certificaciones"
                value={profile.certifications.map((c) => c.name).join(" · ") || null}
              />
            </Panel>

            <Panel title="Idiomas y condiciones">
              <Row
                label="Idiomas"
                value={
                  profile.languages
                    .map((l) => (l.minimum_level ? `${l.language} (${l.minimum_level})` : l.language))
                    .join(" · ") || null
                }
              />
              <Row label="Modalidad" value={profile.location.work_mode} />
              <Row label="Beneficios" value={profile.benefits.join(" · ") || null} />
            </Panel>
          </div>

          {profile.knockout_requirements.length > 0 && (
            <Panel
              title="Requisitos excluyentes"
              hint="Se marcan como brecha crítica, pero nunca descartan al candidato automáticamente."
            >
              <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                {profile.knockout_requirements.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 p-5 space-y-3">
      <div>
        <h2 className="font-display font-semibold text-brand-navy">{title}</h2>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-sm">
      <span className="font-medium text-brand-navy">{label}: </span>
      {value ? (
        <span className="text-gray-700">{value}</span>
      ) : (
        <span className="text-gray-400 italic">no especificado</span>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 italic">{children}</p>;
}
