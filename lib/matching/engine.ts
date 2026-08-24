import { computeScoreConfidence } from "@/lib/matching/confidence";
import { DEFAULT_SCORING_CONFIG, resolveBand } from "@/lib/matching/config";
import { scoreCredentials, scoreLanguages, scoreTransferable } from "@/lib/matching/scoring/credentials";
import { scoreExperience } from "@/lib/matching/scoring/experience";
import { scoreSkills } from "@/lib/matching/scoring/skills";
import type {
  CandidateEvidence,
  CategoryOutcome,
  CriticalGap,
  JobRequirements,
  MatchExplanation,
  MatchResult,
  RequirementResult,
  ScoreCategory,
  ScoringConfiguration,
  ScoringWeights,
} from "@/lib/matching/types";
import { SCORING_VERSION } from "@/lib/matching/types";

/**
 * CandidateJobMatchingService — spec §10.
 *
 * Función pura y determinística: mismas entradas y misma versión de
 * configuración producen siempre el mismo resultado. No toca red, base de
 * datos, reloj ni aleatoriedad.
 *
 * El LLM NO participa aquí. Solo aporta los perfiles estructurados de entrada;
 * la aritmética es toda de este módulo. Por eso un documento con instrucciones
 * maliciosas no puede alterar la puntuación de nadie (spec §26).
 */
export function calculateMatch(
  job: JobRequirements,
  candidate: CandidateEvidence,
  config: ScoringConfiguration = DEFAULT_SCORING_CONFIG
): MatchResult {
  // Los requisitos preferidos van a su propia categoría (spec §12.1)
  const coreSkills = job.skills.filter(
    (s) => s.importance !== "preferred" && s.category !== "transferable"
  );
  const preferredSkills = job.skills.filter(
    (s) => s.importance === "preferred" && s.category !== "transferable"
  );

  const outcomes: Record<ScoreCategory, CategoryOutcome> = {
    technical_skills: scoreSkills(coreSkills, candidate),
    experience: scoreExperience(job, candidate, config.experience_weights),
    education_certifications: scoreCredentials(job, candidate),
    transferable_skills: scoreTransferable(job, candidate),
    languages: scoreLanguages(job, candidate),
    preferred_skills: scoreSkills(preferredSkills, candidate),
  };

  const categoryScores = Object.fromEntries(
    Object.entries(outcomes).map(([key, outcome]) => [key, outcome.score])
  ) as Record<ScoreCategory, number | null>;

  const { overallScore, appliedWeights } = combineScores(categoryScores, config.weights);

  const requirements = Object.values(outcomes).flatMap((o) => o.requirements);
  const scoreConfidence = computeScoreConfidence(requirements, candidate);
  const band = resolveBand(overallScore, scoreConfidence, config, candidate.isSparse);
  const criticalGaps = findCriticalGaps(requirements, job);

  return {
    overallScore,
    band,
    scoreConfidence,
    categoryScores,
    requirements,
    criticalGaps,
    explanation: buildExplanation(requirements, criticalGaps, categoryScores, candidate),
    scoringVersion: config.version || SCORING_VERSION,
    appliedWeights,
  };
}

/**
 * Combina las categorías renormalizando los pesos — spec §12.2.
 *
 * Si la vacante no exige nada en una categoría, su peso sale del denominador
 * en lugar de contar como cero. Sin esto, una oferta que no pide educación
 * castigaría a todos los candidatos con un 10% perdido de forma automática.
 *
 *   overall = Σ(score_aplicable × peso_aplicable) / Σ(pesos_aplicables)
 */
