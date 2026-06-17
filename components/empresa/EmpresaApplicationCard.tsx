"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import { MapPin, Briefcase, ChevronDown, FileDown, Loader2 } from "lucide-react";
import { updateEmpresaApplicationAction, getApplicantCVUrl } from "@/lib/actions/empresa";
import type { ApplicationStatus } from "@/lib/types/database";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string; color: string }[] = [
  { value: "pending",     label: "Nueva",            color: "bg-gray-100 text-gray-600" },
  { value: "reviewing",   label: "En revisión",      color: "bg-blue-100 text-brand-blue" },
  { value: "shortlisted", label: "Preseleccionado",  color: "bg-purple-100 text-brand-purple" },
  { value: "rejected",    label: "Rechazado",        color: "bg-red-100 text-red-600" },
  { value: "hired",       label: "Contratado",       color: "bg-emerald-100 text-brand-green" },
];

export interface ApplicationData {
  id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  applied_at: string;
  job?: { id: string; title: string; city: string } | null;
  candidate: {
    id: string;
    career: string | null;
    years_experience: number;
    education_level: string | null;
    skills: string[] | null;
    languages: string[] | null;
    cv_url: string | null;
    profile: {
      id: string;
      full_name: string;
      email: string;
      city: string | null;
      avatar_url: string | null;
    };
  };
}

interface Props {
  application: ApplicationData;
  showJobTitle?: boolean;
}

export function EmpresaApplicationCard({ application, showJobTitle }: Props) {
  const { candidate } = application;
  const profile = candidate.profile;

  const [status, setStatus]           = useState<ApplicationStatus>(application.status);
  const [isPending, startTransition]  = useTransition();
  const [error, setError]             = useState("");
  const [open, setOpen]               = useState(false);
  const [cvLoading, setCvLoading]     = useState(false);
  const dropdownRef                   = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera del dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentOption = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];

  const handleDownloadCV = async () => {
    setCvLoading(true);
    const result = await getApplicantCVUrl(application.id);
    setCvLoading(false);
    if (result.url) {
      window.open(result.url, "_blank");
    } else {
      setError(result.error ?? "No se pudo descargar el CV.");
    }
  };

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    if (newStatus === status) return;
    setError("");
    startTransition(async () => {
      const result = await updateEmpresaApplicationAction(application.id, newStatus);
      if (result?.error) {
        setError(result.error);
      } else {
        setStatus(newStatus);
      }
    });
  };

  const initials = profile.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const appliedDate = new Date(application.applied_at).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full overflow-hidden bg-brand-navy shrink-0 flex items-center justify-center">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.full_name}
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-white">{initials}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-brand-navy">{profile.full_name}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {candidate.career && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />{candidate.career}
                  </span>
                )}
                {profile.city && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{profile.city}
                  </span>
                )}
                {candidate.years_experience > 0 && (
                  <span className="text-xs text-gray-500">
                    {candidate.years_experience} año{candidate.years_experience !== 1 ? "s" : ""} exp.
                  </span>
                )}
              </div>
              {showJobTitle && application.job && (
                <p className="text-xs text-brand-blue mt-0.5">{application.job.title}</p>
              )}
            </div>

            {/* Selector de estado */}
            <div ref={dropdownRef} className="relative">
              <button
                disabled={isPending}
                onClick={() => setOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity ${currentOption.color} ${isPending ? "opacity-60" : "cursor-pointer"}`}
              >
                {isPending ? (
                  <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                ) : null}
                {currentOption.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown */}
              {open && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { handleStatusChange(option.value); setOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                        option.value === status ? "bg-gray-50" : ""
                      }`}
                    >
                      <span className={`inline-block px-2 py-0.5 rounded-full ${option.color}`}>
                        {option.label}
                      </span>
                      {option.value === status && (
                        <span className="ml-auto text-brand-blue text-[10px]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {application.cover_letter && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
              {application.cover_letter}
            </p>
          )}

          {/* Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {candidate.skills.slice(0, 5).map((skill) => (
                <span key={skill} className="text-[10px] bg-brand-light text-brand-navy/70 px-2 py-0.5 rounded-full">
                  {skill}
                </span>
              ))}
              {candidate.skills.length > 5 && (
                <span className="text-[10px] text-gray-400">+{candidate.skills.length - 5}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <p className="text-[11px] text-gray-400">Postulado el {appliedDate}</p>
            <a
              href={`mailto:${profile.email}`}
              className="text-[11px] text-brand-blue hover:underline"
            >
              {profile.email}
            </a>
            {candidate.cv_url && (
              <button
                onClick={handleDownloadCV}
                disabled={cvLoading}
                className="inline-flex items-center gap-1 text-[11px] text-brand-green hover:text-brand-green/80 font-medium disabled:opacity-60"
              >
                {cvLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <FileDown className="w-3 h-3" />
                }
                Descargar CV
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
