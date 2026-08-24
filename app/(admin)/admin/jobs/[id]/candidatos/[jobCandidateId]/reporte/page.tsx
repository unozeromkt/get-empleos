import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { CandidateReportView } from "@/components/admin/CandidateReportView";
import { getCandidateReportAction } from "@/lib/actions/ai-screening";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: { id: string; jobCandidateId: string };
}

export default async function CandidateReportPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const report = await getCandidateReportAction(params.jobCandidateId);
  if ("error" in report) notFound();

  return (
    <div className="space-y-6">
      {/* Se oculta al imprimir: la navegación no aporta nada al PDF exportado */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 print:hidden">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/admin/jobs/${params.id}/candidatos`} className="hover:text-brand-blue">
          Candidatos
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">Reporte</span>
      </div>

      <CandidateReportView report={report} />
    </div>
  );
}
