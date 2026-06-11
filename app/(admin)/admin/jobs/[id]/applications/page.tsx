"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronRight, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationStatusBadge } from "@/components/candidates/ApplicationStatusBadge";
import { updateApplicationStatusAction } from "@/lib/actions/applications";
import { formatDate } from "@/lib/utils/date";
import type { ApplicationStatus } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

const STATUS_OPTIONS: { value: ApplicationStatus | ""; label: string }[] = [
  { value: "",            label: "Todos" },
  { value: "pending",     label: "Pendiente" },
  { value: "reviewing",   label: "En revisión" },
  { value: "shortlisted", label: "Preseleccionado" },
  { value: "rejected",    label: "No continúa" },
  { value: "hired",       label: "Contratado" },
];

const STATUS_CHANGE_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "pending",     label: "Pendiente" },
  { value: "reviewing",   label: "En revisión" },
  { value: "shortlisted", label: "Preseleccionado" },
  { value: "rejected",    label: "No continúa" },
  { value: "hired",       label: "Contratado" },
];

type AppRow = {
  id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  admin_notes: string | null;
  applied_at: string;
  candidate: {
    id: string;
    career: string | null;
    years_experience: number;
    profile: { full_name: string; email: string; avatar_url: string | null };
  } | null;
};

type JobInfo = {
  id: string;
  title: string;
};

export default function JobApplicationsPage({ params }: { params: { id: string } }) {
  const [job,        setJob]        = useState<JobInfo | null>(null);
  const [apps,       setApps]       = useState<AppRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<ApplicationStatus | "">("");
  const [statuses,   setStatuses]   = useState<Record<string, ApplicationStatus>>({});
  const [notes,      setNotes]      = useState<Record<string, string>>({});
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [{ data: jobData }, { data: appsData }] = await Promise.all([
        supabase.from("jobs").select("id, title").eq("id", params.id).single(),
        supabase
          .from("applications")
          .select(`
            id, status, cover_letter, admin_notes, applied_at,
            candidate:candidates(id, career, years_experience, profile:profiles(full_name, email, avatar_url))
          `)
          .eq("job_id", params.id)
          .order("applied_at", { ascending: false }),
      ]);

      if (jobData) setJob(jobData);

      // Aplanar JOINs: Supabase devuelve arrays para relaciones sin tipos generados
      const rows: AppRow[] = (appsData ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const candidateArr = r.candidate as Record<string, unknown>[] | Record<string, unknown> | null;
        const candidateRaw = Array.isArray(candidateArr) ? candidateArr[0] : candidateArr;
        const profileArr = candidateRaw?.profile as Record<string, unknown>[] | Record<string, unknown> | undefined;
        const profileRaw = Array.isArray(profileArr) ? profileArr[0] : profileArr;
        return {
          id:           r.id           as string,
          status:       r.status       as ApplicationStatus,
          cover_letter: r.cover_letter as string | null,
          admin_notes:  r.admin_notes  as string | null,
          applied_at:   r.applied_at   as string,
          candidate: candidateRaw ? {
            id:               candidateRaw.id               as string,
            career:           candidateRaw.career           as string | null,
            years_experience: candidateRaw.years_experience as number,
            profile: {
              full_name:  profileRaw?.full_name  as string,
              email:      profileRaw?.email      as string,
              avatar_url: (profileRaw?.avatar_url as string | null) ?? null,
            },
          } : null,
        };
      });

      setApps(rows);
      setStatuses(Object.fromEntries(rows.map((a) => [a.id, a.status])));
      setNotes(Object.fromEntries(rows.map((a) => [a.id, a.admin_notes ?? ""])));
      setLoading(false);
    }
    load();
  }, [params.id]);

  const filtered = filter ? apps.filter((a) => statuses[a.id] === filter) : apps;

  const handleStatusChange = (appId: string, newStatus: ApplicationStatus) => {
    const formData = new FormData();
    formData.set("application_id", appId);
    formData.set("status", newStatus);
    formData.set("admin_notes", notes[appId] ?? "");

    startTransition(async () => {
      const result = await updateApplicationStatusAction(formData);
      if (!result?.error) {
        setStatuses((s) => ({ ...s, [appId]: newStatus }));
      }
    });
  };

  const handleNoteSave = (appId: string) => {
    const formData = new FormData();
    formData.set("application_id", appId);
    formData.set("status", statuses[appId]);
    formData.set("admin_notes", notes[appId] ?? "");

    startTransition(async () => {
      await updateApplicationStatusAction(formData);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium line-clamp-1 max-w-[200px]">{job?.title}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">Postulaciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {job?.title} · {apps.length} candidato{apps.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a href={`/api/admin/export/applications?job_id=${params.id}`} download>
          <Button variant="outline" size="sm" className="border-brand-blue text-brand-blue">
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
        </a>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value as ApplicationStatus | "")}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === value
                ? "bg-brand-navy text-white border-brand-navy"
                : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"
            }`}
          >
            {label}
            {value === "" && ` (${apps.length})`}
            {value !== "" && ` (${apps.filter((a) => statuses[a.id] === value).length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
          <p className="text-gray-500 text-sm">No hay postulaciones con este filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const candidate = app.candidate;
            const currentStatus = statuses[app.id];
            const isOpen = selectedApp === app.id;

            return (
              <div key={app.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-4 p-5">
                  <div className="w-10 h-10 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {candidate?.profile.avatar_url ? (
                      <Image
                        src={candidate.profile.avatar_url}
                        alt={candidate.profile.full_name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-brand-navy">
                        {candidate?.profile.full_name.charAt(0) ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-navy text-sm">{candidate?.profile.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {candidate?.career ?? "—"} · {candidate?.years_experience ?? 0} años exp.
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Postulado el {formatDate(app.applied_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ApplicationStatusBadge status={currentStatus} />
                    <button
                      onClick={() => setSelectedApp(isOpen ? null : app.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                        isOpen
                          ? "bg-brand-blue text-white border-brand-blue"
                          : "border-gray-200 text-gray-600 hover:border-brand-blue hover:text-brand-blue"
                      }`}
                    >
                      Gestionar
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <Link
                      href={`/admin/candidates/${candidate?.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                      title="Ver perfil"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Panel gestión */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 bg-brand-light">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Carta de presentación */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                          Carta de presentación
                        </p>
                        {app.cover_letter ? (
                          <p className="text-sm text-gray-600 italic">&ldquo;{app.cover_letter}&rdquo;</p>
                        ) : (
                          <p className="text-sm text-gray-400">Sin carta de presentación.</p>
                        )}
                      </div>

                      {/* Cambiar estado */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                          Cambiar estado
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {STATUS_CHANGE_OPTIONS.map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => handleStatusChange(app.id, value)}
                              disabled={isPending}
                              className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors text-left disabled:opacity-60 ${
                                currentStatus === value
                                  ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                                  : "border-gray-200 text-gray-600 hover:border-brand-blue hover:text-brand-blue"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Notas internas */}
                    <div className="mt-4">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                        Notas internas (solo admin)
                      </label>
                      <textarea
                        value={notes[app.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
                        rows={2}
                        placeholder="Observaciones privadas sobre este candidato..."
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleNoteSave(app.id)}
                        disabled={isPending}
                        className="mt-2 text-xs text-brand-blue hover:underline disabled:opacity-50"
                      >
                        Guardar nota
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
