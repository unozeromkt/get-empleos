import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Briefcase, Users, TrendingUp, Plus, Eye, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { ApplicationStatusBadge } from "@/components/candidates/ApplicationStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils/date";
import type { JobWithArea, ApplicationStatus } from "@/lib/types/database";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const [
    { data: jobsData, count: totalJobs },
    { count: totalCandidates },
    { count: hiredCount },
    { count: pendingCount },
    { count: totalCompanies },
    { count: pendingCompaniesCount },
    { count: pendingReviewJobsCount },
    { data: recentAppsData },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, area:job_areas(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("profiles").select("id", { count: "exact" }).eq("role", "candidate"),
    supabase.from("applications").select("id", { count: "exact" }).eq("status", "hired"),
    supabase.from("applications").select("id", { count: "exact" }).eq("status", "pending"),
    supabase.from("companies").select("id", { count: "exact" }),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase
      .from("applications")
      .select("id, status, applied_at, job:jobs(title), candidate:candidates(profile:profiles(full_name, avatar_url))")
      .order("applied_at", { ascending: false })
      .limit(5),
  ]);

  const jobs = (jobsData ?? []) as JobWithArea[];
  const activeJobs = jobs.filter((j) => j.status === "active").length;

  // Aplanar JOINs de postulaciones recientes
  type RecentApp = {
    id: string;
    status: ApplicationStatus;
    applied_at: string;
    job_title: string;
    candidate_name: string;
    avatar_url: string | null;
  };

  const recentApps: RecentApp[] = (recentAppsData ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const jobRaw = r.job as Record<string, unknown>[] | Record<string, unknown> | null;
    const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
    const candidateRaw = r.candidate as Record<string, unknown>[] | Record<string, unknown> | null;
    const cand = Array.isArray(candidateRaw) ? candidateRaw[0] : candidateRaw;
    const profileRaw = cand?.profile as Record<string, unknown>[] | Record<string, unknown> | undefined;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    return {
      id:             r.id         as string,
      status:         r.status     as ApplicationStatus,
      applied_at:     r.applied_at as string,
      job_title:      (job?.title  as string) ?? "—",
      candidate_name: (profile?.full_name as string) ?? "—",
      avatar_url:     (profile?.avatar_url as string | null) ?? null,
    };
  });

  const STATS = [
    {
      label: "Ofertas activas",
      value: activeJobs,
      total: totalJobs ?? 0,
      icon: Briefcase,
      color: "blue",
      href: "/admin/jobs",
    },
    {
      label: "Empresas registradas",
      value: totalCompanies ?? 0,
      icon: Building2,
      color: "purple",
      href: "/admin/companies",
    },
    {
      label: "Candidatos en base",
      value: totalCandidates ?? 0,
      icon: Users,
      color: "cyan",
      href: "/admin/candidates",
    },
    {
      label: "Contratados",
      value: hiredCount ?? 0,
      icon: TrendingUp,
      color: "green",
      href: "/admin/applications",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Resumen de actividad del portal</p>
        </div>
        <Link href="/admin/jobs/new">
          <Button className="bg-brand-blue hover:bg-brand-blue/90 text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva oferta
          </Button>
        </Link>
      </div>

      {/* Alertas de pendientes */}
      <div className="space-y-3">
        {(pendingCompaniesCount ?? 0) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{pendingCompaniesCount} empresa{pendingCompaniesCount !== 1 ? "s" : ""}</strong>{" "}
              esperando aprobación.
            </p>
            <Link href="/admin/companies?status=pending" className="ml-auto">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                Revisar empresas
              </Button>
            </Link>
          </div>
        )}

        {(pendingReviewJobsCount ?? 0) > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-brand-blue shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>{pendingReviewJobsCount} oferta{pendingReviewJobsCount !== 1 ? "s" : ""}</strong>{" "}
              de empresa{pendingReviewJobsCount !== 1 ? "s" : ""} esperando revisión.
            </p>
            <Link href="/admin/jobs?status=pending_review" className="ml-auto">
              <Button size="sm" className="bg-brand-blue hover:bg-brand-blue/90 text-white">
                Revisar ofertas
              </Button>
            </Link>
          </div>
        )}

        {(pendingCount ?? 0) > 0 && (
          <div className="bg-brand-yellow/10 border border-brand-yellow/20 rounded-2xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700">
              <strong>{pendingCount} postulación{pendingCount !== 1 ? "es" : ""}</strong>{" "}
              pendiente{pendingCount !== 1 ? "s" : ""} de revisión.
            </p>
            <Link href="/admin/applications?status=pending" className="ml-auto">
              <Button size="sm" className="bg-brand-yellow text-brand-navy font-semibold hover:bg-brand-yellow/90">
                Revisar ahora
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ label, value, total, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="group">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-brand-blue/30 hover:shadow-sm transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorBg(color)}`}>
                <Icon className={`w-5 h-5 ${colorText(color)}`} />
              </div>
              <p className="font-display text-2xl font-bold text-brand-navy">{value}</p>
              {total !== undefined && (
                <p className="text-xs text-gray-400">de {total} total</p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Postulaciones recientes */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-display font-bold text-brand-navy text-sm">Postulaciones recientes</h2>
            <Link href="/admin/applications" className="text-xs text-brand-blue hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentApps.map((app) => (
              <div key={app.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {app.avatar_url ? (
                    <Image
                      src={app.avatar_url}
                      alt={app.candidate_name}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-brand-navy">
                      {app.candidate_name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-navy line-clamp-1">{app.candidate_name}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{app.job_title}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <ApplicationStatusBadge status={app.status} />
                  <span className="text-xs text-gray-400">{timeAgo(app.applied_at)}</span>
                </div>
              </div>
            ))}
            {recentApps.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400">Sin postulaciones aún.</p>
            )}
          </div>
        </div>

        {/* Ofertas recientes */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-display font-bold text-brand-navy text-sm">Gestión de ofertas</h2>
            <Link href="/admin/jobs/new" className="text-xs text-brand-blue hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" />
              Nueva
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-navy line-clamp-1">{job.title}</p>
                  <p className="text-xs text-gray-500">{job.city} · {job.area?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <JobStatusBadge status={job.status} />
                  <Link
                    href={`/admin/jobs/${job.id}/applications`}
                    className="p-1 text-gray-400 hover:text-brand-blue transition-colors"
                    title="Ver postulaciones"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100">
            <Link href="/admin/jobs">
              <Button variant="outline" size="sm" className="w-full border-brand-blue text-brand-blue">
                Ver todas las ofertas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function colorBg(color: string) {
  const map: Record<string, string> = {
    blue:   "bg-blue-50",
    purple: "bg-purple-50",
    cyan:   "bg-cyan-50",
    green:  "bg-green-50",
  };
  return map[color] ?? "bg-gray-50";
}

function colorText(color: string) {
  const map: Record<string, string> = {
    blue:   "text-brand-blue",
    purple: "text-brand-purple",
    cyan:   "text-brand-cyan",
    green:  "text-brand-green",
  };
  return map[color] ?? "text-gray-500";
}
