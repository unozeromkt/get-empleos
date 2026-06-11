import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmpresaJobForm } from "@/components/empresa/EmpresaJobForm";
import type { Job } from "@/lib/types/database";

interface Props {
  params: { id: string };
}

export default async function EmpresaEditJobPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("created_by", user.id)
    .maybeSingle();

  if (!company) redirect("/empresa/onboarding");

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (!job) notFound();

  const { data: areas } = await supabase
    .from("job_areas")
    .select("id, name, slug, icon")
    .order("name");

  return <EmpresaJobForm job={job as Job} areas={areas ?? []} />;
}
