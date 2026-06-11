import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Clock, CheckCircle2, XCircle, PlusCircle,
  Users, ArrowRight, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function EmpresaDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("created_by", user.id)
    .maybeSingle();

  // Sin perfil → onboarding
  if (!company) redirect("/empresa/onboarding");

  // Estadísticas (solo si está aprobada)
  const stats = {
    total_jobs: 0,
    active_jobs: 0,
    pending_review_jobs: 0,
    draft_jobs: 0,
    total_applications: 0,
    new_applications: 0,
  };

  if (company.status === "approved") {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("company_id", company.id);

    if (jobs) {
      stats.total_jobs = jobs.length;
      stats.active_jobs = jobs.filter((j) => j.status === "active").length;
      stats.pending_review_jobs = jobs.filter((j) => j.status === "pending_review").length;
      stats.draft_jobs = jobs.filter((j) => j.status === "draft").length;

      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length > 0) {
        const { data: apps } = await supabase
          .from("applications")
          .select("id, status")
          .in("job_id", jobIds);

        if (apps) {
          stats.total_applications = apps.length;
          stats.new_applications = apps.filter((a) => a.status === "pending").length;
        }
      }
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">
          Bienvenido, {company.name}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Panel de gestión de tu empresa en GetEmpleos
        </p>
      </div>

      {/* Estado de aprobación */}
      {company.status === "pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-amber-800">
              Tu empresa está en revisión
            </h2>
            <p className="text-amber-700 text-sm mt-1">
              El equipo de Get Company está revisando la información de tu empresa.
              Te notificaremos por correo cuando sea aprobada. Mientras tanto,
              puedes completar o actualizar tu perfil.
            </p>
            <Link href="/empresa/perfil" className="inline-block mt-3">
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                Editar perfil de empresa
              </Button>
            </Link>
          </div>
        </div>
      )}

      {company.status === "rejected" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-red-800">
              Solicitud rechazada
            </h2>
            {company.rejection_reason && (
              <p className="text-red-700 text-sm mt-1">
                <strong>Motivo:</strong> {company.rejection_reason}
              </p>
            )}
            <p className="text-red-700 text-sm mt-2">
              Actualiza la información de tu empresa y comunícate con Get Company
              para solicitar una nueva revisión.
            </p>
            <Link href="/empresa/perfil" className="inline-block mt-3">
              <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100">
                Actualizar perfil
              </Button>
            </Link>
          </div>
        </div>
      )}

      {company.status === "approved" && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-emerald-700 text-sm font-medium">
              Tu empresa está aprobada. Puedes publicar ofertas de trabajo.
            </p>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Ofertas activas"
              value={stats.active_jobs}
              icon={<CheckCircle2 className="w-4 h-4 text-brand-green" />}
              color="bg-brand-green/10"
            />
            <StatCard
              label="En revisión"
              value={stats.pending_review_jobs}
              icon={<Clock className="w-4 h-4 text-amber-500" />}
              color="bg-amber-50"
            />
            <StatCard
              label="Postulaciones"
              value={stats.total_applications}
              icon={<Users className="w-4 h-4 text-brand-blue" />}
              color="bg-brand-blue/10"
            />
            <StatCard
              label="Nuevas"
              value={stats.new_applications}
              icon={<AlertCircle className="w-4 h-4 text-brand-purple" />}
              color="bg-brand-purple/10"
            />
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/empresa/jobs/new"
              className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                    <PlusCircle className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy text-sm">Nueva oferta</p>
                    <p className="text-gray-400 text-xs">Crear y publicar una vacante</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-blue transition-colors" />
              </div>
            </Link>

            <Link
              href="/empresa/postulaciones"
              className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-brand-purple" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy text-sm">Ver candidatos</p>
                    <p className="text-gray-400 text-xs">
                      {stats.new_applications > 0
                        ? `${stats.new_applications} nuevas sin revisar`
                        : "Gestionar postulaciones"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-purple transition-colors" />
              </div>
            </Link>
          </div>

          {/* Últimas ofertas */}
          {stats.total_jobs > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-brand-navy">
                  Mis ofertas
                </h2>
                <Link href="/empresa/jobs" className="text-sm text-brand-blue hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="space-y-1 text-sm text-gray-500">
                {stats.draft_jobs > 0 && (
                  <p>{stats.draft_jobs} borrador{stats.draft_jobs !== 1 ? "es" : ""}</p>
                )}
                {stats.pending_review_jobs > 0 && (
                  <p>{stats.pending_review_jobs} en revisión por Get Company</p>
                )}
                {stats.active_jobs > 0 && (
                  <p>{stats.active_jobs} activa{stats.active_jobs !== 1 ? "s" : ""} recibiendo postulaciones</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="font-display text-2xl font-bold text-brand-navy">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
