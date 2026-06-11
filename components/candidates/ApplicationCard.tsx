import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Building2 } from "lucide-react";
import type { ApplicationWithDetails } from "@/lib/types/database";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { formatDate } from "@/lib/utils/date";
import { formatSalaryRange } from "@/lib/utils/salary";

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto:     "Remoto",
  hibrido:    "Híbrido",
};

export function ApplicationCard({ application }: { application: ApplicationWithDetails }) {
  const job = application.job;
  return (
    <article className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <Link href={`/jobs/${job?.slug}`} className="hover:text-brand-blue transition-colors">
            <h3 className="font-display font-semibold text-brand-navy text-base leading-snug line-clamp-1">
              {job?.title}
            </h3>
          </Link>
          {/* Company info */}
          {job?.company && (
            <div className="flex items-center gap-1.5 mt-0.5 mb-1">
              <div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {job.company.logo_url ? (
                  <Image
                    src={job.company.logo_url}
                    alt={job.company.name}
                    width={16}
                    height={16}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-2.5 h-2.5 text-gray-400" />
                )}
              </div>
              <span className="text-xs text-gray-500 truncate">{job.company.name}</span>
            </div>
          )}
          {job?.area && (
            <span className="text-xs text-brand-blue">{job.area.name}</span>
          )}
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
        {job?.city && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {job.city}
          </span>
        )}
        {job?.modality && <span>{MODALITY_LABEL[job.modality]}</span>}
        {job?.salary_visible && job?.salary_min && (
          <span className="font-medium text-brand-green">
            {formatSalaryRange(job.salary_min, job.salary_max)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        Postulado el {formatDate(application.applied_at)}
      </div>
    </article>
  );
}
