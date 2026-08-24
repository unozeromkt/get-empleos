import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Eye, CheckCircle2, XCircle, FileText, AlertTriangle, Clock, Search } from "lucide-react";
import { CVDownloadButton } from "@/components/admin/CVDownloadButton";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";

/**
 * Base general de hojas de vida.
 *
 * Lee de la vista `candidate_directory` (migración 021), que unifica en SQL los
 * dos orígenes: candidatos con cuenta y hojas de vida cargadas por un admin.
 * Antes se mezclaban en Node trayendo las tablas enteras, lo que rompía por
 * longitud de URL en los `.in()` y truncaba en silencio al llegar al tope de
 * filas de PostgREST.
 */

const PAGE_SIZE = 25;

const TIER_TABS = [
  { value: "",           label: "Todas" },
  { value: "registered", label: "Con cuenta" },
  { value: "cv",         label: "Solo hoja de vida" },
];

const DOC_STATUS: Record<string, { label: string; className: string; icon: "ok" | "wait" | "fail" }> = {
  ready:              { label: "Procesada",  className: "text-brand-green", icon: "ok" },
  needs_review:       { label: "Procesada",  className: "text-brand-green", icon: "ok" },
  uploaded:           { label: "En cola",    className: "text-gray-400",    icon: "wait" },
  extracting_text:    { label: "Leyendo",    className: "text-brand-blue",  icon: "wait" },
  extracting_profile: { label: "Analizando", className: "text-brand-blue",  icon: "wait" },
  failed:             { label: "Error",      className: "text-red-500",     icon: "fail" },
};

interface DirectoryRow {
  tier: "registered" | "cv";
  key_id: string;
  candidate_id: string | null;
  document_id: string | null;
  name: string;
  email: string | null;
  filename: string | null;
  headline: string | null;
  years: number | null;
  city: string | null;
  has_cv: boolean;
  doc_status: string | null;
  created_at: string;
  avatar_url: string | null;
  job_id: string | null;
  job_candidate_id: string | null;
  applications: number;
}

interface Props {
  searchParams: { tier?: string; page?: string; q?: string };
}

export default async function AdminCandidatesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const tier = searchParams.tier ?? "";
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // Una sola consulta paginada. `count: exact` viaja en la cabecera
  // Content-Range: no trae filas de más.
  let query = supabase
    .from("candidate_directory")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (tier) query = query.eq("tier", tier);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as DirectoryRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Totales por capa: `head: true` no descarga ninguna fila
  const countFor = async (t?: string) => {
    let c = supabase.from("candidate_directory").select("*", { count: "exact", head: true });
    if (t) c = c.eq("tier", t);
    if (q) c = c.ilike("name", `%${q}%`);
    const { count: n } = await c;
    return n ?? 0;
  };

  const [totalAll, totalRegistered, totalCv] = await Promise.all([
    countFor(),
    countFor("registered"),
    countFor("cv"),
  ]);

  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tier, q, page, ...over };
    if (merged.tier) p.set("tier", String(merged.tier));
    if (merged.q) p.set("q", String(merged.q));
    if (merged.page && Number(merged.page) > 1) p.set("page", String(merged.page));
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Base de hojas de vida</h1>
        <p className="text-gray-500 text-sm mt-1">
          {totalAll} {totalAll === 1 ? "persona" : "personas"} · {totalRegistered} con cuenta ·{" "}
          {totalCv} solo hoja de vida
          {q && <span className="text-brand-blue"> · filtrando por “{q}”</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2 flex-wrap">
          {TIER_TABS.map(({ value, label }) => (
            <a
              key={value}
              href={qs({ tier: value, page: 1 })}
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

        {/* GET simple: mantiene la página como server component */}
        <form method="get" className="relative min-w-[220px] max-w-xs flex-1">
          {tier && <input type="hidden" name="tier" value={tier} />}
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm text-brand-navy placeholder:text-gray-400 focus:border-brand-blue focus:outline-none"
          />
        </form>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar la base: {error.message}
        </div>
      )}

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
              {rows.map((row) => {
                const href =
                  row.tier === "registered"
                    ? `/admin/candidates/${row.candidate_id}`
                    : row.job_id && row.job_candidate_id
                    ? `/admin/jobs/${row.job_id}/candidatos/${row.job_candidate_id}/reporte`
                    : null;

                return (
                  <tr key={`${row.tier}-${row.key_id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {row.avatar_url ? (
                            <Image
                              src={row.avatar_url}
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
                            {row.email ?? row.filename ?? "Sin correo"}
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
                      {row.tier === "cv" && row.doc_status ? (
                        <DocStatus status={row.doc_status} />
                      ) : row.has_cv ? (
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
                      {formatDate(row.created_at)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-0.5">
                        {row.document_id && <CVDownloadButton documentId={row.document_id} />}
                        {href ? (
                          <Link
                            href={href}
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
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                    {q ? `Ningún resultado para “${q}”.` : "No hay hojas de vida en esta vista todavía."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 text-sm">
            <p className="text-gray-500">
              {from + 1}–{Math.min(from + PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <PageLink href={qs({ page: page - 1 })} disabled={page <= 1}>
                Anterior
              </PageLink>
              <span className="text-gray-500 tabular-nums">
                {page} / {totalPages}
              </span>
              <PageLink href={qs({ page: page + 1 })} disabled={page >= totalPages}>
                Siguiente
              </PageLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="px-3 py-1.5 rounded-lg border border-gray-100 text-gray-300 cursor-not-allowed">
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-navy hover:text-brand-navy transition-colors"
    >
      {children}
    </a>
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
