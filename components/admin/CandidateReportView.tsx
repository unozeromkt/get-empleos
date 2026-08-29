"use client";

import { Printer } from "lucide-react";

import { BAND_LABEL } from "@/components/shared/ScoreBadge";
import type { CandidateReport } from "@/lib/actions/ai-screening";
import { formatDate } from "@/lib/utils/date";

const CATEGORY_LABEL: Record<string, string> = {
  technical_skills: "Habilidades técnicas",
  experience: "Experiencia relevante",
  education_certifications: "Educación y certificaciones",
  transferable_skills: "Habilidades transferibles",
  languages: "Idiomas",
  preferred_skills: "Requisitos deseables",
  location: "Ubicación",
};

/**
 * Barras de color por categoría, en el estilo visual del reporte que sirvió de
 * referencia — pero mostrando las 6 categorías de NUESTRO motor determinístico,
 * cada una respaldada por evidencia citable, en vez de rasgos de personalidad
 * inferidos sin metodología validada (ver docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §21).
 */
const CATEGORY_COLOR: Record<string, string> = {
  technical_skills: "bg-brand-yellow",
  experience: "bg-red-400",
  education_certifications: "bg-brand-blue",
  transferable_skills: "bg-brand-green",
  languages: "bg-gray-400",
  preferred_skills: "bg-brand-purple",
  location: "bg-brand-cyan",
};

const STATUS_LABEL: Record<string, string> = {
  matched: "Cumple",
  partial: "Cumple parcialmente",
  not_found: "No cumple",
  unknown: "Sin evidencia en el CV",
};

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-brand-green/10 text-brand-green",
  partial: "bg-brand-yellow/10 text-brand-yellow",
  not_found: "bg-red-50 text-red-600",
  unknown: "bg-gray-100 text-gray-500",
};

const IMPORTANCE_LABEL: Record<string, string> = {
  must_have: "Indispensable",
  required: "Requerido",
  preferred: "Deseable",
};

