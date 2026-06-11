import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, Search, CheckCircle2, Clock, AlertCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationCard } from "@/components/candidates/ApplicationCard";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationWithDetails, JobWithCompany } from "@/lib/types/database";

const PROFILE_STEPS = [
  { key: "full_name",        label: "Datos personales" },
  { key: "education_level",  label: "Nivel educativo" },
  { key: "career",           label: "Información laboral" },
  { key: "availability",     label: "Disponibilidad" },
  { key: "cv_url",           label: "Hoja de vida (CV)" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [
    { data: profileData },
    { data: candidateData },
    { data: applicationsData },
    { data: suggestedJobsData },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, city, avatar_url, updated_at").eq("id", user.id).single(),
    supabase.from("candidates").select("*").eq("id", user.id).single(),
    supabase
      .from("applications")
      .select("*, job:jobs(*, area:job_areas(*), company:companies(*))")
      .eq("candidate_id", user.id)
      .order("applied_at", { ascending: false })
      .limit(5),
    supabase
      .from("jobs")
      .select("*, area:job_areas(*), company:companies(*)")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(6),
  ]);

  const firstName = profileData?.full_name?.split(" ")[0] ?? "Usuario";

  function avatarSrc(url: string, updatedAt: string | null | undefined): string {
    if (!url) return url;
    if (url.includes("?")) return url;
    const ts = updatedAt ? new Date(updatedAt).getTime() : 0;
    return ts ? `${url}?v=${ts}` : url;
  }
  const apps      = (applicationsData ?? []) as ApplicationWithDetails[];
  const allSuggested = (suggestedJobsData ?? []) as JobWithCompany[];

  // Personalizar sugerencias: priorizar ofertas del área del candidato
  const appliedJobIds = new Set(apps.map((a) => a.job_id));
  const candidateCareer = candidateData?.career?.toLowerCase() ?? "";
  const ranked = allSuggested
    .filter((j) => !appliedJobIds.has(j.id))
    .sort((a, b) => {
      const aMatch = candidateCareer && a.area?.name?.toLowerCase().includes(candidateCareer) ? 1 : 0;
      const bMatch = candidateCareer && b.area?.name?.toLowerCase().includes(candidateCareer) ? 1 : 0;
      return bMatch - aMatch;
    });
  const suggested = ranked.slice(0, 3);

  // Estadísticas de postulaciones
  const statusCounts = apps.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calcular completitud del perfil
  const steps = PROFILE_STEPS.map((step) => ({
    label: step.label,
    done: step.key === "cv_url"
      ? !!candidateData?.cv_url
      : step.key === "full_name"
        ? !!profileData?.full_name
        : !!(candidateData as Record<string, unknown> | null)?.[step.key],
  }));
  const profilePercent = Math.round(
    (steps.filter((s) => s.done).length / steps.length) * 100
  );

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="bg-brand-navy text-white rounded-2xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-brand-blue shrink-0 flex items-center justify-center">
          {profileData?.avatar_url ? (
            <Image
              src={avatarSrc(profileData.avatar_url, profileData.updated_at)}
              alt={firstName}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-7 h-7 text-white/70" />
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold mb-0.5">
            ¡Hola, {firstName}!
          </h1>
          <p className="text-white/70 text-sm">
            Tienes {apps.length} postulacion{apps.length !== 1 ? "es" : ""} activas.
          </p>
        </div>
      </div>

      {/* Alerta si perfil incompleto */}
      {profilePercent < 100 && (
        <div className="bg-brand-yellow/10 border border-brand-yellow/20 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-700 flex-1">
            Tu perfil está al <strong>{profilePercent}%</strong>. Complétalo para postularte a las ofertas.
          </p>
          <Link href="/profile">
            <Button size="sm" className="bg-brand-yellow text-brand-navy font-semibold hover:bg-brand-yellow/90">
              Completar perfil
            </Button>
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total"           value={apps.length}                icon={FileText}    color="blue"   />
        <StatCard label="En revisión"     value={statusCounts.reviewing ?? 0}  icon={Clock}       color="yellow" />
        <StatCard label="Preseleccionado" value={statusCounts.shortlisted ?? 0} icon={AlertCircle} color="purple" />
        <StatCard label="Contratado"      value={statusCounts.hired ?? 0}       icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Postulaciones recientes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-brand-navy">Postulaciones recientes</h2>
            <Link href="/applications" className="text-sm text-brand-blue hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {apps.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
              <p className="text-gray-500 text-sm mb-4">Aún no te has postulado a ninguna oferta.</p>
              <Link href="/jobs">
                <Button size="sm" className="bg-brand-blue text-white">
                  <Search className="w-4 h-4 mr-1.5" />
                  Explorar ofertas
                </Button>
              </Link>
            </div>
          ) : (
            apps.slice(0, 3).map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))
          )}
        </div>

        {/* Panel derecho */}
        <div className="space-y-5">
          {/* Completitud del perfil */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h3 className="font-display font-semibold text-brand-navy text-sm mb-3">
              Completitud de perfil
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-brand-blue">{profilePercent}%</span>
              <Link href="/profile" className="text-xs text-brand-blue hover:underline">
                Completar →
              </Link>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
              <div
                className="bg-brand-blue h-2 rounded-full transition-all"
                style={{ width: `${profilePercent}%` }}
              />
            </div>
            <div className="space-y-1.5">
              {steps.map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-green shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <span className={done ? "text-gray-600" : "text-gray-400"}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ofertas recomendadas */}
          {suggested.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="font-display font-semibold text-brand-navy text-sm mb-3">
                Ofertas para ti
              </h3>
              <div className="space-y-3">
                {suggested.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.slug}`} className="block group">
                    <p className="text-sm font-medium text-brand-navy group-hover:text-brand-blue transition-colors line-clamp-1">
                      {job.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {job.company ? `${job.company.name} · ` : ""}{job.city} · {job.area?.name}
                    </p>
                  </Link>
                ))}
              </div>
              <Link href="/jobs" className="mt-4 block text-center">
                <Button size="sm" variant="outline" className="w-full border-brand-blue text-brand-blue">
                  Ver más ofertas
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "yellow" | "purple" | "green";
}) {
  const colorMap = {
    blue:   "bg-blue-50 text-brand-blue",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-brand-purple",
    green:  "bg-green-50 text-brand-green",
  };
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="font-display text-2xl font-bold text-brand-navy">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
