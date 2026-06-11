import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { createClient } from "@/lib/supabase/server";
import { deleteCompanyAction } from "@/lib/actions/companies";
import { Button } from "@/components/ui/button";
import type { Company } from "@/lib/types/database";

export default async function EditCompanyPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const company = data as Company;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/companies" className="hover:text-brand-blue">Empresas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">{company.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">Editar empresa</h1>
          <p className="text-gray-500 text-sm mt-1">{company.name}</p>
        </div>
        <form action={async () => { "use server"; await deleteCompanyAction(company.id); }}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="border-red-200 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Eliminar
          </Button>
        </form>
      </div>

      <CompanyForm company={company} />
    </div>
  );
}
