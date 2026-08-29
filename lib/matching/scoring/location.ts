import { normalizeText } from "@/lib/matching/normalize/skill-normalizer";
import type { CandidateEvidence, CategoryOutcome, JobRequirements } from "@/lib/matching/types";

/**
 * Ubicación — categoría nueva en v2.
 *
 * El motor no miraba dónde vive el candidato, y para el grueso de las
 * vacantes del portal (operarios, call center, bodega) el cargo es presencial
 * en una ciudad concreta: vivir allí es un requisito del PUESTO, no un rasgo
 * de la persona. No tenerlo en cuenta hacía que un candidato de otra ciudad
 * puntuara igual que uno local, y obligaba al reclutador a filtrar a mano.
 *
 * Límites deliberados:
 *   - Se compara CIUDAD y DEPARTAMENTO. La dirección de residencia sigue
 *     prohibida como entrada del motor (§29).
 *   - Una oferta remota no puntúa ubicación: la categoría sale del cálculo.
 *   - Si el CV no dice la ciudad, es `unknown`, no incumplimiento (§8).
 *   - No descarta a nadie: un cargo presencial con ciudad distinta genera
 *     brecha crítica visible, y decide una persona. La gente se traslada.
 */

/** Mismo departamento, otra ciudad: desplazarse es posible, no seguro. */
const SAME_REGION_SCORE = 0.5;

export function scoreLocation(
  job: JobRequirements,
  candidate: CandidateEvidence
): CategoryOutcome {
  const location = job.location;

  if (!location || !location.city || location.workMode === "remote") {
    return { score: null, requirements: [] };
  }

  const importance = location.workMode === "onsite" ? "must_have" : "required";
  const label = [location.city, location.region].filter(Boolean).join(", ");
  const requirementText = `Residir en ${label}`;

  if (!candidate.city?.trim()) {
    return {
      score: null,
      requirements: [
        {
          type: "location",
          requirementText,
          importance,
          status: "unknown",
          matchType: "unknown",
          matchScore: 0,
          candidateEvidence: "",
          candidateValue: null,
          confidence: 0,
        },
      ],
    };
  }

  const candidateCity = normalizeText(candidate.city);
  const jobCity = normalizeText(location.city);
  const jobRegion = location.region ? normalizeText(location.region) : "";

  // El CV suele traer "NEIVA (HUILA)" o "Neiva - Huila" en un solo campo:
  // por eso se comprueba inclusión en ambos sentidos, no igualdad estricta.
  const sameCity =
    !!jobCity && (candidateCity.includes(jobCity) || jobCity.includes(candidateCity));
  const sameRegion = !!jobRegion && candidateCity.includes(jobRegion);

  const score = sameCity ? 1 : sameRegion ? SAME_REGION_SCORE : 0;

  return {
    score: Math.round(100 * score),
    requirements: [
      {
        type: "location",
        requirementText,
        importance,
        status: score >= 1 ? "matched" : score > 0 ? "partial" : "not_found",
        matchType: score >= 1 ? "exact" : score > 0 ? "partial" : "not_found",
        matchScore: score,
        candidateEvidence: candidate.city,
        candidateValue: candidate.city,
        confidence: candidate.extractionConfidence,
      },
    ],
  };
}
