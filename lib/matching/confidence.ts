import type { CandidateEvidence, RequirementResult } from "@/lib/matching/types";

/**
 * Confianza en el score — spec §20.
 *
 * SEPARADA del score, deliberadamente. Es perfectamente posible tener:
 *
 *     Match: 88/100    Confianza: 54%
 *
 * si el CV traía poca información. Baja confianza NO se convierte en bajo
 * match: significa "no tenemos con qué juzgar", no "es mal candidato".
 * Colapsarlas en un solo número destruiría esa distinción.
 */
export function computeScoreConfidence(
  requirements: RequirementResult[],
  candidate: CandidateEvidence
): number {
  // Sin requisitos evaluables, la confianza depende solo de la extracción
  if (requirements.length === 0) return round2(candidate.extractionConfidence);

  // 1. Proporción de requisitos sobre los que SÍ encontramos evidencia
  const known = requirements.filter((r) => r.status !== "unknown").length;
  const coverage = known / requirements.length;

  // 2. Proporción de requisitos resueltos con una cita textual del CV
  const withEvidence = requirements.filter((r) => r.candidateEvidence.trim().length > 0).length;
  const evidenceRatio = withEvidence / requirements.length;

  // 3. Confianza de la extracción documental
  const extraction = candidate.extractionConfidence;

  // Cobertura pesa más: un score calculado sobre muchos `unknown` es el caso
  // que más engaña al reclutador si se presenta como fiable
  const confidence = 0.45 * coverage + 0.25 * evidenceRatio + 0.3 * extraction;

  // Un perfil demasiado escueto nunca puede dar confianza alta, por muy bien
  // que haya salido la extracción de lo poco que había
  return round2(candidate.isSparse ? Math.min(confidence, 0.4) : confidence);
}

function round2(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
