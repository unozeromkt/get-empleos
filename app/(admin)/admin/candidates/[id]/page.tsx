import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Download, MapPin, Mail, Phone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationStatusBadge } from "@/components/candidates/ApplicationStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { getCVDownloadUrl } from "@/lib/actions/candidates";
import { formatSalary } from "@/lib/utils/salary";
import { formatDate } from "@/lib/utils/date";
import type { ApplicationStatus } from "@/lib/types/database";

const EDUCATION_LABELS: Record<string, string> = {
  bachiller:    "Bachiller",
  tecnico:      "Técnico",
  tecnologo:    "Tecnólogo",
  profesional:  "Profesional",
  especialista: "Especialista",
  maestria:     "Maestría",
  doctorado:    "Doctorado",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  inmediata: "Inmediata",
  "15_dias": "En 15 días",
  "30_dias": "En 30 días",
};

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  // Cargar candidato + perfil
  const { data: candidateData } = await supabase
    .from("candidates")
    .select("*, profile:profiles(*)")
    .eq("id", params.id)
    .single();

  if (!candidateData) notFound();

  // Aplanar el JOIN profile (Supabase devuelve array sin schema generado)
  const raw = candidateData as Record<string, unknown>;
  const profileArr = raw.profile as Record<string, unknown>[] | Record<string, unknown>;
  const profileRaw = Array.isArray(profileArr) ? profileArr[0] : profileArr;

  const candidate = {
    id:               raw.id               as string,
    career:           raw.career           as string | null,
    years_experience: raw.years_experience as number,
    education_level:  raw.education_level  as string | null,
    availability:     raw.availability     as string | null,
    expected_salary:  raw.expected_salary  as number | null,
    summary:          raw.summary          as string | null,
    skills:           (raw.skills ?? [])   as string[],
    languages:        (raw.languages ?? []) as string[],
    linkedin_url:     raw.linkedin_url     as string | null,
    cv_url:           raw.cv_url           as string | null,
    profile: {
      full_name:  profileRaw?.full_name  as string,
      email:      profileRaw?.email      as string,
      phone:      profileRaw?.phone      as string | null,
      city:       profileRaw?.city       as string | null,
      avatar_url: (profileRaw?.avatar_url as string | null) ?? null,
    },
  };

  // Cargar postulaciones del candidato
  const { data: appsData } = await supabase
    .from("applications")
    .select("id, status, applied_at, job:jobs(id, title)")
    .eq("candidate_id", params.id)
    .order("applied_at", { ascending: false });

  // Aplanar JOINs de Supabase (retorna arrays en tipos sin schema generado)
  const apps = (appsData ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const jobArr = r.job as Record<string, unknown>[] | Record<string, unknown> | null;
    const job = Array.isArray(jobArr) ? jobArr[0] : jobArr;
    return {
      id:         r.id         as string,
      status:     r.status     as ApplicationStatus,
      applied_at: r.applied_at as string,
      job: job ? { id: job.id as string, title: job.title as string } : null,
    };
  });

  // Obtener URL firmada del CV si existe
  let cvDownloadUrl: string | null = null;
  if (candidate.cv_url) {
    cvDownloadUrl = await getCVDownloadUrl(candidate.cv_url);
  }

  const profile = candidate.profile;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/candidates" className="hover:text-brand-blue">Candidatos</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">{profile.full_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-navy/10 flex items-center justify-center overflow-hidden shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-brand-navy">{profile.full_name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-brand-navy">{profile.full_name}</h1>
              <p className="text-gray-500 text-sm">{candidate.career ?? "—"}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {profile.city}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {profile.email}
                </span>
                {profile.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {profile.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          {cvDownloadUrl ? (
            <a href={cvDownloadUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-brand-blue text-white shrink-0">
                <Download className="w-4 h-4 mr-1.5" />
                Descargar CV
              </Button>
            </a>
          ) : (
            <span className="text-xs text-gray-400 italic">Sin CV</span>
          )}
        </div>
      </div>

      {/* Datos profesionales */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h2 className="font-display font-semibold text-brand-navy mb-4">Perfil profesional</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <InfoItem label="Educación"         value={EDUCATION_LABELS[candidate.education_level ?? ""] ?? "—"} />
          <InfoItem label="Años de experiencia" value={`${candidate.years_experience} años`} />
          <InfoItem label="Disponibilidad"    value={AVAILABILITY_LABELS[candidate.availability ?? ""] ?? "—"} />
          {candidate.expected_salary && (
            <InfoItem label="Aspiración salarial" value={formatSalary(candidate.expected_salary)} />
          )}
        </div>

        {candidate.summary && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Resumen</p>
            <p className="text-sm text-gray-600">{candidate.summary}</p>
          </div>
        )}

        {candidate.skills && candidate.skills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Habilidades</p>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <span key={skill} className="text-xs bg-brand-blue/10 text-brand-blue px-2.5 py-1 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {candidate.languages && candidate.languages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Idiomas</p>
            <div className="flex flex-wrap gap-2">
              {candidate.languages.map((lang) => (
                <span key={lang} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}

        {candidate.linkedin_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-brand-blue hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Ver perfil en LinkedIn
            </a>
          </div>
        )}
      </div>

      {/* Historial de postulaciones */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h2 className="font-display font-semibold text-brand-navy mb-4">
          Postulaciones ({apps.length})
        </h2>
        {apps.length === 0 ? (
          <p className="text-sm text-gray-400">Sin postulaciones en este portal.</p>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div key={app.id} className="flex items-center gap-3 p-3 rounded-xl bg-brand-light">
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/jobs/${app.job?.id}/applications`} className="hover:text-brand-blue">
                    <p className="text-sm font-medium text-brand-navy line-clamp-1">
                      {app.job?.title ?? "—"}
                    </p>
                  </Link>
                  <p className="text-xs text-gray-400">{formatDate(app.applied_at)}</p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="font-medium text-brand-navy">{value}</p>
    </div>
  );
}
