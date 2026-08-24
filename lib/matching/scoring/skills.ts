import { IMPORTANCE_WEIGHT } from "@/lib/matching/config";
import { matchSkill, tokenOverlap } from "@/lib/matching/normalize/skill-normalizer";
import type {
  CandidateEvidence,
  CategoryOutcome,
  JobSkillRequirement,
  RequirementResult,
} from "@/lib/matching/types";

/** Umbral para aceptar evidencia hallada en la experiencia laboral. */
const EXPERIENCE_EVIDENCE_THRESHOLD = 0.5;

/**
 * Una habilidad demostrada en un puesto concreto vale menos que una declarada
 * explícitamente: es evidencia real, pero indirecta. Se marca como parcial.
 */
const EXPERIENCE_EVIDENCE_SCORE = 0.7;

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
  const experienceEvidence = buildExperienceEvidence(candidate);

  const results: RequirementResult[] = requirements.map((req) =>
    evaluateSkill(req, candidate, experienceEvidence)
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

interface ExperienceEvidenceItem {
  text: string;
  context: string;
}

/** Aplana cargos, responsabilidades, logros, skills por puesto y narrativa. */
function buildExperienceEvidence(candidate: CandidateEvidence): ExperienceEvidenceItem[] {
  const items: ExperienceEvidenceItem[] = [];

  for (const job of candidate.experience) {
    const context = `${job.title}${job.company ? ` en ${job.company}` : ""}`;

    if (job.title) items.push({ text: job.title, context });
    for (const responsibility of job.responsibilities) items.push({ text: responsibility, context });
    for (const achievement of job.achievements) items.push({ text: achievement, context });
    for (const skill of job.skills) items.push({ text: skill, context });
  }

  // Resumen profesional, titular, proyectos y formación. El texto largo se
  // trocea en frases: comparar un requisito contra un párrafo entero diluye
  // el solapamiento de tokens hasta hacerlo inservible.
  for (const text of candidate.narrative) {
    for (const sentence of splitSentences(text)) {
      items.push({ text: sentence, context: "perfil profesional" });
    }
  }

  return items;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function evaluateSkill(
  req: JobSkillRequirement,
  candidate: CandidateEvidence,
  experienceEvidence: ExperienceEvidenceItem[]
): RequirementResult {
  const match = matchSkill(req.rawName, candidate.skills, req.canonicalName);
  const matched = match.candidateIndex >= 0 ? candidate.skills[match.candidateIndex] : null;

  if (!matched) {
    // Segunda pasada: buscar la habilidad en la experiencia laboral antes de
    // darla por ausente
    const fromExperience = findInExperience(req, experienceEvidence);

    if (fromExperience) {
      return {
        type: "skill",
        requirementText: req.rawName,
        importance: req.importance,
        status: "partial",
        matchType: "partial",
        matchScore: EXPERIENCE_EVIDENCE_SCORE,
        candidateEvidence: `${fromExperience.text} (${fromExperience.context})`,
        candidateValue: fromExperience.text,
        confidence: candidate.extractionConfidence,
      };
    }

    // Sin nada en la lista de habilidades NI en la experiencia: solo se puede
    // afirmar que falta si el CV aportó algo con qué comparar (spec §8)
    const noDataAtAll = candidate.skills.length === 0 && experienceEvidence.length === 0;

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

/** Busca el requisito en el texto libre de la experiencia laboral. */
function findInExperience(
  req: JobSkillRequirement,
  evidence: ExperienceEvidenceItem[]
): ExperienceEvidenceItem | null {
  // Igual que en matchSkill: se prueban la forma literal y la normalizada
  const variants = Array.from(
    new Set([req.canonicalName, req.rawName].filter((v) => !!v?.trim()))
  );

  let best: { item: ExperienceEvidenceItem; score: number } | null = null;

  for (const item of evidence) {
    for (const variant of variants) {
      const overlap = tokenOverlap(variant, item.text);
      if (overlap >= EXPERIENCE_EVIDENCE_THRESHOLD && (!best || overlap > best.score)) {
        best = { item, score: overlap };
      }
    }
  }

  return best?.item ?? null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
