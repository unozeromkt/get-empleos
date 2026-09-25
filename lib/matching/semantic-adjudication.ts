import type { MatchAdjudicationResponse } from "@/lib/ai/schemas/match-adjudication";
import { normalizeText } from "@/lib/matching/normalize/skill-normalizer";
import type {
  CandidateEvidence,
  JobRequirements,
  MatchResult,
  RequirementResult,
  SemanticAdjudication,
} from "@/lib/matching/types";

const MAX_REQUIREMENTS = 6;
const MAX_EVIDENCE_ITEMS = 60;
const MIN_CONFIDENCE = 0.7;

export interface SemanticAdjudicationRequest {
  requirements: Array<{
    requirement_type: "skill" | "experience" | "responsibility";
    requirement_text: string;
    current_status: RequirementResult["status"];
    current_score: number;
  }>;
  candidate_evidence: string[];
  role_evidence: string[];
  responsibility_evidence: string[];
}

/**
 * Selecciona solo los casos que el motor no pudo resolver bien. No se envían
 * datos de contacto ni competencias conductuales a esta segunda opinión.
 */
export function buildSemanticAdjudicationRequest(
  job: JobRequirements,
  candidate: CandidateEvidence,
  result: MatchResult
): SemanticAdjudicationRequest | null {
  const transferable = new Set(
    job.skills
      .filter((skill) => skill.category === "transferable")
      .map((skill) => normalizeText(skill.rawName))
  );

  const requirements = result.requirements
    .filter(
      (requirement): requirement is RequirementResult & {
        type: "skill" | "experience" | "responsibility";
      } =>
        (requirement.type === "skill" ||
          (requirement.type === "experience" &&
            requirement.requirementText.startsWith("Experiencia en cargos similares a:")) ||
          requirement.type === "responsibility") &&
        requirement.matchType !== "exact" &&
        requirement.matchType !== "canonical_alias" &&
        requirement.matchType !== "taxonomy_related" &&
        requirement.matchType !== "semantic" &&
        !(
          requirement.type === "skill" &&
          transferable.has(normalizeText(requirement.requirementText))
        )
    )
    .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance))
    .slice(0, MAX_REQUIREMENTS)
    .map((requirement) => ({
      requirement_type: requirement.type,
      requirement_text: requirement.requirementText,
      current_status: requirement.status,
      current_score: requirement.matchScore,
    }));

  const candidateEvidence = collectCandidateEvidence(candidate).slice(0, MAX_EVIDENCE_ITEMS);
  const roleEvidence = uniqueEvidence(
    candidate.experience.flatMap((experience) => [
      experience.title,
      ...experience.responsibilities,
      ...experience.achievements,
      ...experience.skills,
    ])
  ).slice(0, MAX_EVIDENCE_ITEMS);
  const responsibilityEvidence = uniqueEvidence(
    candidate.experience.flatMap((experience) => [
      ...experience.responsibilities,
      ...experience.achievements,
      ...experience.skills,
    ])
  ).slice(0, MAX_EVIDENCE_ITEMS);
  if (requirements.length === 0 || candidateEvidence.length === 0) return null;

  return {
    requirements,
    candidate_evidence: candidateEvidence,
    role_evidence: roleEvidence,
    responsibility_evidence: responsibilityEvidence,
  };
}

/** Acepta únicamente citas literales y requisitos que realmente se solicitaron. */
export function validateSemanticAdjudications(
  request: SemanticAdjudicationRequest,
  response: MatchAdjudicationResponse
): SemanticAdjudication[] {
  const requested = new Set(
    request.requirements.map((item) => key(item.requirement_type, item.requirement_text))
  );
  const seen = new Set<string>();
  const valid: SemanticAdjudication[] = [];

  for (const item of response.adjudications) {
    const itemKey = key(item.requirement_type, item.requirement_text);
    if (!requested.has(itemKey) || seen.has(itemKey)) continue;
    seen.add(itemKey);

    if (item.decision === "unknown") continue;
    if (item.confidence < MIN_CONFIDENCE || item.confidence > 1) continue;

    const quote = normalizeText(item.evidence_quote);
    if (quote.length < 4) continue;
    const allowedEvidence =
      item.requirement_type === "responsibility"
        ? request.responsibility_evidence
        : item.requirement_type === "experience"
          ? request.role_evidence
          : request.candidate_evidence;
    const evidence = allowedEvidence.map((source) => normalizeText(source)).filter(Boolean);
    const quoteExists = evidence.some(
      (source) => source.includes(quote) || (source.length >= 8 && quote.includes(source))
    );
    if (!quoteExists) continue;

    valid.push({
      type: item.requirement_type,
      requirementText: item.requirement_text,
      status: item.decision === "demonstrated" ? "matched" : "partial",
      matchScore: item.decision === "demonstrated" ? 0.95 : 0.65,
      candidateEvidence: item.evidence_quote,
      candidateValue: item.candidate_value || item.evidence_quote,
      confidence: Math.max(0, Math.min(1, item.confidence)),
      reason: item.reason,
    });
  }

  return valid;
}

function collectCandidateEvidence(candidate: CandidateEvidence): string[] {
  const values = [
    ...candidate.skills.flatMap((skill) => [skill.rawName, skill.canonicalName, skill.evidence]),
    ...candidate.experience.flatMap((experience) => [
      experience.title,
      ...experience.responsibilities,
      ...experience.achievements,
      ...experience.skills,
    ]),
    ...candidate.narrative,
    ...candidate.education.flatMap((education) => [education.degree, education.field ?? ""]),
    ...candidate.certifications,
    ...candidate.languages.flatMap((language) => [language.language, language.level ?? ""]),
  ];

  return uniqueEvidence(values);
}

function uniqueEvidence(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const text = value?.trim();
    const normalized = normalizeText(text ?? "");
    if (normalized.length < 2 || unique.has(normalized)) continue;
    unique.set(normalized, text as string);
  }
  return Array.from(unique.values());
}

function key(type: string, requirement: string): string {
  return `${type}:${normalizeText(requirement)}`;
}

function importanceRank(value: RequirementResult["importance"]): number {
  return value === "must_have" ? 3 : value === "required" ? 2 : 1;
}
