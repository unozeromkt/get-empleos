import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationCard } from "@/components/candidates/ApplicationCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationWithDetails } from "@/lib/types/database";

const STATUS_LABELS: Record<string, string> = {
  all:         "Todas",
  pending:     "Pendiente",
  reviewing:   "En revisión",
  shortlisted: "Preseleccionado",
  rejected:    "No continúa",
  hired:       "Contratado",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: appsData } = await supabase
    .from("applications")
    .select("*, job:jobs(*, area:job_areas(*), company:companies(*))")
    .eq("candidate_id", user.id)
    .order("applied_at", { ascending: false });

  const allApps   = (appsData ?? []) as ApplicationWithDetails[];
  const filterStatus = searchParams.status && searchParams.status !== "all"
    ? searchParams.status
    : null;

  const apps = filterStatus
    ? allApps.filter((a) => a.status === filterStatus)
    : allApps;

  // Conteo por estado
  const counts = allApps.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Mis postulaciones</h1>
        <p className="text-gray-500 text-sm mt-1">
          {allApps.length} postulación{allApps.length !== 1 ? "es" : ""} en total
        </p>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.entries(STATUS_LABELS).map(([value, label]) => {
          const count = value === "all" ? allApps.length : (counts[value] ?? 0);
          const isActive = (searchParams.status ?? "all") === value;
          return (
            <Link
              key={value}
              href={`/applications?status=${value}`}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"
              }`}
            >
              {label} {count > 0 && `(${count})`}
            </Link>
          );
        })}
      </div>

      {apps.length === 0 ? (
        allApps.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Sin postulaciones"
            description="Aún no te has postulado a ninguna oferta. Explora las vacantes disponibles."
            action={
              <Link href="/jobs">
                <Button className="bg-brand-blue text-white">
                  Explorar ofertas
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
            <p className="text-gray-500 text-sm">No hay postulaciones con este estado.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {apps.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  );
}
