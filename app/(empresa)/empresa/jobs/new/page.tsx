import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmpresaJobForm } from "@/components/empresa/EmpresaJobForm";

export default async function EmpresaNewJobPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id, status")
    .eq("created_by", user.id)
    .maybeSingle();

  if (!company) redirect("/empresa/onboarding");
  if (company.status !== "approved") redirect("/empresa");

  const { data: areas } = await supabase
    .from("job_areas")
    .select("id, name, slug, icon")
    .order("name");

  return <EmpresaJobForm areas={areas ?? []} />;
}
