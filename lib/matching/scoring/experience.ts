import { textSimilarity } from "@/lib/matching/normalize/skill-normalizer";
import type {
  CandidateEvidence,
  CategoryOutcome,
  ExperienceWeights,
  JobRequirements,
  RequirementResult,
} from "@/lib/matching/types";

/**
 * Experiencia — spec §15.
 *
 * NO se evalúa solo por cantidad total de años. Se combinan cuatro señales:
 *   1. Ajuste de años relevantes
 *   2. Similitud entre cargos anteriores y el cargo objetivo
 *   3. Cobertura de responsabilidades (§16)
 *   4. Experiencia sectorial, SOLO si la oferta la exige
 *
 * Advertencia de la spec sobre "recency": NO se penaliza la antigüedad general
 * de la experiencia, porque genera sesgo por edad. Aquí no se usa en absoluto.
 */
export function scoreExperience(
  job: JobRequirements,
  candidate: CandidateEvidence,
  weights: ExperienceWeights
): CategoryOutcome {
  const requiresYears = job.experience.minimumYears !== null;
  const requiresRoles = job.experience.relevantRoles.length > 0;
  const requiresResponsibilities = job.responsibilities.length > 0;
  const requiresIndustry = job.experience.industries.length > 0;

  // La oferta no dice nada sobre experiencia → fuera del denominador (§12.2)
  if (!requiresYears && !requiresRoles && !requiresResponsibilities && !requiresIndustry) {
    return { score: null, requirements: [] };
  }

  const results: RequirementResult[] = [];
  const parts: Array<{ value: number; weight: number }> = [];

  // ── 1. Años relevantes ──
  if (requiresYears) {
    const required = job.experience.minimumYears as number;
    const actual = candidate.totalYearsExperience;

    if (actual === null) {
      // El CV no permitió calcularlos. No es una carencia: es desconocido (§8)
      results.push({
        type: "experience",
        requirementText: `Mínimo ${required} años de experiencia`,
        importance: "required",
        status: "unknown",
        matchType: "unknown",
        matchScore: 0,
        candidateEvidence: "",
        candidateValue: null,
        confidence: 0,
      });
      parts.push({ value: 0.5, weight: weights.relevant_years_fit });
    } else {
      // Sobrecualificación NO penaliza: superar el mínimo es cumplirlo
      const fit = Math.min(1, actual / required);
      results.push({
        type: "experience",
        requirementText: `Mínimo ${required} años de experiencia`,
        importance: "required",
        status: fit >= 1 ? "matched" : "partial",
        matchType: fit >= 1 ? "exact" : "partial",
        matchScore: round2(fit),
        candidateEvidence: `${actual} años de experiencia total`,
        candidateValue: `${actual} años`,
        confidence: candidate.extractionConfidence,
      });
      parts.push({ value: fit, weight: weights.relevant_years_fit });
    }
  }

  // ── 2. Similitud de cargos ──
  if (requiresRoles || job.title) {
    const targets = requiresRoles ? job.experience.relevantRoles : [job.title];
    const best = bestRoleMatch(targets, candidate);

    results.push({
      type: "experience",
      requirementText: `Experiencia en cargos similares a: ${targets.join(", ")}`,
      importance: requiresRoles ? "required" : "preferred",
      status: statusFromScore(best.score, candidate.experience.length === 0),
      matchType: matchTypeFromScore(best.score, candidate.experience.length === 0),
      matchScore: round2(best.score),
      candidateEvidence: best.evidence,
      candidateValue: best.title,
      confidence: candidate.extractionConfidence,
    });

    parts.push({ value: best.score, weight: weights.role_similarity });
  }

  // ── 3. Cobertura de responsabilidades (§16) ──
  if (requiresResponsibilities) {
    const coverage = scoreResponsibilityCoverage(job.responsibilities, candidate);
    results.push(...coverage.results);
    parts.push({ value: coverage.average, weight: weights.responsibility_coverage });
  }

  // ── 4. Sector, solo si la oferta lo exige ──
  if (requiresIndustry) {
    const haystack = candidate.experience.map((e) => `${e.company} ${e.title}`).join(" ");
    const best = Math.max(...job.experience.industries.map((i) => textSimilarity(i, haystack)), 0);

    results.push({
      type: "experience",
      requirementText: `Experiencia en el sector: ${job.experience.industries.join(", ")}`,
      importance: "preferred",
      status: statusFromScore(best, candidate.experience.length === 0),
      matchType: matchTypeFromScore(best, candidate.experience.length === 0),
      matchScore: round2(best),
      candidateEvidence: "",
      candidateValue: null,
      confidence: candidate.extractionConfidence,
    });

    parts.push({ value: best, weight: weights.required_domain_experience });
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return { score: null, requirements: results };

  // Renormalización interna: los sub-pesos de las señales ausentes salen del
  // denominador, igual que a nivel de categoría (§12.2)
  const weighted = parts.reduce((sum, p) => sum + p.value * p.weight, 0);

  return { score: Math.round(100 * (weighted / totalWeight)), requirements: results };
}

/** Cobertura de responsabilidades — spec §16. */
export function scoreResponsibilityCoverage(
  responsibilities: string[],
  candidate: CandidateEvidence
): { average: number; results: RequirementResult[] } {
  // Todo lo que el candidato hizo: responsabilidades, logros y proyectos
  const candidateActivities = candidate.experience.flatMap((e) => [
    ...e.responsibilities,
    ...e.achievements,
  ]);

  const results = responsibilities.map<RequirementResult>((responsibility) => {
    let bestScore = 0;
    let bestEvidence = "";

    for (const activity of candidateActivities) {
      const similarity = textSimilarity(responsibility, activity);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestEvidence = activity;
      }
    }

    const noData = candidateActivities.length === 0;

    return {
      type: "responsibility",
      requirementText: responsibility,
      importance: "required",
      status: statusFromScore(bestScore, noData),
      matchType: matchTypeFromScore(bestScore, noData),
      matchScore: round2(bestScore),
      candidateEvidence: bestScore > 0 ? bestEvidence : "",
      candidateValue: null,
      confidence: candidate.extractionConfidence,
    };
  });

  const average =
    results.length === 0 ? 0 : results.reduce((sum, r) => sum + r.matchScore, 0) / results.length;

  return { average, results };
}

function bestRoleMatch(
  targets: string[],
  candidate: CandidateEvidence
): { score: number; title: string | null; evidence: string } {
  let best = { score: 0, title: null as string | null, evidence: "" };

  for (const job of candidate.experience) {
    for (const target of targets) {
      const similarity = textSimilarity(target, job.title);
      if (similarity > best.score) {
        best = {
          score: similarity,
          title: job.title,
          evidence: `${job.title} en ${job.company}`,
        };
      }
    }
  }

  return best;
}

/** Umbrales de clasificación. SIN CALIBRAR — ver §14 y Fase 6. */
const MATCHED_THRESHOLD = 0.8;
const PARTIAL_THRESHOLD = 0.3;

function statusFromScore(score: number, noData: boolean): RequirementResult["status"] {
  if (noData) return "unknown";
  if (score >= MATCHED_THRESHOLD) return "matched";
  if (score >= PARTIAL_THRESHOLD) return "partial";
  return "not_found";
}

function matchTypeFromScore(score: number, noData: boolean): RequirementResult["matchType"] {
  if (noData) return "unknown";
  if (score >= MATCHED_THRESHOLD) return "exact";
  if (score >= PARTIAL_THRESHOLD) return "partial";
  return "not_found";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
