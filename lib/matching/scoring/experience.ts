import { bestEvidenceMatch } from "@/lib/matching/evidence";
import { conceptSimilarity } from "@/lib/matching/normalize/skill-normalizer";
import { coverageCredit } from "@/lib/matching/scoring/coverage";
import type {
  CandidateEvidence,
  CategoryOutcome,
  ExperienceWeights,
  JobRequirements,
  RequirementResult,
  SemanticAdjudication,
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
  weights: ExperienceWeights,
  adjudications: SemanticAdjudication[] = []
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
  const roleTargets = requiresRoles ? job.experience.relevantRoles : [job.title];

  // ── 1. Años relevantes ──
  if (requiresYears) {
    const required = job.experience.minimumYears as number;
    const relevant = relevantYearsFromRoles(roleTargets, candidate);
    const actual = relevant ?? candidate.totalYearsExperience;

    if (actual === null) {
      // El CV no permitió calcularlos. No es una carencia: es desconocido (§8)
      results.push({
        type: "experience",
        requirementText: `Mínimo ${required} años de experiencia relevante`,
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
        requirementText: `Mínimo ${required} años de experiencia relevante`,
        importance: "required",
        status: fit >= 1 ? "matched" : "partial",
        matchType: fit >= 1 ? "exact" : "partial",
        matchScore: round2(fit),
        candidateEvidence:
          relevant !== null
            ? `${round2(actual)} años en cargos relacionados`
            : `${round2(actual)} años de experiencia total`,
        candidateValue: `${actual} años`,
        confidence: candidate.extractionConfidence,
      });
      parts.push({ value: fit, weight: weights.relevant_years_fit });
    }
  }

  // ── 2. Similitud de cargos ──
  if (requiresRoles || job.title) {
    const best = bestRoleMatch(roleTargets, candidate);
    const requirementText = `Experiencia en cargos similares a: ${roleTargets.join(", ")}`;
    const adjudication = findAdjudication(adjudications, "experience", requirementText);
    const useAdjudication = !!adjudication && adjudication.matchScore > best.score;
    const roleScore = useAdjudication ? adjudication.matchScore : best.score;

    results.push({
      type: "experience",
      requirementText,
      importance: requiresRoles ? "required" : "preferred",
      status: useAdjudication
        ? adjudication.status
        : statusFromScore(best.score, candidate.experience.length === 0),
      matchType: useAdjudication
        ? "semantic"
        : matchTypeFromScore(best.score, candidate.experience.length === 0),
      matchScore: round2(roleScore),
      candidateEvidence: useAdjudication ? adjudication.candidateEvidence : best.evidence,
      candidateValue: useAdjudication ? adjudication.candidateValue : best.title,
      confidence: useAdjudication ? adjudication.confidence : candidate.extractionConfidence,
    });

    parts.push({ value: roleScore, weight: weights.role_similarity });
  }

  // ── 3. Cobertura de responsabilidades (§16) ──
  if (requiresResponsibilities) {
    const coverage = scoreResponsibilityCoverage(
      job.responsibilities,
      candidate,
      adjudications
    );
    results.push(...coverage.results);
    // Un CV que solo enumera cargos no demuestra incumplimiento de cada
    // función. Sin descripción laboral, la señal queda fuera del denominador y
    // baja la confianza; no convierte ausencia de detalle en un cero.
    if (coverage.average !== null) {
      parts.push({ value: coverage.average, weight: weights.responsibility_coverage });
    }
  }

  // ── 4. Sector, solo si la oferta lo exige ──
  if (requiresIndustry) {
    const haystack = candidate.experience.map((e) => `${e.company} ${e.title}`).join(" ");
    const best = Math.max(...job.experience.industries.map((i) => conceptSimilarity(i, haystack)), 0);

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

/**
 * Cobertura de responsabilidades — spec §16, revisada.
 *
 * Dos correcciones frente a la versión anterior:
 *
 *  1. La evidencia se evalúa por CARGO completo, no frase a frase. Una
 *     responsabilidad como "Gestionar bases de datos y mantener actualizada la
 *     información de los clientes" se sustenta en un CV real con dos o tres
 *     frases distintas del mismo puesto; ninguna la cubre por sí sola.
 *  2. La similitud pasa por la curva de cumplimiento en vez de usarse como
 *     nota directa. Ver `scoring/coverage.ts`: un candidato que hace
 *     exactamente el trabajo pedido rara vez supera 0,6 de solapamiento.
 */
export function scoreResponsibilityCoverage(
  responsibilities: string[],
  candidate: CandidateEvidence,
  adjudications: SemanticAdjudication[] = []
): { average: number | null; results: RequirementResult[] } {
  // Solo evidencia de tareas realizadas. El título del cargo y el resumen
  // profesional se evalúan en señales separadas: usarlos aquí producía falsos
  // positivos como asociar "persona responsable" con "recibir mercancía".
  const blocks = candidate.experience.flatMap((job) => {
    const title = normalizeForComparison(job.title);
    const texts = [
      ...job.responsibilities,
      ...job.achievements,
      // Extractores v1 repetían el título como skill. Eso no aporta detalle.
      ...job.skills.filter((skill) => normalizeForComparison(skill) !== title),
    ].filter((text) => !!text?.trim());

    return texts.length > 0
      ? [{ context: `${job.title}${job.company ? ` en ${job.company}` : ""}`, texts }]
      : [];
  });

  const results = responsibilities.map<RequirementResult>((responsibility) => {
    const best = bestEvidenceMatch([responsibility], blocks, "pooled");
    const credit = best ? coverageCredit(best.similarity) : 0;
    const noData = blocks.length === 0;
    const adjudication = findAdjudication(adjudications, "responsibility", responsibility);
    const useAdjudication = !!adjudication && adjudication.matchScore > credit;

    return {
      type: "responsibility",
      requirementText: responsibility,
      importance: "required",
      status: useAdjudication ? adjudication.status : statusFromCredit(credit, noData),
      matchType: useAdjudication ? "semantic" : matchTypeFromCredit(credit, noData),
      matchScore: round2(useAdjudication ? adjudication.matchScore : credit),
      candidateEvidence: useAdjudication
        ? adjudication.candidateEvidence
        : credit > 0
          ? (best?.text ?? "")
          : "",
      candidateValue: useAdjudication
        ? adjudication.candidateValue
        : credit > 0
          ? (best?.context ?? null)
          : null,
      confidence: useAdjudication ? adjudication.confidence : candidate.extractionConfidence,
    };
  });

  const average =
    blocks.length === 0 || results.length === 0
      ? null
      : results.reduce((sum, r) => sum + r.matchScore, 0) / results.length;

  return { average, results };
}

function findAdjudication(
  adjudications: SemanticAdjudication[],
  type: SemanticAdjudication["type"],
  requirementText: string
): SemanticAdjudication | undefined {
  const normalized = normalizeForComparison(requirementText);
  return adjudications.find(
    (item) => item.type === type && normalizeForComparison(item.requirementText) === normalized
  );
}

function bestRoleMatch(
  targets: string[],
  candidate: CandidateEvidence
): { score: number; title: string | null; evidence: string } {
  let best = { score: 0, title: null as string | null, evidence: "" };

  for (const job of candidate.experience) {
    for (const target of targets) {
      const similarity = conceptSimilarity(target, job.title);
      if (
        similarity > best.score ||
        (similarity === best.score &&
          (job.durationMonths ?? 0) >
            (candidate.experience.find((e) => e.title === best.title)?.durationMonths ?? 0))
      ) {
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

/**
 * Años verificables en cargos conceptualmente relacionados con la oferta.
 * Se usa antes que la experiencia total: diez años en otro oficio no deben
 * satisfacer un requisito de un año de experiencia relevante.
 */
function relevantYearsFromRoles(
  targets: string[],
  candidate: CandidateEvidence
): number | null {
  let months = 0;
  let foundDuration = false;

  for (const job of candidate.experience) {
    if (job.durationMonths === null || job.durationMonths === undefined) continue;
    const similarity = Math.max(...targets.map((target) => conceptSimilarity(target, job.title)), 0);
    if (similarity < MATCHED_THRESHOLD) continue;
    months += Math.max(0, job.durationMonths);
    foundDuration = true;
  }

  return foundDuration ? months / 12 : null;
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Umbrales de clasificación. SIN CALIBRAR — ver §14 y Fase 6. */
const MATCHED_THRESHOLD = 0.8;
const PARTIAL_THRESHOLD = 0.3;

/**
 * Los estados de una responsabilidad se leen sobre el crédito ya convertido,
 * no sobre la similitud cruda: si no, el reclutador ve "No cumple" junto a un
 * puntaje de 0,8 en el mismo renglón.
 */
function statusFromCredit(credit: number, noData: boolean): RequirementResult["status"] {
  if (noData) return "unknown";
  if (credit >= 0.85) return "matched";
  if (credit > 0) return "partial";
  return "not_found";
}

function matchTypeFromCredit(credit: number, noData: boolean): RequirementResult["matchType"] {
  if (noData) return "unknown";
  if (credit >= 0.85) return "semantic";
  if (credit > 0) return "partial";
  return "not_found";
}

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
