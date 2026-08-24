"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  addToJobAction,
  getCvUrlAction,
  processPendingCvsAction,
  refineSearchAction,
  saveSearchAction,
  searchTalentAction,
  type TalentSearchResponse,
} from "@/lib/actions/talent-search";
import type { TalentQuery } from "@/lib/ai/schemas/talent-query";
import type { RequirementResult } from "@/lib/matching/types";
import { queryToChips, removeChip, type QueryChip } from "@/lib/search/query-adapter";
import type { TalentSearchRow } from "@/lib/search/talent-search";
import { BAND_LABEL, ConfidenceLabel, ScoreBadge } from "@/components/shared/ScoreBadge";

/**
 * Búsqueda de talento por lenguaje natural — módulo 04.
 *
 * Tres decisiones de diseño mandan sobre el resto:
 *   1. Los chips hacen VISIBLE y CORREGIBLE la interpretación de la IA.
 *      Editarlos no vuelve a llamar al modelo: solo re-ejecuta el motor.
 *   2. Se distingue "no lo tiene" de "el CV no lo dice" (spec §8). Confundirlos
 *      sería el error más caro del sistema.
 *   3. Los CV sin perfil canónico van en una sección aparte y SIN puntaje.
 *      Mezclar un score real con una coincidencia de texto sería mentir.
 */

interface JobOption {
  id: string;
  title: string;
}

interface SavedSearch {
  id: string;
  label: string | null;
  raw_query: string;
}

const EXAMPLES = [
  "vendedor con 3 años en retail que maneje Excel, en Medellín",
  "auxiliar contable con experiencia en SAP, disponibilidad inmediata",
  "alguien que haya liderado equipos de bodega",
];

export function TalentSearch({
  jobs,
  savedSearches,
  aiEnabled,
}: {
  jobs: JobOption[];
  savedSearches: SavedSearch[];
  aiEnabled: boolean;
}) {
  const [rawQuery, setRawQuery] = useState("");
  const [response, setResponse] = useState<TalentSearchResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chips = useMemo(
    () => (response?.query ? queryToChips(response.query) : []),
    [response?.query]
  );

  const search = (text: string) => {
    setNotice(null);
    startTransition(async () => {
      setResponse(await searchTalentAction(text));
    });
  };

  const refine = (query: TalentQuery) => {
    setNotice(null);
    startTransition(async () => {
      // El searchId queda en null a propósito: al editar los criterios, la
      // búsqueda ya no es la frase que se registró, y guardar esa frase
      // guardaría algo distinto de lo que el reclutador está viendo.
      setResponse(await refineSearchAction(query));
    });
  };

  const dropChip = (chipId: string) => {
    if (!response?.query) return;
    refine(removeChip(response.query, chipId));
  };

  const processPending = async () => {
    setProcessing(true);
    const result = await processPendingCvsAction();
    setProcessing(false);
    setNotice(
      result.error
        ? result.error
        : result.queued === 0
          ? "No hay hojas de vida pendientes por procesar."
          : `${result.queued} hojas de vida encoladas. El procesamiento avanza en segundo plano.`
    );
  };

  const outcome = response?.outcome ?? null;

  return (
    <div className="space-y-6">
      {/* ── Barra de búsqueda ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(rawQuery);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Describe el perfil que buscas…"
              maxLength={500}
              disabled={!aiEnabled}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue disabled:bg-gray-50"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !aiEnabled || rawQuery.trim().length < 3}
            className="px-5 py-3 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Buscar
          </button>
        </form>

        {!aiEnabled && (
          <p className="text-xs text-gray-500">
            El módulo de IA está deshabilitado. Actívalo con <code>AI_ENABLED</code> y{" "}
            <code>FEATURE_AI_TALENT_SEARCH</code>.
          </p>
        )}

        {!response && aiEnabled && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setRawQuery(example);
                  search(example);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {savedSearches.length > 0 && !response && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Búsquedas guardadas
            </p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setRawQuery(s.raw_query);
                    search(s.raw_query);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-brand-light text-brand-navy hover:bg-brand-blue/10"
                >
                  {s.label || s.raw_query}
                </button>
              ))}
            </div>
          </div>
        )}

        {outcome && (
          <CoverageBar
            coverage={outcome.coverage}
            processing={processing}
            onProcess={processPending}
          />
        )}

        {notice && <p className="text-xs text-brand-blue">{notice}</p>}
      </div>

      {response?.error && (
        <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-2xl p-4 text-sm text-brand-navy">
          {response.error}
        </div>
      )}

      {/* ── Interpretación: chips editables ── */}
      {response?.query && chips.length > 0 && (
        <Interpretation
          query={response.query}
          chips={chips}
          searchId={response.searchId}
          cached={response.cached}
          disabled={isPending}
          onDrop={dropChip}
        />
      )}

      {/* ── Resultados ── */}
      {outcome && (
        <Results outcome={outcome} jobs={jobs} chips={chips} disabled={isPending} onDrop={dropChip} />
      )}
    </div>
  );
}