export function CandidateReportView({ report }: { report: CandidateReport }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <div />
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 text-sm font-medium text-white bg-brand-navy px-4 py-2 rounded-xl hover:bg-brand-navy/90"
        >
          <Printer className="w-4 h-4" />
          Exportar / Imprimir
        </button>
      </div>

      {/* Encabezado */}
      <div className="bg-brand-navy text-white rounded-2xl p-6 print:rounded-none print:bg-brand-navy">
        <h1 className="font-display text-2xl font-bold uppercase">{report.jobTitle}</h1>
        {report.jobCity && <p className="text-white/70 text-sm mt-1">{report.jobCity}</p>}
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="font-medium">{report.displayName}</p>
          <div className="flex flex-wrap gap-x-4 text-sm text-white/80 mt-0.5">
            {report.email && <span>{report.email}</span>}
            {report.phone && <span>{report.phone}</span>}
          </div>
        </div>
      </div>

      {/* Tarjetas de score */}
      {report.match ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreTile label="Requisitos" value={report.match.requirementsScore} />
          <ScoreTile label="CV" value={report.match.overallScore} />
          <ScoreTile label="Autoevaluación" value={null} />
          <ScoreTile
            label="Total"
            value={report.match.overallScore}
            highlight
            sublabel={BAND_LABEL[report.match.band] ?? report.match.band}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-500">
          Este candidato todavía no tiene una evaluación calculada.
        </div>
      )}

      {report.match && (
        <>
          {/* Resumen y confianza */}
          <section className="rounded-2xl border border-gray-200 p-5 print:border-gray-300">
            <p className="text-sm text-gray-700">{report.match.explanation.summary}</p>
            <p className="text-xs text-gray-500 mt-2">
              Confianza del resultado: {Math.round(report.match.scoreConfidence * 100)}% · Calculado el{" "}
              {formatDate(report.match.computedAt)} · Motor v{report.match.scoringVersion}
            </p>
          </section>

          {report.match.criticalGaps.length > 0 && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 print:border-red-300">
              <h2 className="font-display font-semibold text-red-900 mb-2">Brechas críticas</h2>
              <ul className="text-sm text-red-700 space-y-1">
                {report.match.criticalGaps.map((gap, i) => (
                  <li key={i}>· {gap.requirementText}</li>
                ))}
              </ul>
              <p className="text-xs text-red-600 mt-2">
                Información para la revisión. Ningún candidato se descarta automáticamente.
              </p>
            </section>
          )}

          {/* Requirements Compliance */}
          <section className="rounded-2xl border border-gray-200 overflow-hidden print:border-gray-300">
            <h2 className="font-display font-semibold text-brand-navy px-5 pt-5 pb-3">
              Cumplimiento de requisitos
            </h2>
            <div className="divide-y divide-gray-100">
              {report.requirements.map((req, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-brand-navy">{req.requirementText}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {IMPORTANCE_LABEL[req.importance] ?? req.importance}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[req.status] ?? STATUS_STYLE.unknown}`}
                    >
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                  </div>
                  {req.candidateEvidence && (
                    <p className="text-xs text-gray-600 mt-1.5 italic border-l-2 border-gray-200 pl-2">
                      &ldquo;{req.candidateEvidence}&rdquo;
                    </p>
                  )}
                  {req.status === "unknown" && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      La hoja de vida no menciona este punto. No se interpreta como incumplimiento.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Categorías del motor — evidencia, no personalidad */}
          <section className="rounded-2xl border border-gray-200 p-5 print:border-gray-300">
            <h2 className="font-display font-semibold text-brand-navy mb-1">Evaluación por categoría</h2>
            <p className="text-xs text-gray-500 mb-4">
              Cada barra refleja cobertura de requisitos con evidencia citable, no un juicio de
              personalidad.
            </p>
            <div className="space-y-3">
              {Object.entries(report.match.categoryScores).map(([key, value]) => (
                <CategoryBar
                  key={key}
                  label={CATEGORY_LABEL[key] ?? key}
                  value={value}
                  color={CATEGORY_COLOR[key] ?? "bg-gray-400"}
                />
              ))}
            </div>
          </section>

          {(report.match.explanation.strengths.length > 0 ||
            report.match.explanation.gaps.length > 0) && (
            <section className="grid sm:grid-cols-2 gap-4">
              {report.match.explanation.strengths.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-5 print:border-gray-300">
                  <h3 className="text-sm font-semibold text-brand-navy mb-2">Fortalezas</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {report.match.explanation.strengths.map((s, i) => (
                      <li key={i}>✓ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.match.explanation.gaps.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-5 print:border-gray-300">
                  <h3 className="text-sm font-semibold text-brand-navy mb-2">Brechas</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {report.match.explanation.gaps.map((g, i) => (
                      <li key={i}>! {g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        Reporte generado por GetEmpleos · Herramienta de apoyo a la selección, no una decisión de
        contratación.
      </p>
    </div>
  );
}

function ScoreTile({
  label,
  value,
  highlight,
  sublabel,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  sublabel?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 text-center print:border print:border-gray-300 ${
        highlight ? "bg-brand-blue text-white" : "bg-white border border-gray-200"
      }`}
    >
      <p className={`text-xs ${highlight ? "text-white/80" : "text-gray-500"}`}>{label}</p>
      <p className="font-display text-2xl font-bold mt-1">{value !== null ? `${value}%` : "N/A"}</p>
      {sublabel && (
        <p className={`text-xs mt-0.5 ${highlight ? "text-white/80" : "text-gray-500"}`}>{sublabel}</p>
      )}
    </div>
  );
}

function CategoryBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-brand-navy">{value !== null ? `${value}%` : "No aplica"}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        {value !== null && (
          <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
        )}
      </div>
    </div>
  );
}
