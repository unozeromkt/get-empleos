import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { JobsListClient } from "./jobs-list-client";
import { createClient } from "@/lib/supabase/server";
import type { JobWithCompany, JobArea } from "@/lib/types/database";

export const revalidate = 60; // Revalidar cada 60 segundos

export default async function JobsPage() {
  const supabase = await createClient();

  const [{ data: jobsData }, { data: areasData }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, area:job_areas(*), company:companies(*)")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false }),
    supabase.from("job_areas").select("*").order("name"),
  ]);

  const jobs  = (jobsData  ?? []) as JobWithCompany[];
  const areas = (areasData ?? []) as JobArea[];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Suspense fallback={<div className="flex-1 bg-brand-light" />}>
        <JobsListClient jobs={jobs} areas={areas} />
      </Suspense>
      <Footer />
    </div>
  );
}
