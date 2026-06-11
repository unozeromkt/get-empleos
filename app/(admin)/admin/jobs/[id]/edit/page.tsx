import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JobForm } from "@/components/jobs/JobForm";
import { createClient } from "@/lib/supabase/server";
import type { JobWithArea, Company } from "@/lib/types/database";

export default async function EditJobPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const [{ data: jobData }, { data: companiesData }] = await Promise.all([
    supabase.from("jobs").select("*, area:job_areas(*)").eq("id", params.id).single(),
    supabase.from("companies").select("*").order("name"),
  ]);

  if (!jobData) notFound();

  const job = jobData as JobWithArea;
  const companies = (companiesData ?? []) as Company[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium line-clamp-1">{job.title}</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Editar oferta</h1>
        <p className="text-sm text-gray-500 mt-1">Modifica la información de la vacante.</p>
      </div>

      <JobForm job={job} companies={companies} />
    </div>
  );
}
