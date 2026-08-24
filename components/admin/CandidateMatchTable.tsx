"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  Phone,
  Search,
  Upload,
} from "lucide-react";

import {
  recalculateMatchAction,
  reprocessCandidateDocumentAction,
  updateJobCandidateStatusAction,
  type ScreeningRow,
} from "@/lib/actions/ai-screening";
import { CVDownloadButton } from "@/components/admin/CVDownloadButton";
import { QueueProgress } from "@/components/admin/QueueProgress";
import { useQueueDrain } from "@/lib/hooks/use-queue-drain";
import { formatDate } from "@/lib/utils/date";

/** Estados de los que un documento ya no sale por sí solo. */
const TERMINAL_STATUSES = ["ready", "needs_review", "failed"];

const CATEGORY_LABEL: Record<string, string> = {
  technical_skills: "Habilidades técnicas",
  experience: "Experiencia",
  education_certifications: "Educación",
  transferable_skills: "Habilidades blandas",
  languages: "Idiomas",
  preferred_skills: "Deseables",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "reviewing", label: "En revisión" },
  { value: "shortlisted", label: "Preseleccionado" },
  { value: "rejected", label: "Descartado" },
  { value: "hired", label: "Contratado" },
];

/** Colores del selector de estado, para que el pipeline se lea de un vistazo. */
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-300",
  reviewing: "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
  shortlisted: "bg-brand-purple/10 text-brand-purple border-brand-purple/30",
  rejected: "bg-red-50 text-red-700 border-red-200",
  hired: "bg-brand-green/10 text-brand-green border-brand-green/30",
};

const BAND_FILTERS = [
  { value: "", label: "Todos" },
  { value: "high", label: "Alta" },
  { value: "potential", label: "Parcial" },
  { value: "low", label: "Baja" },
  { value: "insufficient_data", label: "Sin datos" },
  { value: "critical", label: "Brecha crítica" },
];

/**
 * Estilo de cada banda. Se usan colores sólidos sobre fondo claro en lugar de
 * transparencias suaves: el contraste tiene que aguantar una lectura rápida de
 * decenas de candidatos, no solo verse bonito.
 */
const BAND_RING: Record<string, string> = {
  high: "border-brand-green/40 bg-brand-green/5",
  potential: "border-brand-yellow/40 bg-brand-yellow/5",
  low: "border-red-200 bg-red-50/40",
  insufficient_data: "border-gray-200 bg-gray-50",
};

const BAND_SCORE_STYLE: Record<string, string> = {
  high: "bg-brand-green text-white",
  potential: "bg-brand-yellow text-brand-navy",
  low: "bg-red-500 text-white",
  insufficient_data: "bg-gray-300 text-gray-700",
};

const BAND_TEXT: Record<string, string> = {
  high: "Alta compatibilidad",
  potential: "Compatibilidad parcial",
  low: "Baja compatibilidad",
  insufficient_data: "Datos insuficientes",
};

const PROCESSING_LABEL: Record<string, string> = {
  uploaded: "En cola",
  extracting_text: "Leyendo hoja de vida",
  extracting_profile: "Analizando con IA",
  failed: "Error al procesar",
};

