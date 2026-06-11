"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle, Briefcase, CheckCircle2, FileEdit, Eye, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { toggleEmpresaJobPauseAction } from "@/lib/actions/empresa";
import type { Job } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

const STATUS_CONFIG = {
  draft:   { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  active:  { label: "Activa",   color: "bg-emerald-100 text-emerald-700" },
  paused:  { label: "Pausada",  color: "bg-blue-100 text-blue-700" },
  closed:  { label: "Cerrada",  color: "bg-red-100 text-red-600" },
  // pending_review puede quedar en legacy (ofertas antiguas)
  pending_review: { label: "En revisión", color: "bg-amber-100 text-amber-700" },
};

export default function EmpresaJobsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<{ id: string; status: string } | null>(null);
  const [jobs, setJobs] = useState<(Job & { area: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      supabase
        .from("companies")
        .select("id, status")
        .eq("created_by", user.id)
        .maybeSingle()
        .then(({ data: co }) => {
          if (!co) { router.push("/empresa/onboarding"); return; }
          setCompany(co);
          supabase
            .from("jobs")
            .select("*, area:job_areas(name)")
            .eq("company_id", co.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              setJobs((data ?? []) as (Job & { area: { name: string } | null })[]);
              setLoading(false);
            });
        });
    });
  }, [router]);

  const refresh = () => {
    if (!company) return;
    const supabase = createClient();
    supabase
      .from("jobs")
      .select("*, area:job_areas(name)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setJobs((data ?? []) as (Job & { area: { name: string } | null })[]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="w-6 h-6 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
      </div>
    );
  }

  const isApproved = company?.status === "approved";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">Mis ofertas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {jobs.length} oferta{jobs.length !== 1 ? "s" : ""} creada{jobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isApproved && (
          <Link href="/empresa/jobs/new">
            <Button className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              <PlusCircle className="w-4 h-4 mr-2" />
              Nueva oferta
            </Button>
          </Link>
        )}
      </div>

      {!isApproved && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          Tu empresa debe estar aprobada para crear ofertas. Estado actual:{" "}
          <strong>
            {company?.status === "pending" ? "Pendiente de revisión" : "Rechazada"}
          </strong>
        </div>
      )}

      {/* Lista */}
      {!jobs.length ? (
        <EmptyState
          icon={Briefcase}
          title="Sin ofertas aún"
          description={
            isApproved
              ? "Crea tu primera oferta para empezar a recibir candidatos."
              : "Cuando tu empresa sea aprobada podrás crear ofertas."
          }
          action={
            isApproved ? (
              <Link href="/empresa/jobs/new">
                <Button className="bg-brand-blue text-white">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Crear primera oferta
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  onRefresh,
}: {
  job: Job & { area: { name: string } | null };
  onRefresh: () => void;
}) {
  const status = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
  const canEdit   = job.status === "draft";
  const canToggle = job.status === "active" || job.status === "paused";
  const [isToggling, startToggle] = useTransition();

  const handleToggle = () => {
    if (!canToggle) return;
    startToggle(async () => {
      await toggleEmpresaJobPauseAction(job.id, job.status as "active" | "paused");
      onRefresh();
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Briefcase className="w-5 h-5 text-brand-blue" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-brand-navy truncate">{job.title}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
            {status.label}
          </span>
          {job.status === "active" && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Visible al público
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {job.city}
          {job.area?.name ? ` · ${job.area.name}` : ""}
          {job.vacancies ? ` · ${job.vacancies} vacante${job.vacancies !== 1 ? "s" : ""}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canToggle && (
          <Button
            variant="outline"
            size="sm"
            disabled={isToggling}
            onClick={handleToggle}
            className={`text-xs ${
              job.status === "active"
                ? "border-blue-200 text-blue-600 hover:bg-blue-50"
                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
            }`}
          >
            {isToggling ? (
              <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
            ) : job.status === "active" ? (
              <><Pause className="w-3.5 h-3.5 mr-1" />Pausar</>
            ) : (
              <><Play className="w-3.5 h-3.5 mr-1" />Activar</>
            )}
          </Button>
        )}
        <Link href={`/empresa/jobs/${job.id}/postulaciones`}>
          <Button variant="outline" size="sm" className="text-xs">
            <Eye className="w-3.5 h-3.5 mr-1" />
            Candidatos
          </Button>
        </Link>
        <Link href={`/empresa/jobs/${job.id}/edit`}>
          <Button variant="outline" size="sm" className="text-xs">
            <FileEdit className="w-3.5 h-3.5 mr-1" />
            {canEdit ? "Editar" : "Ver"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
