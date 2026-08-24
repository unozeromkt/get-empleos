import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

import { JobDocumentUpload } from "@/components/admin/JobDocumentUpload";
import { aiConfig } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types/database";

export default async function NewAIJobPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const { data } = await supabase.from("companies").select("*").order("name");
  const companies = (data ?? []) as Company[];

  const available = aiConfig.enabled && aiConfig.features.jobCreation;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/admin" className="hover:text-brand-blue">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/jobs" className="hover:text-brand-blue">Ofertas</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-navy font-medium">Crear con IA</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-purple" />
          Crear oferta desde un documento
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Sube el Word o PDF de la vacante y la IA extraerá los requisitos, habilidades y
          responsabilidades para que los revises.
        </p>
      </div>

      {available ? (
        <JobDocumentUpload companies={companies} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 space-y-2">
          <p className="font-medium">La creación de ofertas con IA no está habilitada.</p>
          <p>
            Para activarla, define en las variables de entorno:{" "}
            <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">AI_ENABLED=true</code> y{" "}
            <code className="bg-amber-100 px-1 rounded">FEATURE_AI_JOB_CREATION=true</code>.
          </p>
          <p>
            Mientras tanto puedes{" "}
            <Link href="/admin/jobs/new" className="underline font-medium">
              crear la oferta manualmente
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