export function CandidateMatchTable({ jobId, rows }: { jobId: string; rows: ScreeningRow[] }) {
  const [query, setQuery] = useState("");
  const [band, setBand] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (q && !`${row.displayName} ${row.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (!band) return true;
      if (band === "critical") return (row.match?.criticalGaps.length ?? 0) > 0;
      return row.match?.band === band;
    });
  }, [rows, query, band]);

  // Mejor match primero (§31). Los que aún no tienen score van al final,
  // nunca ocultos: ordenar sí, esconder no (§30).
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.match?.overallScore ?? -1) - (a.match?.overallScore ?? -1)),
    [filtered]
  );

  const counts = useMemo(() => {
    const evaluated = rows.filter((r) => r.match);

    // Solo entran en el progreso las hojas de vida que realmente pasan por la
    // cola: un candidato sin documento no tiene nada que procesar.
    const queued = rows.filter((r) => r.processingStatus);

    return {
      total: rows.length,
      high: evaluated.filter((r) => r.match?.band === "high").length,
      processing: queued.filter((r) => !TERMINAL_STATUSES.includes(r.processingStatus!)).length,
      criticalGaps: evaluated.filter((r) => (r.match?.criticalGaps.length ?? 0) > 0).length,
      queuedTotal: queued.length,
      queuedDone: queued.filter((r) => TERMINAL_STATUSES.includes(r.processingStatus!)).length,
      queuedFailed: queued.filter((r) => r.processingStatus === "failed").length,
    };
  }, [rows]);

  // Mientras quede trabajo, la pantalla empuja la cola sola (§6.1).
  useQueueDrain(counts.processing > 0);

  return (
    <div className="space-y-5">
      {/* Resumen numérico: contexto antes del detalle */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="Candidatos" value={counts.total} />
        <SummaryTile label="Alta compatibilidad" value={counts.high} tone="green" />
        <SummaryTile label="Con brecha crítica" value={counts.criticalGaps} tone="red" />
        <SummaryTile label="Procesándose" value={counts.processing} tone="muted" />
      </div>

      {counts.processing > 0 && (
        <QueueProgress
          done={counts.queuedDone}
          total={counts.queuedTotal}
          failed={counts.queuedFailed}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm text-brand-navy placeholder:text-gray-400 focus:border-brand-blue focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {BAND_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setBand(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              band === f.value
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:text-brand-navy"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Upload className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-brand-navy font-semibold">
            {rows.length === 0 ? "Todavía no hay candidatos" : "Ningún candidato con ese filtro"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length === 0
              ? "Los postulados aparecerán aquí. También puedes subir hojas de vida manualmente."
              : "Prueba con otro filtro o limpia la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((row) => (
            <CandidateCard
              key={row.id}
              row={row}
              jobId={jobId}
              isExpanded={expanded === row.id}
              onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "navy",
}: {
  label: string;
  value: number;
  tone?: "navy" | "green" | "red" | "muted";
}) {
  const valueStyle = {
    navy: "text-brand-navy",
    green: "text-brand-green",
    red: "text-red-600",
    muted: "text-gray-400",
  }[tone];

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`font-display text-2xl font-bold mt-0.5 ${valueStyle}`}>{value}</p>
    </div>
  );
}

function CandidateCard({
  row,
  jobId,
  isExpanded,
  onToggle,
}: {
  row: ScreeningRow;
  jobId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const band = row.match?.band ?? "insufficient_data";
  const hasCriticalGap = (row.match?.criticalGaps.length ?? 0) > 0;
  const isProcessing =
    !!row.processingStatus && !["needs_review", "ready", "failed"].includes(row.processingStatus);

  return (
    <div
      className={`rounded-2xl border-2 bg-white overflow-hidden transition-shadow hover:shadow-md ${
        row.match ? BAND_RING[band] : "border-gray-200"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          {/* Puntaje: el dato que ordena la lectura, primero y grande */}
          <div className="shrink-0">
            {row.match ? (
              <div
                className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center ${BAND_SCORE_STYLE[band]}`}
              >
                {band === "insufficient_data" ? (
                  <span className="text-[10px] font-bold leading-tight text-center px-1">
                    SIN
                    <br />
                    DATOS
                  </span>
                ) : (
                  <>
                    <span className="font-display text-xl font-bold leading-none">
                      {row.match.overallScore}
                    </span>
                    <span className="text-[10px] opacity-80 leading-none mt-0.5">/ 100</span>
                  </>
                )}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <span className="text-[10px] font-semibold text-gray-400 text-center px-1">
                    SIN
                    <br />
                    EVALUAR
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Identidad y contacto */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-brand-navy">{row.displayName}</h3>
              <span className="text-xs text-gray-400 font-mono">#{row.systemRef}</span>
              {row.source === "admin_upload" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
                  CV cargado
                </span>
              )}
            </div>

            {row.match && (
              <p className="text-xs font-medium text-gray-600 mt-1">
                {BAND_TEXT[band]}
                <span className="text-gray-400">
                  {" "}
                  · confianza {Math.round(row.match.scoreConfidence * 100)}%
                </span>
              </p>
            )}

            {isProcessing && (
              <p className="text-xs text-brand-blue mt-1">
                {PROCESSING_LABEL[row.processingStatus as string]}…
              </p>
            )}
            {row.processingStatus === "failed" && (
              <p className="text-xs text-red-600 mt-1">No se pudo procesar la hoja de vida</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
              {row.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {row.email}
                </span>
              )}
              {row.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {row.phone}
                </span>
              )}
              <span className="text-gray-400">{formatDate(row.createdAt)}</span>
            </div>
          </div>

          {/* Desglose rápido de las 3 puntuaciones del listado */}
          {row.match && (
            <div className="flex gap-4 shrink-0">
              <MiniScore label="Requisitos" value={row.match.requirementsScore} />
              <MiniScore label="CV" value={row.match.overallScore} />
              <MiniScore label="Autoeval." value={null} />
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <select
              value={row.status}
              disabled={isPending}
              onChange={(e) =>
                startTransition(async () => {
                  await updateJobCandidateStatusAction(row.id, jobId, e.target.value);
                  router.refresh();
                })
              }
              className={`text-xs font-semibold rounded-lg border px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 ${STATUS_STYLE[row.status] ?? STATUS_STYLE.pending}`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {row.match && (
              <Link
                href={`/admin/jobs/${jobId}/candidatos/${row.id}/reporte`}
                className="p-2 rounded-lg text-gray-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                title="Ver reporte completo"
              >
                <FileText className="w-4 h-4" />
              </Link>
            )}

            {row.documentId && <CVDownloadButton documentId={row.documentId} />}

            <button
              type="button"
              onClick={onToggle}
              className="p-2 rounded-lg text-gray-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
              aria-label={isExpanded ? "Ocultar detalle" : "Ver detalle"}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Brecha crítica: visible sin necesidad de expandir */}
        {hasCriticalGap && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-800">
              <span className="font-semibold">Brecha crítica: </span>
              {row.match?.criticalGaps.map((g) => g.requirementText).join(" · ")}
            </p>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50/70 p-4 sm:p-5">
          <MatchDetail row={row} jobId={jobId} />
        </div>
      )}
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className="font-display text-lg font-bold text-brand-navy leading-none">
        {value !== null ? `${value}%` : "—"}
      </p>
      <p className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">{label}</p>
    </div>
  );
}

/** Detalle del match — spec §19 y §32: por qué obtuvo este puntaje. */
function MatchDetail({ row, jobId }: { row: ScreeningRow; jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!row.match) {
    const failed = row.processingStatus === "failed";
    // Un fallo del proveedor se reintenta tal cual; uno del propio archivo no
    // se arregla reintentando, hay que volver a subirlo en otro formato.
    const needsNewFile =
      row.processingError?.code === "NO_TEXT_LAYER" ||
      row.processingError?.code === "INSUFFICIENT_TEXT";

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Este candidato todavía no tiene evaluación.</p>

        {failed && (
          <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Falló el procesamiento de su hoja de vida.</p>
              <p className="mt-0.5">
                {row.processingError?.message ??
                  "No se registró el motivo. Vuelve a intentarlo."}
              </p>
              {needsNewFile && (
                <p className="mt-0.5">
                  Reintentar no va a servir: sube el archivo en un formato con texto
                  seleccionable.
                </p>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              // Si nunca se llegó a extraer el perfil, reencolar el match no
              // sirve de nada: hay que rehacer el procesamiento del CV.
              if (failed) {
                await reprocessCandidateDocumentAction(row.id, jobId);
              } else {
                await recalculateMatchAction(row.id, jobId);
              }
              router.refresh();
            })
          }
          className="text-sm font-medium text-brand-blue hover:underline disabled:opacity-50"
        >
          {isPending ? "Encolando…" : failed ? "Reprocesar hoja de vida" : "Evaluar ahora"}
        </button>
      </div>
    );
  }

  const { match } = row;

  return (
    <div className="space-y-5">
      <p className="text-sm text-brand-navy">{match.explanation.summary}</p>

      {/* Desglose por categoría con barras: comparación visual inmediata */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Evaluación por categoría
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {Object.entries(match.categoryScores).map(([key, value]) => (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-700 font-medium">{CATEGORY_LABEL[key] ?? key}</span>
                <span className={value === null ? "text-gray-400" : "font-bold text-brand-navy"}>
                  {value === null ? "No aplica" : `${value}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                {value !== null && (
                  <div
                    className={`h-full rounded-full ${
                      value >= 80 ? "bg-brand-green" : value >= 50 ? "bg-brand-yellow" : "bg-red-400"
                    }`}
                    style={{ width: `${value}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {match.explanation.strengths.length > 0 && (
          <div className="rounded-xl bg-white border border-gray-200 p-3">
            <p className="text-xs font-semibold text-brand-green uppercase tracking-wide mb-1.5">
              Fortalezas
            </p>
            <ul className="text-xs text-gray-700 space-y-1">
              {match.explanation.strengths.map((s, i) => (
                <li key={i}>✓ {s}</li>
              ))}
            </ul>
          </div>
        )}

        {match.explanation.gaps.length > 0 && (
          <div className="rounded-xl bg-white border border-gray-200 p-3">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">
              Brechas
            </p>
            <ul className="text-xs text-gray-700 space-y-1">
              {match.explanation.gaps.map((g, i) => (
                <li key={i}>! {g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Los `unknown` van aparte: ausencia de evidencia no es carencia (§8) */}
      {match.explanation.questionsForRecruiter.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Para verificar en entrevista
          </p>
          <ul className="text-xs text-gray-600 space-y-1">
            {match.explanation.questionsForRecruiter.map((q, i) => (
              <li key={i}>· {q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-4 pt-1">
        <Link
          href={`/admin/jobs/${jobId}/candidatos/${row.id}/reporte`}
          className="text-sm font-medium text-brand-blue hover:underline"
        >
          Ver reporte completo →
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await recalculateMatchAction(row.id, jobId);
              router.refresh();
            })
          }
          className="text-sm font-medium text-gray-600 hover:text-brand-blue disabled:opacity-50"
        >
          {isPending ? "Encolando…" : "Recalcular"}
        </button>
      </div>
    </div>
  );
}
