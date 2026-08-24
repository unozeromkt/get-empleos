import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Eye, CheckCircle2, XCircle, FileText, AlertTriangle, Clock } from "lucide-react";
import { CVDownloadButton } from "@/components/admin/CVDownloadButton";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";

/**
 * Base general de hojas de vida.
 *
 * Reúne dos orígenes que hasta ahora vivían separados:
 *
 *  1. Candidatos registrados — tienen cuenta, fila en `candidates` y perfil.
 *  2. Hojas de vida sin cuenta — cargadas por un admin sobre una oferta. Viven
 *     en `candidate_documents` con candidate_id NULL y su perfil extraído en
 *     `candidate_profile_versions`.
 *
 * Ambos alimentan `candidate_search_index`, así que el buscador de talento ya
 * los encontraba; lo que faltaba era poder verlos juntos aquí.
 */

const TIER_TABS = [
  { value: "",           label: "Todas" },
  { value: "registered", label: "Con cuenta" },
  { value: "cv",         label: "Solo hoja de vida" },
];

/** Estados de procesamiento que conviene señalar en el listado. */
const DOC_STATUS: Record<string, { label: string; className: string; icon: "ok" | "wait" | "fail" }> = {
  ready:        { label: "Procesada",   className: "text-brand-green",  icon: "ok" },
  needs_review: { label: "Procesada",   className: "text-brand-green",  icon: "ok" },
  uploaded:     { label: "En cola",     className: "text-gray-400",     icon: "wait" },
  extracting_text:    { label: "Leyendo",  className: "text-brand-blue", icon: "wait" },
  extracting_profile: { label: "Analizando", className: "text-brand-blue", icon: "wait" },
  failed:       { label: "Error",       className: "text-red-500",      icon: "fail" },
};

interface Row {
  key: string;
  tier: "registered" | "cv";
  name: string;
  email: string | null;
  /** Nombre del archivo original, para rastrear de dónde salió el registro. */
  filename: string | null;
  headline: string | null;
  years: number | null;
  city: string | null;
  hasCV: boolean;
  docStatus: string | null;
  /** Documento vigente, si lo hay: habilita la descarga. */
  documentId: string | null;
  applications: number;
  createdAt: string;
  href: string | null;
  avatarUrl: string | null;
}

interface Props {
  searchParams: { tier?: string };
}

