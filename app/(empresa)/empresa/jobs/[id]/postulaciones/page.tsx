import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmpresaApplicationCard, type ApplicationData } from "@/components/empresa/EmpresaApplicationCard";

interface Props {
  params: { id: string };
}

export default async function EmpresaJobApplicationsPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("created_by", user.id)
    .maybeSingle();

  if (!company) redirect("/empresa/onboarding");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, city, status")
    .eq("id", params.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (!job) notFound();

  // Obtener postulaciones SIN admin_notes (campo explícitamente omitido)
  const { data: applications } = await supabase
    .from("applications")
    .select(`
      id, status, cover_letter, applied_at, updated_at,
      candidate:candidates!inner(
        id, career, years_experience, education_level, skills,
        profile:profiles!inner(id, full_name, email, city, avatar_url)
      )
    `)
    .eq("job_id", job.id)
    .order("applied_at", { ascending: false });

  const total = applications?.length ?? 0;
  const byStatus = {
    pending:     applications?.filter((a) => a.status === "pending").length     ?? 0,
    reviewing:   applications?.filter((a) => a.status === "reviewing").length   ?? 0,
    shortlisted: applications?.filter((a) => a.status === "shortlisted").length ?? 0,
    hired:       applications?.filter((a) => a.status === "hired").length       ?? 0,
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/empresa/jobs" className="text-gray-400 hover:text-brand-navy mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">
            Candidatos — {job.title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {job.city} · {total} postulación{total !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {/* Mini stats */}
      {total > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Nuevas",       value: byStatus.pending,     color: "text-gray-600" },
            { label: "En revisión",  value: byStatus.reviewing,   color: "text-brand-blue" },
            { label: "Preseleccionados", value: byStatus.shortlisted, color: "text-brand-purple" },
            { label: "Contratados",  value: byStatus.hired,       color: "text-brand-green" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
              <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Listado */}
      {!applications?.length ? (
        <EmptyState
          icon={Users}
          title="Sin postulaciones aún"
          description="Aún no hay candidatos para esta oferta."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <EmpresaApplicationCard key={app.id} application={app as unknown as ApplicationData} />
          ))}
        </div>
      )}
    </div>
  );
}
