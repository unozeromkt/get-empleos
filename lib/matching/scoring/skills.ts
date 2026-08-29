import { IMPORTANCE_WEIGHT } from "@/lib/matching/config";
import {
  bestEvidenceMatch,
  buildEvidenceBlocks,
  type EvidenceBlock,
} from "@/lib/matching/evidence";
import { matchSkill } from "@/lib/matching/normalize/skill-normalizer";
import { coverageCredit } from "@/lib/matching/scoring/coverage";
import type {
  CandidateEvidence,
  CategoryOutcome,
  JobSkillRequirement,
  RequirementResult,
} from "@/lib/matching/types";

/**
 * Techo de una habilidad deducida de la experiencia en vez de declarada.
 *
 * No es un castigo a la evidencia laboral —describir la tarea en un cargo es
 * mejor prueba que listar la palabra suelta en una tabla de habilidades—, sino
 * el margen de error de deducirla por coincidencia de texto. Se marca como
 * parcial para que quede a la vista del reclutador.
 */
const EXPERIENCE_EVIDENCE_SCORE = 0.85;

/**
 * Cobertura de habilidades — spec §14.
 *
 * Cada requisito de la oferta se empareja con la mejor habilidad del candidato
 * y produce un `RequirementResult` con su evidencia. El score de la categoría
 * es la cobertura ponderada por importancia.
 */
export function scoreSkills(
  requirements: JobSkillRequirement[],
  candidate: CandidateEvidence
): CategoryOutcome {
  // Si la oferta no exige nada en esta categoría, se devuelve null para que el
  // peso salga del denominador en lugar de penalizar al candidato (spec §12.2)
  if (requirements.length === 0) {
    return { score: null, requirements: [] };
  }

  // Corpus con TODO lo que el candidato escribió sobre su trabajo. Un
  // reclutador lee el CV entero, no solo la sección de habilidades: si alguien
  // dice "Publicidad ADS" al describir su cargo, esa es evidencia válida
  // aunque no la haya listado como skill.
  const evidenceBlocks = buildEvidenceBlocks(candidate);

  const results: RequirementResult[] = requirements.map((req) =>
    evaluateSkill(req, candidate, evidenceBlocks)
  );

  // Si de NINGÚN requisito se pudo obtener evidencia, la categoría no es
  // evaluable. Devolver 0 sería tratar "no sabemos" como "no cumple", que es
  // justo la distinción que sostiene todo el motor (spec §8).
  if (results.every((r) => r.status === "unknown")) {
    return { score: null, requirements: results };
  }

  let earned = 0;
  let possible = 0;

  for (let i = 0; i < requirements.length; i++) {
    const weight = IMPORTANCE_WEIGHT[requirements[i].importance];
    possible += weight;
    earned += weight * results[i].matchScore;
  }

  return {
    score: possible === 0 ? null : Math.round(100 * (earned / possible)),
    requirements: results,
  };
}

function evaluateSkill(
  req: JobSkillRequirement,
  candidate: CandidateEvidence,
  evidenceBlocks: EvidenceBlock[]
): RequirementResult {
  const match = matchSkill(req.rawName, candidate.skills, req.canonicalName);
  const matched = match.candidateIndex >= 0 ? candidate.skills[match.candidateIndex] : null;

  if (!matched) {
    // Segunda pasada: buscar la habilidad en la experiencia laboral antes de
    // darla por ausente
    const fromExperience = findInExperience(req, evidenceBlocks);

    if (fromExperience) {
      return {
        type: "skill",
        requirementText: req.rawName,
        importance: req.importance,
        status: "partial",
        matchType: "partial",
        matchScore: round2(fromExperience.credit * EXPERIENCE_EVIDENCE_SCORE),
        candidateEvidence: `${fromExperience.text} (${fromExperience.context})`,
        candidateValue: fromExperience.text,
        confidence: candidate.extractionConfidence,
      };
    }

    // Sin nada en la lista de habilidades NI en la experiencia: solo se puede
    // afirmar que falta si el CV aportó algo con qué comparar (spec §8)
    const noDataAtAll = candidate.skills.length === 0 && evidenceBlocks.length === 0;

    return {
      type: "skill",
      requirementText: req.rawName,
      importance: req.importance,
      status: noDataAtAll ? "unknown" : "not_found",
      matchType: noDataAtAll ? "unknown" : "not_found",
      matchScore: 0,
      candidateEvidence: "",
      candidateValue: null,
      confidence: noDataAtAll ? 0 : candidate.extractionConfidence,
    };
  }

  // Penalización por años insuficientes, solo si la oferta los exige Y el CV
  // permite calcularlos. Si no se saben, no se penaliza: se marca unknown.
  let score = match.score;
  let status: RequirementResult["status"] = match.score >= 0.99 ? "matched" : "partial";

  if (req.minimumYears !== null) {
    if (matched.yearsEstimate === null) {
      status = "partial";
      score = Math.min(score, 0.7);
    } else if (matched.yearsEstimate < req.minimumYears) {
      const ratio = matched.yearsEstimate / req.minimumYears;
      score = score * (0.5 + 0.5 * Math.min(1, ratio));
      status = "partial";
    }
  }

  return {
    type: "skill",
    requirementText: req.rawName,
    importance: req.importance,
    status,
    matchType: match.matchType,
    matchScore: round2(score),
    candidateEvidence: matched.evidence,
    candidateValue: matched.rawName,
    confidence: matched.confidence,
  };
}

/**
 * Busca el requisito en el texto libre de la experiencia laboral.
 *
 * Granularidad de frase: una habilidad es un concepto atómico y debe aparecer
 * como tal en algún renglón del CV, no armarse juntando palabras sueltas de un
 * cargo entero.
 */
export function findInExperience(
  req: JobSkillRequirement,
  blocks: EvidenceBlock[]
): { text: string; context: string; credit: number } | null {
  const match = bestEvidenceMatch([req.canonicalName, req.rawName], blocks, "sentence");
  if (!match) return null;

  const credit = coverageCredit(match.similarity);
  if (credit <= 0) return null;

  return { text: match.text, context: match.context, credit };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
