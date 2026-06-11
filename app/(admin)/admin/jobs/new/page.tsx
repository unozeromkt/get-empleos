import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JobForm } from "@/components/jobs/JobForm";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types/database";

export default async function NewJobPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").order("name");
  const companies = (data ?? []) as Company[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">Nueva oferta</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Nueva oferta de trabajo</h1>
        <p className="text-gray-500 text-sm mt-1">Completa el formulario para publicar la vacante.</p>
      </div>

      <JobForm companies={companies} />
    </div>
  );
}
