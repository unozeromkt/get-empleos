import type { JobStatus } from "@/lib/types/database";

const STATUS_MAP: Record<JobStatus, { label: string; className: string }> = {
  active:         { label: "Activa",      className: "bg-green-100 text-green-700" },
  draft:          { label: "Borrador",    className: "bg-gray-100 text-gray-600" },
  paused:         { label: "Pausada",     className: "bg-yellow-100 text-yellow-700" },
  closed:         { label: "Cerrada",     className: "bg-red-100 text-red-600" },
  pending_review: { label: "En revisión", className: "bg-amber-100 text-amber-700" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
      {label}
    </span>
  );
}
