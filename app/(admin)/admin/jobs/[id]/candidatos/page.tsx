import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

import { CandidateMatchTable } from "@/components/admin/CandidateMatchTable";
import { JobTabs } from "@/components/admin/JobTabs";
import { listJobCandidatesAction } from "@/lib/actions/ai-screening";
import { createClient } from "@/lib/supabase/server";

export default async function JobCandidatesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, current_profile_version_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!job) notFound();

  const rows = await listJobCandidatesAction(params.id);

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

      <h1 className="font-display text-2xl font-bold text-brand-navy">{job.title as string}</h1>

      <JobTabs jobId={params.id} active="candidatos" />

      {/* Sin perfil estructurado no hay criterios contra los que evaluar */}
      {!job.current_profile_version_id && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Esta oferta no tiene perfil estructurado</p>
          <p className="mt-0.5">
            Los criterios de evaluación se extraen del documento de la vacante. Sin ellos no se
            puede calcular la compatibilidad de los candidatos.{" "}
            <Link href="/admin/jobs/new-ai" className="underline font-medium">
              Crea la oferta con IA
            </Link>{" "}
            para habilitar el screening automático.
          </p>
        </div>
      )}

      <CandidateMatchTable jobId={params.id} rows={rows} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 flex items-start gap-1.5 max-w-xl">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Las puntuaciones son una ayuda para priorizar la revisión, no una decisión de
          contratación. Ningún candidato se descarta automáticamente.
        </p>

        {/* La vista clásica conserva carta de presentación, notas internas y
            exportación a CSV, que esta pestaña todavía no cubre */}
        <Link
          href={`/admin/jobs/${params.id}/applications`}
          className="text-xs text-brand-blue hover:underline shrink-0"
        >
          Ver postulaciones con carta y notas internas →
        </Link>
      </div>
    </div>
  );
}
