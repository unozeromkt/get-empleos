import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin, Clock, Users, Briefcase, ChevronRight,
  CheckCircle2, ArrowRight, Calendar, Building2,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/JobCard";
import { createClient } from "@/lib/supabase/server";
import { formatSalaryRange } from "@/lib/utils/salary";
import { formatDate } from "@/lib/utils/date";
import type { JobWithCompany } from "@/lib/types/database";

export const revalidate = 60;

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto:     "Remoto",
  hibrido:    "Híbrido",
};

const CONTRACT_LABEL: Record<string, string> = {
  tiempo_completo: "Tiempo completo",
  tiempo_parcial:  "Tiempo parcial",
  temporal:        "Temporal",
  por_obra:        "Por obra",
};

function renderDescription(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      return (
        <h4 key={i} className="font-display font-semibold text-brand-navy mt-4 mb-1">
          {trimmed.replace(/\*\*/g, "")}
        </h4>
      );
    }
    if (trimmed.startsWith("-")) {
      return (
        <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
          <CheckCircle2 className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
          {trimmed.slice(1).trim()}
        </li>
      );
    }
    return (
      <p key={i} className="text-gray-600 text-sm leading-relaxed">
        {trimmed}
      </p>
    );
  });
}

export default async function JobDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = await createClient();

  const { data: jobData } = await supabase
    .from("jobs")
    .select("*, area:job_areas(*), company:companies(*)")
    .eq("slug", params.slug)
    .eq("status", "active")
    .single();

  if (!jobData) notFound();

  const job = jobData as JobWithCompany;

  // Verificar si el usuario ya se postuló
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let alreadyApplied = false;
  if (user) {
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id")
      .eq("job_id", job.id)
      .eq("candidate_id", user.id)
      .maybeSingle();
    alreadyApplied = !!existingApp;
  }

  // Ofertas relacionadas
  const { data: relatedData } = await supabase
    .from("jobs")
    .select("*, area:job_areas(*), company:companies(*)")
    .eq("status", "active")
    .eq("area_id", job.area_id ?? 0)
    .neq("id", job.id)
    .limit(3);

  const related = (relatedData ?? []) as JobWithCompany[];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 bg-brand-light">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-1.5 text-xs text-gray-500">
            <Link href="/" className="hover:text-brand-blue transition-colors">Inicio</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/jobs" className="hover:text-brand-blue transition-colors">Ofertas</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-brand-navy font-medium line-clamp-1">{job.title}</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Contenido principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    {job.area && (
                      <span className="inline-flex items-center text-xs font-medium bg-brand-blue/10 text-brand-blue px-2.5 py-1 rounded-full mb-3">
                        {job.area.name}
                      </span>
                    )}
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy leading-tight">
                      {job.title}
                    </h1>
                  </div>
                  {job.featured && (
                    <span className="shrink-0 text-xs font-medium bg-brand-yellow/20 text-brand-yellow px-3 py-1 rounded-full">
                      Destacada
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {job.city}{job.department ? `, ${job.department}` : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    {MODALITY_LABEL[job.modality ?? "presencial"]}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {CONTRACT_LABEL[job.contract_type ?? "tiempo_completo"]}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400" />
                    {job.vacancies} vacante{job.vacancies !== 1 ? "s" : ""}
                  </span>
                  {job.published_at && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      Publicado el {formatDate(job.published_at)}
                    </span>
                  )}
                </div>

                {job.salary_visible && job.salary_min && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-xl font-bold text-brand-green">
                      {formatSalaryRange(job.salary_min, job.salary_max)}
                    </span>
                    <span className="text-gray-400 text-sm ml-1">/ mes</span>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h2 className="font-display font-bold text-brand-navy text-lg mb-4">
                  Descripción del cargo
                </h2>
                <div className="space-y-1">{renderDescription(job.description)}</div>
              </div>

              {/* Requisitos */}
              {job.requirements && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h2 className="font-display font-bold text-brand-navy text-lg mb-4">Requisitos</h2>
                  <ul className="space-y-2">
                    {renderDescription(job.requirements)}
                  </ul>
                </div>
              )}

              {/* Beneficios */}
              {job.benefits && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h2 className="font-display font-bold text-brand-navy text-lg mb-4">Beneficios</h2>
                  <ul className="space-y-2">
                    {renderDescription(job.benefits)}
                  </ul>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* CTA aplicar */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 sticky top-24">
                <h3 className="font-display font-bold text-brand-navy mb-1">¿Te interesa esta oferta?</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Postúlate ahora y da el siguiente paso en tu carrera.
                </p>

                {alreadyApplied ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-brand-green font-medium mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Ya te postulaste
                    </div>
                    <Link href="/applications">
                      <Button variant="outline" className="w-full border-brand-green text-brand-green">
                        Ver mis postulaciones
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <Link href={user ? `/jobs/${job.slug}/apply` : `/auth/login?redirectTo=/jobs/${job.slug}/apply`} className="block">
                      <Button className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold">
                        Postularme ahora
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                    {!user && (
                      <p className="text-xs text-gray-400 text-center mt-3">
                        Necesitas una cuenta para postularte
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Info empresa */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {job.company?.logo_url ? (
                      <Image
                        src={job.company.logo_url}
                        alt={job.company.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy text-sm">
                      {job.company?.name ?? "Get Company"}
                    </p>
                    {job.company?.industry && (
                      <p className="text-xs text-gray-500">{job.company.industry}</p>
                    )}
                  </div>
                </div>
                {job.company?.description && (
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">
                    {job.company.description}
                  </p>
                )}
                {job.company?.website && (
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-blue hover:underline"
                  >
                    Ver sitio web →
                  </a>
                )}
              </div>

              {/* Expiración */}
              {job.expires_at && (
                <div className="bg-brand-yellow/10 rounded-2xl p-4 border border-brand-yellow/20">
                  <p className="text-xs font-medium text-yellow-700">
                    ⏰ Oferta válida hasta el {formatDate(job.expires_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ofertas relacionadas */}
          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-xl font-bold text-brand-navy mb-5">
                Ofertas similares en {job.area?.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {related.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
