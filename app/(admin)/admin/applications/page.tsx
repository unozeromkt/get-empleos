import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/candidates/ApplicationStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";
import type { ApplicationStatus } from "@/lib/types/database";

const STATUS_OPTIONS: { value: ApplicationStatus | ""; label: string }[] = [
  { value: "",            label: "Todas" },
  { value: "pending",     label: "Pendiente" },
  { value: "reviewing",   label: "En revisión" },
  { value: "shortlisted", label: "Preseleccionado" },
  { value: "rejected",    label: "No continúa" },
  { value: "hired",       label: "Contratado" },
];

type AppRow = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string;
  job: { title: string; city: string } | null;
  candidate: { full_name: string; career: string | null; avatar_url: string | null } | null;
};

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const filter = (searchParams.status ?? "") as ApplicationStatus | "";

  const { data, error: queryError } = await supabase
    .from("applications")
    .select(`
      id, job_id, status, applied_at,
      job:jobs(title, city),
      candidate:candidates(career, profile:profiles(full_name, avatar_url))
    `)
    .order("applied_at", { ascending: false });

  if (queryError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-600 text-sm">
        <p className="font-semibold mb-1">No se pudieron cargar las postulaciones</p>
        <p className="font-mono text-xs">{queryError.message}</p>
        <p className="mt-3 text-xs text-red-500">
          Verifica que las políticas RLS en Supabase estén configuradas correctamente.
        </p>
      </div>
    );
  }

  // Aplanar JOINs anidados (Supabase devuelve arrays sin tipos generados)
  const apps: AppRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const jobRaw = row.job as Record<string, unknown>[] | Record<string, unknown> | null;
    const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;

    const candidateRaw = row.candidate as Record<string, unknown>[] | Record<string, unknown> | null;
    const cand = Array.isArray(candidateRaw) ? candidateRaw[0] : candidateRaw;

    const profileRaw = cand?.profile as Record<string, unknown>[] | Record<string, unknown> | undefined;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

    return {
      id:         row.id         as string,
      job_id:     row.job_id     as string,
      status:     row.status     as ApplicationStatus,
      applied_at: row.applied_at as string,
      job: job ? {
        title: job.title as string,
        city:  job.city  as string,
      } : null,
      candidate: cand ? {
        full_name:  profile?.full_name  as string ?? "—",
        career:     cand.career         as string | null,
        avatar_url: (profile?.avatar_url as string | null) ?? null,
      } : null,
    };
  });

  const filtered = filter ? apps.filter((a) => a.status === filter) : apps;

  const counts = apps.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Todas las postulaciones</h1>
        <p className="text-gray-500 text-sm mt-1">{apps.length} postulaciones en total</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map(({ value, label }) => {
          const count = value === "" ? apps.length : (counts[value] ?? 0);
          const href = value ? `/admin/applications?status=${value}` : "/admin/applications";
          return (
            <Link
              key={value}
              href={href}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                filter === value
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"
              }`}
            >
              {label} ({count})
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Candidato</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Oferta</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Estado</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {app.candidate?.avatar_url ? (
                          <Image
                            src={app.candidate.avatar_url}
                            alt={app.candidate.full_name}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-brand-navy">
                            {app.candidate?.full_name?.charAt(0) ?? "?"}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-brand-navy">{app.candidate?.full_name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{app.candidate?.career ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-gray-700 line-clamp-1">{app.job?.title ?? "—"}</p>
                    <p className="text-xs text-gray-400">{app.job?.city ?? "—"}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ApplicationStatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-xs text-gray-500">
                    {formatDate(app.applied_at)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/jobs/${app.job_id}/applications`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors inline-flex"
                      title="Ver en oferta"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No hay postulaciones{filter ? " con este filtro" : " registradas aún"}.
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
