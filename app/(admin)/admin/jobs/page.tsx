import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Eye, Pencil, Users, Building2, Briefcase, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { AdminJobReviewActions } from "@/components/admin/AdminJobReviewActions";
import { JobRowActions } from "@/components/admin/JobRowActions";
import { JobsSearchBar } from "@/components/admin/JobsSearchBar";
import { createClient } from "@/lib/supabase/server";
import { formatSalaryRange } from "@/lib/utils/salary";
import { formatDate } from "@/lib/utils/date";
import type { JobWithCompany } from "@/lib/types/database";

const STATUS_TABS = [
  { value: "",               label: "Todas" },
  { value: "pending_review", label: "En revisión" },
  { value: "active",         label: "Activas" },
  { value: "draft",          label: "Borrador" },
  { value: "paused",         label: "Pausadas" },
  { value: "closed",         label: "Cerradas" },
  { value: "archived",       label: "Papelera" },
];

interface Props {
  searchParams: { status?: string; company?: string; company_name?: string };
}

/** Oferta con el agregado embebido de candidatos. */
type JobRow = JobWithCompany & {
  candidate_count?: { count: number }[] | { count: number } | null;
};

export default async function AdminJobsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  // Resolver búsqueda por nombre de empresa a IDs
  let companyIds: string[] | null = null;
  if (searchParams.company_name?.trim()) {
    const { data: matching } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", `%${searchParams.company_name.trim()}%`);
    companyIds = (matching ?? []).map((c) => c.id);
  }

  // Si hay búsqueda por nombre pero no hay matches, devolver vacío sin ejecutar más queries
  const noResults = companyIds !== null && companyIds.length === 0;

  // Construir query con filtros.
  //
  // El conteo sale de `job_candidates` y no de `applications`: esa tabla solo
  // tiene a quien se postuló por el portal, así que las hojas de vida que el
  // admin carga sobre la oferta no aparecían y la columna mostraba 0.
  // `job_candidates` es el espejo de ambos orígenes (migración 015).
  let query = supabase
    .from("jobs")
    .select("*, area:job_areas(*), company:companies(id, name), candidate_count:job_candidates(count)")
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  } else {
    // La papelera tiene su propia pestaña: no debe ensuciar el listado general
    query = query.neq("status", "archived");
  }
  if (searchParams.company) {
    query = query.eq("company_id", searchParams.company);
  }
  if (companyIds && companyIds.length > 0) {
    query = query.in("company_id", companyIds);
  }

  const [{ data: jobsData }, { count: pendingReviewCount }] = await Promise.all([
    noResults ? Promise.resolve({ data: [] }) : query,
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
  ]);

  const jobs = (jobsData ?? []) as JobRow[];

  // PostgREST devuelve el agregado embebido como array de un elemento; según
  // la versión puede llegar como objeto suelto.
  const candidatesOf = (job: JobRow) => {
    const raw = job.candidate_count;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list[0]?.count ?? 0;
  };

  const activeFilter = searchParams.status ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">Gestión de ofertas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {jobs.length} oferta{jobs.length !== 1 ? "s" : ""}
            {searchParams.company_name
              ? ` de empresas con "${searchParams.company_name}"`
              : searchParams.status
              ? ` con estado "${searchParams.status}"`
              : " en total"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <JobsSearchBar />
          <Link href="/admin/jobs/new-ai">
            <Button
              variant="outline"
              className="border-brand-purple text-brand-purple hover:bg-brand-purple/5"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Crear con IA
            </Button>
          </Link>
          <Link href="/admin/jobs/new">
            <Button className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva oferta
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de revisión pendiente */}
      {(pendingReviewCount ?? 0) > 0 && activeFilter !== "pending_review" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{pendingReviewCount} oferta{pendingReviewCount !== 1 ? "s" : ""}</strong>{" "}
            de empresa{pendingReviewCount !== 1 ? "s" : ""} esperando revisión.
          </p>
          <a href="?status=pending_review" className="ml-auto shrink-0">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
              Revisar ahora
            </Button>
          </a>
        </div>
      )}

      {/* Tabs de estado */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(({ value, label }) => (
          <a
            key={value}
            href={value ? `?status=${value}` : "?"}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeFilter === value
                ? "bg-brand-navy text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-navy"
            }`}
          >
            {label}
            {value === "pending_review" && (pendingReviewCount ?? 0) > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingReviewCount}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Oferta
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">
                  Área / Ciudad
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">
                  Salario
                </th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Estado
                </th>
                <th
                  className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell"
                  title="Postulados por el portal + hojas de vida cargadas por un admin"
                >
                  Candidatos
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">
                  Publicado
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => {
                const isPendingReview = job.status === "pending_review";
                return (
                  <tr
                    key={job.id}
                    className={`transition-colors ${isPendingReview ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-5 py-4">
                      {/* El título es la entrada natural a la ficha de la oferta */}
                      <Link
                        href={`/admin/jobs/${job.id}/candidatos`}
                        className="font-medium text-brand-navy line-clamp-1 max-w-[200px] hover:text-brand-blue hover:underline"
                      >
                        {job.title}
                      </Link>
                      {job.featured && (
                        <span className="text-xs text-brand-yellow">★ Destacada</span>
                      )}
                      {/* Empresa que la publicó */}
                      {job.company && (
                        <Link
                          href={`/admin/companies/${job.company.id}`}
                          className="flex items-center gap-1 text-[11px] text-brand-purple hover:underline mt-0.5"
                        >
                          <Building2 className="w-3 h-3" />
                          {job.company.name}
                        </Link>
                      )}
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="text-gray-700">{job.area?.name}</div>
                      <div className="text-gray-400 text-xs">{job.city}</div>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell text-brand-green font-medium">
                      {job.salary_visible ? (
                        formatSalaryRange(job.salary_min, job.salary_max)
                      ) : (
                        <span className="text-gray-400">A convenir</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <JobStatusBadge status={job.status} />
                    </td>

                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <Link
                        href={`/admin/jobs/${job.id}/candidatos`}
                        className="inline-flex items-center gap-1 text-gray-700 hover:text-brand-blue"
                        title="Ver candidatos de esta oferta"
                      >
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {candidatesOf(job)}
                      </Link>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell text-gray-500 text-xs">
                      {job.published_at ? formatDate(job.published_at) : "—"}
                    </td>

                    <td className="px-4 py-4">
                      {isPendingReview ? (
                        /* Acciones inline de aprobar/rechazar para ofertas en revisión */
                        <AdminJobReviewActions jobId={job.id} />
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          {job.status !== "archived" && (
                            <>
                              <Link
                                href={`/admin/jobs/${job.id}/candidatos`}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                                title="Ver candidatos, perfil y subir hojas de vida"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/admin/jobs/${job.id}/edit`}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                                title="Editar oferta"
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </>
                          )}
                          <JobRowActions
                            jobId={job.id}
                            status={job.status}
                            title={job.title}
                            applications={candidatesOf(job)}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {jobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Briefcase className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {searchParams.status === "pending_review"
                        ? "No hay ofertas pendientes de revisión."
                        : "No hay ofertas con ese estado."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
