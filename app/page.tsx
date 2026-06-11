import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Briefcase, Users, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DecorativeBlobs } from "@/components/shared/DecorativeBlobs";
import { HeroSearch } from "@/components/jobs/HeroSearch";
import { createClient } from "@/lib/supabase/server";
import { formatSalaryRange } from "@/lib/utils/salary";
import { timeAgo } from "@/lib/utils/date";
import type { JobWithCompany, JobArea } from "@/lib/types/database";

const STATS = [
  { label: "Vacantes activas",     value: "120+", icon: Briefcase },
  { label: "Candidatos inscritos", value: "3.4K+", icon: Users },
  { label: "Contratados este mes", value: "87",    icon: CheckCircle2 },
  { label: "Empresas aliadas",     value: "40+",   icon: TrendingUp },
];

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto:     "Remoto",
  hibrido:    "Híbrido",
};

export default async function HomePage() {
  const supabase = await createClient();

  const [
    { data: featuredJobs = [] },
    { data: recentJobsData = [] },
    { data: jobAreas = [] },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, area:job_areas(*), company:companies(*)")
      .eq("status", "active")
      .eq("featured", true)
      .order("published_at", { ascending: false })
      .limit(6),
    supabase
      .from("jobs")
      .select("*, area:job_areas(*)")
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(10),
    supabase.from("job_areas").select("*").order("name"),
  ]);

  const jobs        = (featuredJobs   ?? []) as JobWithCompany[];
  const recentJobs  = (recentJobsData ?? []) as JobWithCompany[];
  const areas       = (jobAreas       ?? []) as JobArea[];

  // "Nueva" = publicada en los últimos 5 días
  const FIVE_DAYS_AGO = Date.now() - 5 * 24 * 60 * 60 * 1000;
  const isNew = (publishedAt: string | null) =>
    publishedAt ? new Date(publishedAt).getTime() > FIVE_DAYS_AGO : false;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative min-h-[540px] flex items-center">
        {/* Imagen de fondo — overflow-hidden solo aquí */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/hero-image.jpg"
            alt="Portal de empleo Get Company"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Overlay leve para legibilidad */}
          <div className="absolute inset-0 bg-brand-navy/50" />
        </div>

        {/* Contenido centrado */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-5 backdrop-blur-sm">
            Portal oficial de empleo · Get Company
          </span>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-4 drop-shadow-sm">
            Encuentra tu{" "}
            <span className="text-brand-yellow">próxima oportunidad</span>{" "}
            laboral
          </h1>

          <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
            Conectamos talento con las mejores empresas de Colombia.
          </p>

          <HeroSearch />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-brand-navy">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ofertas recientes ── */}
      {recentJobs.length > 0 && (
        <section className="bg-white py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-brand-navy">Ofertas recientes</h2>
                <p className="text-gray-500 mt-1">Las últimas vacantes publicadas en el portal</p>
              </div>
              <Link href="/jobs" className="hidden sm:flex items-center gap-1 text-brand-blue text-sm font-medium hover:underline">
                Ver todas
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.slug}`} className="group">
                  <div className="flex items-center gap-4 bg-brand-light rounded-2xl px-5 py-4 border border-transparent hover:border-brand-blue/30 hover:shadow-sm transition-all">
                    {/* Ícono de área */}
                    <div className="w-11 h-11 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 group-hover:bg-brand-blue transition-colors">
                      <Briefcase className="w-5 h-5 text-brand-blue group-hover:text-white transition-colors" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-brand-navy text-sm leading-snug group-hover:text-brand-blue transition-colors truncate">
                          {job.title}
                        </p>
                        {isNew(job.published_at ?? null) && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-brand-green text-white px-2 py-0.5 rounded-full">
                            Nueva
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {job.area?.name}
                        {job.city ? ` · ${job.city}` : ""}
                        {job.modality ? ` · ${MODALITY_LABEL[job.modality] ?? job.modality}` : ""}
                      </p>
                    </div>

                    {/* Salario */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-brand-green whitespace-nowrap">
                        {job.salary_visible
                          ? formatSalaryRange(job.salary_min, job.salary_max)
                          : "A convenir"}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(job.published_at!)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Link href="/jobs">
                <Button variant="outline" className="border-brand-navy/20 text-brand-navy rounded-full">
                  Ver todas las ofertas
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Áreas ── */}
      {areas.length > 0 && (
        <section className="bg-brand-light py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Explora por área</h2>
            <p className="text-gray-500 mb-8">Encuentra ofertas en el sector que más te apasiona</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {areas.map((area) => (
                <Link
                  key={area.id}
                  href={`/jobs?area=${area.slug}`}
                  className="bg-white rounded-2xl p-4 text-center shadow-sm hover:shadow-md hover:border-brand-blue border border-transparent transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-brand-blue transition-colors">
                    <Briefcase className="w-5 h-5 text-brand-blue group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-brand-navy">{area.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Ofertas destacadas ── */}
      {jobs.length > 0 && (
        <section className="bg-white py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-brand-navy">Ofertas destacadas</h2>
                <p className="text-gray-500 mt-1">Las vacantes más recientes y mejor remuneradas</p>
              </div>
              <Link href="/jobs" className="hidden sm:flex items-center gap-1 text-brand-blue text-sm font-medium hover:underline">
                Ver todas
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.slug}`} className="group">
                  <div className="bg-brand-light rounded-2xl p-5 border border-transparent hover:border-brand-blue/30 hover:shadow-md transition-all h-full flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-flex items-center text-xs font-medium bg-brand-blue/10 text-brand-blue px-2.5 py-1 rounded-full">
                        {job.area?.name}
                      </span>
                      <span className="text-xs font-medium bg-brand-yellow/20 text-brand-yellow px-2.5 py-1 rounded-full">
                        Destacada
                      </span>
                    </div>
                    <h3 className="font-display font-semibold text-brand-navy text-lg leading-snug mb-2 group-hover:text-brand-blue transition-colors">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border">
                        {job.city}
                      </span>
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border">
                        {MODALITY_LABEL[job.modality ?? "presencial"]}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-brand-green">
                        {job.salary_visible
                          ? formatSalaryRange(job.salary_min, job.salary_max)
                          : "Salario a convenir"}
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(job.published_at!)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link href="/jobs">
                <Button variant="outline" className="border-brand-navy/20 text-brand-navy rounded-full">
                  Ver todas las ofertas
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="relative bg-brand-navy text-white overflow-hidden py-16">
        <DecorativeBlobs variant="cta" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            ¿Listo para dar el siguiente paso?
          </h2>
          <p className="text-white/70 text-lg mb-8">
            Registra tu hoja de vida y empieza a recibir ofertas que se ajusten a tu perfil.
          </p>
          <Link href="/auth/register">
            <Button
              size="lg"
              className="bg-brand-yellow hover:bg-brand-yellow/90 text-brand-navy font-bold rounded-full px-8"
            >
              Crear mi cuenta gratis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
