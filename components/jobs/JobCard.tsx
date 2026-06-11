import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Users, Building2 } from "lucide-react";
import type { JobWithCompany } from "@/lib/types/database";
import { formatSalaryRange } from "@/lib/utils/salary";
import { timeAgo } from "@/lib/utils/date";

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto:     "Remoto",
  hibrido:    "Híbrido",
};

const CONTRACT_LABEL: Record<string, string> = {
  tiempo_completo: "Tiempo completo",
  tiempo_parcial:  "Tiempo parcial",
  temporal:        "Temporal",
  por_obra:        "Por obra",
};

export function JobCard({ job }: { job: JobWithCompany }) {
  return (
    <Link href={`/jobs/${job.slug}`} className="group block h-full">
      <article className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-brand-blue/30 hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-start justify-between mb-3 gap-2">
          <span className="inline-flex items-center text-xs font-medium bg-brand-blue/10 text-brand-blue px-2.5 py-1 rounded-full truncate">
            {job.area?.name}
          </span>
          {job.featured && (
            <span className="shrink-0 text-xs font-medium bg-brand-yellow/20 text-brand-yellow px-2.5 py-1 rounded-full">
              Destacada
            </span>
          )}
        </div>

        <h3 className="font-display font-semibold text-brand-navy text-base leading-snug mb-2 group-hover:text-brand-blue transition-colors line-clamp-2">
          {job.title}
        </h3>

        {/* Empresa */}
        {job.company && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
              {job.company.logo_url ? (
                <Image
                  src={job.company.logo_url}
                  alt={job.company.name}
                  width={20}
                  height={20}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-3 h-3 text-gray-400" />
              )}
            </div>
            <span className="text-xs text-gray-500 truncate">{job.company.name}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {job.city}
          </span>
          <span className="text-gray-300">·</span>
          <span>{MODALITY_LABEL[job.modality ?? "presencial"]}</span>
          <span className="text-gray-300">·</span>
          <span>{CONTRACT_LABEL[job.contract_type ?? "tiempo_completo"]}</span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm font-semibold text-brand-green">
            {job.salary_visible
              ? formatSalaryRange(job.salary_min, job.salary_max)
              : "Salario a convenir"}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {job.vacancies}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(job.published_at!)}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
