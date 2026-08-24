import { redirect } from "next/navigation";

import { TalentSearch } from "@/components/admin/TalentSearch";
import { aiConfig } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Búsqueda de talento por lenguaje natural — módulo 04.
 *
 * Módulo transversal: no depende de ninguna vacante y no interfiere con el
 * screening por oferta. Solo admin de Get Company.
 */
export default async function TalentSearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  // Ofertas a las que se puede llevar un resultado desde el buscador
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status")
    .in("status", ["active", "paused", "draft"])
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: saved } = await supabase
    .from("talent_searches")
    .select("id, label, raw_query")
    .eq("is_saved", true)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Búsqueda de talento</h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe el perfil que necesitas y la plataforma lo busca en toda la base de hojas de vida.
        </p>
      </div>

      <TalentSearch
        jobs={(jobs ?? []).map((j) => ({ id: j.id as string, title: j.title as string }))}
        savedSearches={(saved ?? []).map((s) => ({
          id: s.id as string,
          label: (s.label as string | null) ?? null,
          raw_query: s.raw_query as string,
        }))}
        aiEnabled={aiConfig.enabled && aiConfig.features.talentSearch}
      />
    </div>
  );
}
