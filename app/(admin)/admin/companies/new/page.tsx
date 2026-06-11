import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CompanyForm } from "@/components/admin/CompanyForm";

export default function NewCompanyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/companies" className="hover:text-brand-blue">Empresas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">Nueva empresa</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Nueva empresa</h1>
        <p className="text-gray-500 text-sm mt-1">Registra la empresa cliente. Podrás subir el logo después de crearla.</p>
      </div>

      <CompanyForm />
    </div>
  );
}
