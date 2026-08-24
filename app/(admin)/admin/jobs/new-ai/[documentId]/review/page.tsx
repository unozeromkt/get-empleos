import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, FileText, Sparkles } from "lucide-react";

import { JobProfileReview } from "@/components/admin/JobProfileReview";
import type { JobProfile } from "@/lib/ai/schemas/job-profile";
import { createClient } from "@/lib/supabase/server";
import type { Company, JobArea } from "@/lib/types/database";

interface Props {
  params: { documentId: string };
}

export default async function ReviewJobProfilePage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const { data: doc } = await supabase
    .from("job_documents")
    .select("id, status, error_code, error_message, original_filename, company_id, job_id")
    .eq("id", params.documentId)
    .maybeSingle();

  if (!doc) notFound();

  // Si ya se confirmó, no tiene sentido revisar de nuevo
  if (doc.job_id) redirect(`/admin/jobs/${doc.job_id}/perfil`);

  const [{ data: version }, { data: areasData }, { data: companiesData }] = await Promise.all([
    supabase
      .from("job_profile_versions")
      .select("id, profile")
      .eq("source_document_id", params.documentId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("job_areas").select("*").order("name"),
    supabase.from("companies").select("*").order("name"),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">Revisar extracción</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-purple" />
          Revisa antes de publicar
        </h1>
        <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          {doc.original_filename as string}
        </p>
      </div>

      <JobProfileReview
        documentId={params.documentId}
        initialStatus={doc.status as string}
        initialErrorCode={doc.error_code as string | null}
        initialErrorMessage={doc.error_message as string | null}
        profileVersionId={(version?.id as string) ?? null}
        profile={(version?.profile as JobProfile) ?? null}
        areas={(areasData ?? []) as JobArea[]}
        companies={(companiesData ?? []) as Company[]}
        defaultCompanyId={(doc.company_id as string) ?? null}
      />
    </div>
  );
}