export default async function AdminCandidatesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  // ── Capa 1: candidatos con cuenta ──
  const { data: candidatesData } = await supabase
    .from("candidates")
    .select(
      "id, career, years_experience, education_level, cv_url, profile:profiles(full_name, email, created_at, avatar_url)"
    )
    .order("id");

  const { data: appCounts } = await supabase.from("applications").select("candidate_id");
  const appsPerCandidate = (appCounts ?? []).reduce((acc, { candidate_id }) => {
    acc[candidate_id] = (acc[candidate_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Documento vigente de cada candidato con cuenta, para poder descargarlo.
  // `candidates.cv_url` guarda la ruta, pero la descarga va por documento.
  const { data: ownDocs } = await supabase
    .from("candidate_documents")
    .select("id, candidate_id")
    .not("candidate_id", "is", null)
    .eq("is_current", true);

  const docByCandidate = new Map<string, string>();
  for (const d of ownDocs ?? []) {
    const rec = d as Record<string, unknown>;
    docByCandidate.set(rec.candidate_id as string, rec.id as string);
  }

  const registered: Row[] = (candidatesData ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    // Supabase devuelve las relaciones anidadas como array
    const nested = r.profile as Record<string, unknown>[] | Record<string, unknown>;
    const profile = (Array.isArray(nested) ? nested[0] : nested) ?? {};
    const id = r.id as string;

    return {
      key: `reg-${id}`,
      tier: "registered",
      name: (profile.full_name as string) ?? "Sin nombre",
      email: (profile.email as string) ?? null,
      filename: null,
      headline: (r.career as string | null) ?? null,
      years: (r.years_experience as number | null) ?? null,
      city: null,
      hasCV: Boolean(r.cv_url),
      docStatus: null,
      documentId: docByCandidate.get(id) ?? null,
      applications: appsPerCandidate[id] ?? 0,
      createdAt: (profile.created_at as string) ?? new Date().toISOString(),
      href: `/admin/candidates/${id}`,
      avatarUrl: (profile.avatar_url as string | null) ?? null,
    };
  });

  // ── Capa 2: hojas de vida sin cuenta ──
  const { data: docs } = await supabase
    .from("candidate_documents")
    .select("id, original_filename, status, created_at")
    .is("candidate_id", null)
    .eq("is_current", true)
    .order("created_at", { ascending: false });

  const docIds = (docs ?? []).map((d) => d.id as string);

  // Perfil extraído por la IA: de ahí sale el nombre real de la persona
  const { data: versions } = docIds.length
    ? await supabase
        .from("candidate_profile_versions")
        .select("source_document_id, ai_profile, confirmed_profile")
        .in("source_document_id", docIds)
        .eq("is_current", true)
    : { data: [] };

  const profileByDoc = new Map<string, Record<string, unknown>>();
  for (const v of versions ?? []) {
    const rec = v as Record<string, unknown>;
    // El perfil confirmado por un humano manda sobre el extraído
    const prof = (rec.confirmed_profile ?? rec.ai_profile) as Record<string, unknown> | null;
    if (prof) profileByDoc.set(rec.source_document_id as string, prof);
  }

  // Oferta desde la que se cargó, para poder abrir su informe
  const { data: jcs } = docIds.length
    ? await supabase
        .from("job_candidates")
        .select("id, job_id, document_id, display_name")
        .in("document_id", docIds)
    : { data: [] };

  const jcByDoc = new Map<string, { id: string; jobId: string; displayName: string | null }>();
  for (const jc of jcs ?? []) {
    const rec = jc as Record<string, unknown>;
    jcByDoc.set(rec.document_id as string, {
      id: rec.id as string,
      jobId: rec.job_id as string,
      displayName: (rec.display_name as string | null) ?? null,
    });
  }

  const cvOnly: Row[] = (docs ?? []).map((d) => {
    const doc = d as Record<string, unknown>;
    const docId = doc.id as string;
    const prof = profileByDoc.get(docId);
    const contact = (prof?.contact ?? {}) as Record<string, unknown>;
    const jc = jcByDoc.get(docId);
    const filename = (doc.original_filename as string) ?? null;

    // Identidad: nombre extraído por la IA; si no lo hay, el que puso el admin;
    // y como último recurso el nombre del archivo.
    const extracted = (contact.full_name as string | null)?.trim() || null;
    const name = extracted ?? jc?.displayName ?? filename ?? "Hoja de vida";

    return {
      key: `cv-${docId}`,
      tier: "cv",
      name,
      email: (contact.email as string | null) ?? null,
      filename,
      headline: (prof?.headline as string | null) ?? null,
      years: (prof?.total_years_experience as number | null) ?? null,
      city: (contact.city as string | null) ?? null,
      hasCV: true,
      docStatus: (doc.status as string) ?? null,
      documentId: docId,
      applications: 0,
      createdAt: (doc.created_at as string) ?? new Date().toISOString(),
      href: jc ? `/admin/jobs/${jc.jobId}/candidatos/${jc.id}/reporte` : null,
      avatarUrl: null,
    };
  });

  const tier = searchParams.tier ?? "";
  const all = [...registered, ...cvOnly].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const rows = tier ? all.filter((r) => r.tier === tier) : all;

  const pendientes = cvOnly.filter((r) => r.docStatus && !["ready", "needs_review", "failed"].includes(r.docStatus)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Base de hojas de vida</h1>
        <p className="text-gray-500 text-sm mt-1">
          {all.length} personas · {registered.length} con cuenta · {cvOnly.length} solo hoja de vida
          {pendientes > 0 && ` · ${pendientes} procesándose`}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TIER_TABS.map(({ value, label }) => (
          <a
            key={value}
            href={value ? `?tier=${value}` : "?"}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tier === value
                ? "bg-brand-navy text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-navy"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Persona</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Perfil profesional</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Hoja de vida</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Postulaciones</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Incorporada</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {row.avatarUrl ? (
                          <Image
                            src={row.avatarUrl}
                            alt={row.name}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                          />
                        ) : row.tier === "cv" ? (
                          <FileText className="w-4 h-4 text-brand-navy/50" />
                        ) : (
                          <span className="text-sm font-bold text-brand-navy">
                            {row.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-brand-navy truncate max-w-[240px]">{row.name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[240px]">
                          {row.email ?? (row.tier === "cv" ? row.filename ?? "Sin correo" : "Sin correo")}
                        </p>
                      </div>
                      {row.tier === "cv" && (
                        <span className="ml-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Sin cuenta
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-gray-700 truncate max-w-[280px]">{row.headline ?? "—"}</p>
                    <p className="text-xs text-gray-400">
                      {row.years != null ? `${row.years} años exp.` : "Experiencia sin determinar"}
                      {row.city && ` · ${row.city}`}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-center hidden sm:table-cell">
                    {row.tier === "cv" && row.docStatus ? (
                      <DocStatus status={row.docStatus} />
                    ) : row.hasCV ? (
                      <CheckCircle2 className="w-4 h-4 text-brand-green mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="text-gray-700 font-medium">
                      {row.tier === "cv" ? "—" : row.applications}
                    </span>
                  </td>

                  <td className="px-4 py-4 hidden lg:table-cell text-xs text-gray-500">
                    {formatDate(row.createdAt)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-0.5">
                      {row.documentId && <CVDownloadButton documentId={row.documentId} />}
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors inline-flex"
                        title={row.tier === "cv" ? "Ver informe de esta hoja de vida" : "Ver perfil"}
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex p-1.5 text-gray-200" title="Sin vista de detalle">
                        <Eye className="w-4 h-4" />
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No hay hojas de vida en esta vista todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DocStatus({ status }: { status: string }) {
  const cfg = DOC_STATUS[status] ?? DOC_STATUS.uploaded;
  const Icon = cfg.icon === "ok" ? CheckCircle2 : cfg.icon === "fail" ? AlertTriangle : Clock;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.className}`} title={cfg.label}>
      <Icon className="w-4 h-4" />
      <span className="hidden lg:inline">{cfg.label}</span>
    </span>
  );
}
