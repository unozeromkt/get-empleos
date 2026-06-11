import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmpresaApplicationCard, type ApplicationData } from "@/components/empresa/EmpresaApplicationCard";

const STATUS_FILTER_OPTIONS = [
  { value: "",            label: "Todos" },
  { value: "pending",     label: "Nuevas" },
  { value: "reviewing",   label: "En revisión" },
  { value: "shortlisted", label: "Preseleccionados" },
  { value: "rejected",    label: "Rechazados" },
  { value: "hired",       label: "Contratados" },
];

interface Props {
  searchParams: { status?: string; job?: string };
}

export default async function EmpresaPostulacionesPage({ searchParams }: Props) {
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

  // Obtener jobs de la empresa para filtrar
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("company_id", company.id)
    .in("status", ["active", "paused", "closed", "pending_review"]);

  const jobIds = jobs?.map((j) => j.id) ?? [];

  // Postulaciones SIN admin_notes
  let query = supabase
    .from("applications")
    .select(`
      id, status, cover_letter, applied_at, updated_at,
      job:jobs!inner(id, title, city),
      candidate:candidates!inner(
        id, career, years_experience, education_level,
        profile:profiles!inner(id, full_name, email, city, avatar_url)
      )
    `)
    .in("job_id", jobIds.length ? jobIds : ["00000000-0000-0000-0000-000000000000"])
    .order("applied_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }
  if (searchParams.job) {
    query = query.eq("job_id", searchParams.job);
  }

  const { data: applications } = await query;
  const total = applications?.length ?? 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">
          Postulaciones
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {total} candidato{total !== 1 ? "s" : ""} postulado{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
          <a
            key={value}
            href={value ? `?status=${value}` : "?"}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              (searchParams.status ?? "") === value
                ? "bg-brand-navy text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-navy"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {!applications?.length ? (
        <EmptyState
          icon={Users}
          title="Sin postulaciones"
          description={
            searchParams.status
              ? "No hay candidatos con ese estado."
              : "Aún no hay candidatos. Publica ofertas para comenzar a recibir postulaciones."
          }
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <EmpresaApplicationCard
              key={app.id}
              application={app as unknown as ApplicationData}
              showJobTitle
            />
          ))}
        </div>
      )}
    </div>
  );
}
