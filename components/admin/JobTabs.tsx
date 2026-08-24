import Link from "next/link";
import { FileText, Users, Upload } from "lucide-react";

/** Pestañas de la ficha de una oferta. */
export type JobTab = "perfil" | "candidatos" | "cvs";

export function JobTabs({ jobId, active }: { jobId: string; active: JobTab }) {
  const tabs = [
    { key: "perfil" as const, label: "Perfil Generado", icon: FileText, href: `/admin/jobs/${jobId}/perfil` },
    { key: "candidatos" as const, label: "Candidatos", icon: Users, href: `/admin/jobs/${jobId}/candidatos` },
    { key: "cvs" as const, label: "Subir CVs", icon: Upload, href: `/admin/jobs/${jobId}/cvs` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-px">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
              isActive
                ? "border-brand-blue text-brand-blue bg-brand-blue/5"
                : "border-transparent text-gray-500 hover:text-brand-navy"
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