// ─── Cobertura ────────────────────────────────────────────────────────────────

/**
 * Decir sobre cuántas hojas de vida se buscó de verdad. Sin esto el reclutador
 * cree que buscó en toda la base, y no es cierto hasta que todo esté procesado.
 */
function CoverageBar({
  coverage,
  processing,
  onProcess,
}: {
  coverage: { processed: number; pending: number };
  processing: boolean;
  onProcess: () => void;
}) {
  const total = coverage.processed + coverage.pending;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 pt-1">
      <span>
        Buscando sobre <strong className="text-brand-navy">{coverage.processed}</strong> de {total}{" "}
        hojas de vida procesadas
      </span>
      {coverage.pending > 0 && (
        <button
          type="button"
          onClick={onProcess}
          disabled={processing}
          className="inline-flex items-center gap-1.5 text-brand-blue hover:underline disabled:opacity-50"
        >
          {processing && <Loader2 className="w-3 h-3 animate-spin" />}
          Procesar las {coverage.pending} restantes →
        </button>
      )}
    </div>
  );
}

// ─── Interpretación ───────────────────────────────────────────────────────────

function Interpretation({
  query,
  chips,
  searchId,
  cached,
  disabled,
  onDrop,
}: {
  query: TalentQuery;
  chips: QueryChip[];
  searchId: string | null;
  cached: boolean;
  disabled: boolean;
  onDrop: (chipId: string) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entendí</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Quita un criterio para ampliar la búsqueda. Editar no vuelve a consultar la IA.
          </p>
        </div>
        {searchId && (
          <button
            type="button"
            disabled={saved}
            onClick={async () => {
              await saveSearchAction(searchId, query.interpreted_role ?? "Búsqueda guardada");
              setSaved(true);
            }}
            className="text-xs text-brand-blue hover:underline disabled:text-gray-400 disabled:no-underline shrink-0"
          >
            {saved ? "Guardada" : "Guardar búsqueda"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.id}
            className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border text-xs ${
              chip.importance === "must_have"
                ? "bg-brand-purple/10 border-brand-purple/30 text-brand-purple"
                : chip.importance === "preferred"
                  ? "bg-gray-50 border-gray-200 text-gray-500"
                  : "bg-brand-blue/10 border-brand-blue/30 text-brand-blue"
            }`}
          >
            <span className="font-medium">{chip.label}</span>
            {chip.detail && <span className="opacity-60">{chip.detail}</span>}
            <button
              type="button"
              onClick={() => onDrop(chip.id)}
              disabled={disabled}
              aria-label={`Quitar ${chip.label}`}
              className="hover:bg-black/10 rounded-full p-0.5 disabled:opacity-40"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Atributos protegidos: se avisa siempre, nunca se filtra por ellos */}
      {query.rejected_criteria.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-brand-navy bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-brand-yellow shrink-0 mt-0.5" />
          <div className="space-y-1">
            {query.rejected_criteria.map((r, i) => (
              <p key={i}>
                <strong>&ldquo;{r.criterion}&rdquo;</strong> — {r.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {query.unsupported_criteria.length > 0 && (
        <p className="text-xs text-gray-500">
          No se aplicó: {query.unsupported_criteria.join(", ")} — no es evaluable desde una hoja de vida.
        </p>
      )}

      {query.interpretation_notes.length > 0 && (
        <ul className="text-xs text-gray-400 space-y-0.5">
          {query.interpretation_notes.map((note, i) => (
            <li key={i}>· {note}</li>
          ))}
        </ul>
      )}

      {cached && <p className="text-xs text-gray-300">Interpretación reutilizada — sin coste.</p>}
    </div>
  );
}

// ─── Resultados ───────────────────────────────────────────────────────────────

function Results({
  outcome,
  jobs,
  chips,
  disabled,
  onDrop,
}: {
  outcome: NonNullable<TalentSearchResponse["outcome"]>;
  jobs: JobOption[];
  chips: QueryChip[];
  disabled: boolean;
  onDrop: (chipId: string) => void;
}) {
  const exportCsv = () => {
    const header = ["Nombre", "Email", "Teléfono", "Ciudad", "Años", "Compatibilidad", "Banda"];
    const rows = outcome.results.map((r) => [
      r.displayName,
      r.email ?? "",
      r.phone ?? "",
      r.city ?? "",
      r.totalYears ?? "",
      r.score,
      BAND_LABEL[r.band] ?? r.band,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "busqueda-talento.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-brand-navy">
            {outcome.results.length} {outcome.results.length === 1 ? "perfil evaluado" : "perfiles evaluados"}
          </h2>
          {outcome.discarded > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {outcome.discarded} perfiles más se evaluaron pero no cumplen ningún criterio.
            </p>
          )}
        </div>
        {outcome.results.length > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-brand-blue"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        )}
      </div>

      {outcome.results.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500">
            Ningún perfil procesado cumple estos criterios.
          </p>
          {outcome.coverage.pending > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Quedan {outcome.coverage.pending} hojas de vida sin procesar que todavía no se pueden evaluar.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {outcome.results.map((row) => (
          <ResultCard key={row.profileVersionId} row={row} jobs={jobs} />
        ))}
      </div>

      {/* Relajación de criterios: aritmética sobre lo ya calculado */}
      {outcome.relaxations.length > 0 && (
        <div className="bg-brand-light rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Ampliar la búsqueda
          </p>
          {outcome.relaxations.map((r) => {
            const chip = findChipFor(chips, r.requirementText);
            return (
              <div key={r.requirementText} className="flex items-center gap-2 text-sm text-brand-navy">
                <span>
                  Quitando <strong>{r.requirementText}</strong> → {r.unlocked}{" "}
                  {r.unlocked === 1 ? "candidato más cumpliría" : "candidatos más cumplirían"} todo lo obligatorio
                </span>
                {chip && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDrop(chip.id)}
                    className="text-xs text-brand-blue hover:underline disabled:opacity-50"
                  >
                    quitar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Segundo nivel: sin perfil canónico, sin puntaje */}
      {outcome.unprocessed.length > 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-brand-navy">
              {outcome.unprocessed.length} coincidencias en hojas de vida sin procesar
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Sin evaluar — solo coincidencia de texto. No tienen puntaje porque todavía no se
              extrajo su perfil.
            </p>
          </div>
          <ul className="space-y-2">
            {outcome.unprocessed.map((hit) => (
              <li key={hit.documentId} className="text-xs text-gray-500 flex gap-2">
                <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-300" />
                <span>
                  <strong className="text-brand-navy">{hit.filename}</strong>
                  <span className="block text-gray-400 italic">&laquo;{hit.snippet}&raquo;</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de resultado ─────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { icon: string; className: string; label: string }> = {
  matched: { icon: "✓", className: "text-brand-green", label: "Cumple" },
  partial: { icon: "≈", className: "text-brand-yellow", label: "Parcial" },
  // 'unknown' NO es 'not_found' (spec §8): que el CV no lo mencione no
  // demuestra que la persona no lo sepa hacer
  unknown: { icon: "?", className: "text-gray-400", label: "El CV no lo dice" },
  not_found: { icon: "✗", className: "text-red-500", label: "No encontrado" },
};

function ResultCard({ row, jobs }: { row: TalentSearchRow; jobs: JobOption[] }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const openCv = async () => {
    if (!row.documentId) return;
    const result = await getCvUrlAction(row.documentId);
    if (result.url) window.open(result.url, "_blank", "noopener");
    else setMessage(result.error ?? null);
  };

  const addToJob = async (jobId: string) => {
    if (!jobId) return;
    setAdding(true);
    const result = await addToJobAction(row.profileVersionId, jobId);
    setAdding(false);
    setMessage(result.error ?? "Añadido a la oferta. El match real se está calculando.");
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-brand-navy truncate">{row.displayName}</h3>
            <ScoreBadge score={row.score} band={row.band} />
            <ConfidenceLabel value={row.confidence} />
            {row.source === "admin_upload" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                CV cargado
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-1">
            {[row.headline, row.city, row.totalYears !== null ? `${row.totalYears} años` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {/* Criterios de un vistazo, sin desplegar */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {row.requirements.slice(0, 8).map((req, i) => (
              <span key={i} className="text-xs text-gray-600 inline-flex items-center gap-1.5">
                <span className={`font-bold ${STATUS_STYLE[req.status]?.className ?? ""}`}>
                  {STATUS_STYLE[req.status]?.icon ?? "·"}
                </span>
                {req.requirementText}
              </span>
            ))}
          </div>

          {row.criticalGaps.length > 0 && (
            <p className="text-xs text-red-600 mt-2 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {row.criticalGaps.map((g) => g.requirementText).join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {row.documentId && (
            <button
              type="button"
              onClick={openCv}
              className="text-xs text-brand-blue hover:underline inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Ver CV
            </button>
          )}

          {jobs.length > 0 && (
            <label className="text-xs text-gray-500 inline-flex items-center gap-1.5">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <select
                defaultValue=""
                disabled={adding}
                onChange={(e) => addToJob(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              >
                <option value="">Añadir a vacante…</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {message && <p className="text-xs text-brand-blue mt-2">{message}</p>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs text-gray-500 hover:text-brand-blue inline-flex items-center gap-1"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        Por qué aparece
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          <p className="text-sm text-gray-600">{row.summary}</p>

          <ul className="space-y-2">
            {row.requirements.map((req, i) => (
              <RequirementLine key={i} req={req} />
            ))}
          </ul>

          {(row.email || row.phone) && (
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-gray-500">
              {row.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {row.email}
                </span>
              )}
              {row.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {row.phone}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Un requisito con su evidencia literal del CV. */
function RequirementLine({ req }: { req: RequirementResult }) {
  const style = STATUS_STYLE[req.status] ?? STATUS_STYLE.unknown;

  return (
    <li className="text-xs flex gap-2">
      <span className={`font-bold ${style.className} shrink-0`}>{style.icon}</span>
      <div className="min-w-0">
        <span className="text-brand-navy font-medium">{req.requirementText}</span>
        {req.importance === "preferred" && <span className="text-gray-400"> (deseable)</span>}
        <p className="text-gray-500 italic mt-0.5">
          {req.candidateEvidence
            ? `«${req.candidateEvidence}»`
            : req.status === "unknown"
              ? "No aparece en la hoja de vida — no significa que no lo tenga."
              : style.label}
        </p>
      </div>
    </li>
  );
}

/**
 * Empareja una sugerencia de relajación con su chip.
 * Las habilidades usan el nombre literal como texto de requisito, así que casan
 * por etiqueta; la experiencia mínima tiene su propio chip.
 */
function findChipFor(chips: QueryChip[], requirementText: string): QueryChip | undefined {
  const direct = chips.find((c) => c.label.toLowerCase() === requirementText.toLowerCase());
  if (direct) return direct;

  if (requirementText.startsWith("Mínimo")) {
    return chips.find((c) => c.id === "experience:years");
  }

  return undefined;
}
