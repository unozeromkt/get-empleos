import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { BulkCVUpload } from "@/components/admin/BulkCVUpload";
import { JobTabs } from "@/components/admin/JobTabs";
import { createClient } from "@/lib/supabase/server";

export default async function JobCVsPage({ params }: { params: { id: string } }) {
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

      <JobTabs jobId={params.id} active="cvs" />

      <div>
        <h2 className="font-display text-xl font-bold text-brand-navy">Subir hojas de vida</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Evalúa candidatos que llegaron por fuera del portal. No necesitan tener cuenta: el
          sistema extrae su perfil y lo compara con los requisitos de esta oferta.
        </p>
      </div>

      {!job.current_profile_version_id && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 max-w-2xl">
          Esta oferta no tiene perfil estructurado, así que las hojas de vida se procesarán pero
          no obtendrán puntuación. Créala con IA para habilitar la evaluación.
        </div>
      )}

      <BulkCVUpload jobId={params.id} />
    </div>
  );
}
