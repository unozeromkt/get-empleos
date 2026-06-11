"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, CheckCircle2, ArrowLeft, Send, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { applyToJobAction } from "@/lib/actions/applications";
import { formatSalaryRange } from "@/lib/utils/salary";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import type { JobWithArea } from "@/lib/types/database";
import type { CandidateWithProfile } from "@/lib/types/database";

export default function ApplyPage({ params }: { params: { slug: string } }) {
  const [job,            setJob]            = useState<JobWithArea | null>(null);
  const [candidate,      setCandidate]      = useState<CandidateWithProfile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [coverLetter,    setCoverLetter]    = useState("");
  const [submitted,      setSubmitted]      = useState(false);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [isPending,      startTransition]   = useTransition();

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      // Verificar auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/auth/login?redirectTo=/jobs/${params.slug}/apply`;
        return;
      }

      // Cargar oferta
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*, area:job_areas(*)")
        .eq("slug", params.slug)
        .eq("status", "active")
        .single();

      if (!jobData) {
        setLoading(false);
        return;
      }

      // Cargar candidato (maybeSingle para no romper si no existe la fila)
      const { data: candidateData } = await supabase
        .from("candidates")
        .select("*, profile:profiles(*)")
        .eq("id", user.id)
        .maybeSingle();

      // Verificar postulación previa
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", jobData.id)
        .eq("candidate_id", user.id)
        .maybeSingle();

      if (existing) {
        setErrorMsg("Ya te postulaste a esta oferta anteriormente.");
      }

      setJob(jobData as JobWithArea);
      setCandidate(candidateData as CandidateWithProfile);
      setLoading(false);
    }

    loadData();
  }, [params.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setErrorMsg("");
    const formData = new FormData();
    formData.set("job_id", job.id);
    formData.set("cover_letter", coverLetter);

    startTransition(async () => {
      type ApplyResult = { error?: Record<string, string[]>; success?: boolean; jobTitle?: string } | null;
      const result = (await applyToJobAction(formData)) as ApplyResult;
      if (result?.error) {
        const errMsg =
          result.error._form?.[0] ?? "Error al enviar la postulación.";
        setErrorMsg(errMsg);
      } else {
        setSubmitted(true);
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Esta oferta no está disponible.</p>
            <Link href="/jobs">
              <Button className="bg-brand-blue text-white">Ver otras ofertas</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 bg-brand-light flex items-center justify-center py-16 px-4">
          <div className="bg-white rounded-2xl p-10 border border-gray-100 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-brand-green" />
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">
              ¡Postulación enviada!
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Tu postulación a <strong>{job.title}</strong> fue recibida. Te notificaremos por email cuando haya novedades.
            </p>
            <div className="space-y-3">
              <Link href="/applications">
                <Button className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white">
                  Ver mis postulaciones
                </Button>
              </Link>
              <Link href="/jobs">
                <Button variant="outline" className="w-full">
                  Seguir explorando ofertas
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 bg-brand-light">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-1.5 text-xs text-gray-500">
            <Link href="/jobs" className="hover:text-brand-blue transition-colors">Ofertas</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/jobs/${job.slug}`} className="hover:text-brand-blue transition-colors line-clamp-1 max-w-[200px]">
              {job.title}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-brand-navy font-medium">Postularme</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link href={`/jobs/${job.slug}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue mb-6">
            <ArrowLeft className="w-4 h-4" />
            Volver a la oferta
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulario */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h1 className="font-display text-xl font-bold text-brand-navy mb-1">
                  Postularme a esta oferta
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  Completa el formulario y envía tu postulación para <strong>{job.title}</strong>.
                </p>

                {/* Bloqueo si no hay perfil o está incompleto */}
                {(!candidate || !candidate.profile_complete) ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                    <p className="font-semibold text-yellow-800 mb-1">
                      {!candidate ? "Perfil no encontrado" : "Perfil incompleto"}
                    </p>
                    <p className="text-sm text-yellow-700 mb-4">
                      {!candidate
                        ? "Debes completar tu perfil antes de postularte."
                        : "Faltan datos obligatorios en tu perfil. Complétalo para continuar."}
                    </p>
                    <Link href="/profile">
                      <Button size="sm" className="bg-brand-blue text-white">
                        Completar mi perfil
                      </Button>
                    </Link>
                  </div>
                ) : (
                  /* Info del candidato cuando el perfil está completo */
                  <div className="bg-brand-light rounded-xl p-4 mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Tu perfil</p>
                    <p className="font-medium text-brand-navy text-sm">{candidate.profile.full_name}</p>
                    <p className="text-xs text-gray-500">{candidate.profile.email}</p>
                    {candidate.career && (
                      <p className="text-xs text-gray-500 mt-1">
                        {candidate.career} · {candidate.years_experience} años de experiencia
                      </p>
                    )}
                    {candidate.cv_url ? (
                      <span className="inline-flex items-center gap-1 text-xs text-brand-green mt-2">
                        <CheckCircle2 className="w-3 h-3" />
                        CV adjunto
                      </span>
                    ) : (
                      <p className="text-xs text-yellow-600 mt-2">
                        ⚠ No tienes CV subido —{" "}
                        <Link href="/profile" className="underline">actualizar perfil</Link>
                      </p>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-5">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-brand-navy mb-1.5">
                      Carta de presentación <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      rows={6}
                      maxLength={1000}
                      placeholder="Cuéntale a la empresa por qué eres el candidato ideal para este cargo..."
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">{coverLetter.length}/1000</p>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
                    Al postularte, autorizas a Get Company a consultar tu información y compartirla con el empleador.
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending || !!errorMsg || !candidate?.profile_complete}
                    className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold"
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Enviando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        Enviar postulación
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Resumen oferta */}
            <div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 sticky top-24">
                <h3 className="font-display font-semibold text-brand-navy text-sm mb-4">Resumen de la oferta</h3>
                <p className="font-semibold text-brand-navy text-base mb-1">{job.title}</p>
                {job.area && (
                  <span className="inline-flex items-center text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full mb-3">
                    {job.area.name}
                  </span>
                )}
                <div className="space-y-2 text-xs text-gray-500">
                  <p>📍 {job.city}{job.department ? `, ${job.department}` : ""}</p>
                  <p>🏢 {job.modality === "presencial" ? "Presencial" : job.modality === "remoto" ? "Remoto" : "Híbrido"}</p>
                  <p>📄 {job.contract_type === "tiempo_completo" ? "Tiempo completo" : job.contract_type}</p>
                  {job.salary_visible && job.salary_min && (
                    <p className="font-semibold text-brand-green">
                      💰 {formatSalaryRange(job.salary_min, job.salary_max)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