export function combineScores(
  categoryScores: Record<ScoreCategory, number | null>,
  weights: ScoringWeights
): { overallScore: number; appliedWeights: Partial<ScoringWeights> } {
  const applied: Partial<ScoringWeights> = {};
  let weighted = 0;
  let totalWeight = 0;

  for (const [category, score] of Object.entries(categoryScores) as Array<
    [ScoreCategory, number | null]
  >) {
    if (score === null) continue; // la oferta no exige nada aquí

    const weight = weights[category] ?? 0;
    if (weight <= 0) continue;

    applied[category] = weight;
    weighted += score * weight;
    totalWeight += weight;
  }

  // Ninguna categoría aplicable: no hay nada que puntuar
  if (totalWeight === 0) return { overallScore: 0, appliedWeights: applied };

  return { overallScore: Math.round(weighted / totalWeight), appliedWeights: applied };
}

/**
 * Brechas críticas — spec §13.
 *
 * Un `must_have` no cumplido genera una brecha crítica, pero NUNCA descarta
 * automáticamente al candidato en el MVP: se muestra junto a su score para que
 * decida una persona.
 *
 * Importante: solo cuenta como brecha si hay evidencia suficiente de que NO se
 * cumple (`not_found`). Un `unknown` no genera brecha — que el CV no lo
 * mencione no demuestra que la persona no lo tenga (§8).
 */
export function findCriticalGaps(
  requirements: RequirementResult[],
  job: JobRequirements
): CriticalGap[] {
  const gaps: CriticalGap[] = requirements
    .filter((r) => r.importance === "must_have" && r.status === "not_found")
    .map((r) => ({
      requirementText: r.requirementText,
      reason: "Requisito indispensable sin evidencia en la hoja de vida.",
    }));

  // Requisitos excluyentes declarados de forma explícita en la oferta
  for (const knockout of job.knockouts) {
    const related = requirements.find(
      (r) => r.requirementText.toLowerCase() === knockout.toLowerCase()
    );
    if (related && related.status === "not_found") {
      gaps.push({
        requirementText: knockout,
        reason: "Requisito excluyente declarado en la oferta, sin evidencia en la hoja de vida.",
      });
    }
  }

  return gaps;
}

/**
 * Explicación del score — spec §19.
 *
 * Debe responder: ¿POR QUÉ este candidato obtuvo esta puntuación? Se genera de
 * forma determinística desde los resultados, no con un LLM: así la explicación
 * nunca puede contradecir al número que acompaña.
 */
function buildExplanation(
  requirements: RequirementResult[],
  criticalGaps: CriticalGap[],
  categoryScores: Record<ScoreCategory, number | null>,
  candidate: CandidateEvidence
): MatchExplanation {
  const matched = requirements.filter((r) => r.status === "matched");
  const notFound = requirements.filter((r) => r.status === "not_found");
  const unknown = requirements.filter((r) => r.status === "unknown");

  const strengths = matched
    .slice(0, 6)
    .map((r) =>
      r.candidateValue
        ? `${r.requirementText} — evidencia: ${r.candidateValue}`
        : r.requirementText
    );

  const gaps = notFound
    .slice(0, 6)
    .map((r) => `Sin evidencia de: ${r.requirementText}`);

  // Los `unknown` se presentan como preguntas, no como carencias (§8)
  const questionsForRecruiter = unknown
    .slice(0, 6)
    .map((r) => `¿El candidato cumple con "${r.requirementText}"? No aparece en su hoja de vida.`);

  if (candidate.isSparse) {
    questionsForRecruiter.unshift(
      "La hoja de vida aporta poca información. Conviene revisarla manualmente antes de descartar."
    );
  }

  const skillsScore = categoryScores.technical_skills;
  const summary =
    criticalGaps.length > 0
      ? `Cumple ${matched.length} de ${requirements.length} requisitos evaluados, con ${criticalGaps.length} brecha(s) crítica(s).`
      : `Cumple ${matched.length} de ${requirements.length} requisitos evaluados${
          skillsScore !== null ? `, con ${skillsScore}% de cobertura en habilidades técnicas` : ""
        }.`;

  return { summary, strengths, gaps, questionsForRecruiter };
}
