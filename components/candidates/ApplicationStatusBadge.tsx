import type { ApplicationStatus } from "@/lib/types/database";

const STATUS_MAP: Record<ApplicationStatus, { label: string; className: string }> = {
  pending:     { label: "Pendiente",       className: "bg-yellow-100 text-yellow-700" },
  reviewing:   { label: "En revisión",     className: "bg-blue-100 text-blue-700" },
  shortlisted: { label: "Preseleccionado", className: "bg-purple-100 text-purple-700" },
  rejected:    { label: "No continúa",     className: "bg-red-100 text-red-600" },
  hired:       { label: "Contratado",      className: "bg-green-100 text-green-700" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, className } = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
      {label}
    </span>
  );
}
