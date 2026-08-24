/**
 * Tipos del motor de matching — spec §10, §11, §14.
 *
 * Este módulo es PURO: no importa Supabase, ni red, ni `lib/ai/`. Recibe dos
 * perfiles y una configuración, y devuelve un resultado. Esa restricción es lo
 * que permite testearlo de forma exhaustiva y lo que garantiza que un CV con
 * instrucciones maliciosas no pueda alterar la puntuación de nadie: el LLM
 * nunca participa en el cálculo.
 */

export const SCORING_VERSION = "v1";

/** Las 6 categorías ponderadas de la spec §12.1. */
export type ScoreCategory =
  | "technical_skills"
  | "experience"
  | "education_certifications"
  | "transferable_skills"
  | "languages"
  | "preferred_skills";

export type ScoringWeights = Record<ScoreCategory, number>;

export interface ExperienceWeights {
  relevant_years_fit: number;
  role_similarity: number;
  responsibility_coverage: number;
  required_domain_experience: number;
}

export interface ScoringConfiguration {
  version: string;
  weights: ScoringWeights;
  bands: { high: number; potential: number };
  experience_weights: ExperienceWeights;
  minimum_profile_confidence: number;
}

/** Banda visual del resultado (spec §12.3). */
export type Band = "high" | "potential" | "low" | "insufficient_data";

/**
 * Estado de un requisito frente al candidato.
 *
 * `unknown` NO es `not_found` (spec §8): que el CV no mencione algo no
 * demuestra que la persona no lo sepa hacer. Se distinguen para no penalizar
 * la ausencia de evidencia igual que una carencia demostrada.
 */
export type RequirementStatus = "matched" | "partial" | "unknown" | "not_found";

/** Cómo se resolvió la correspondencia (spec §14). */
export type MatchType =
  | "exact"
  | "canonical_alias"
  | "taxonomy_related"
  | "semantic"
  | "partial"
  | "unknown"
  | "not_found";

export type RequirementType =
  | "skill"
  | "experience"
  | "education"
  | "language"
  | "certification"
  | "responsibility";

export type Importance = "must_have" | "required" | "preferred";

export interface RequirementResult {
  type: RequirementType;
  requirementText: string;
  importance: Importance;
  status: RequirementStatus;
  matchType: MatchType;
  /** 0..1 — cuánto cubre el candidato este requisito concreto. */
  matchScore: number;
  /** Fragmento del CV que lo sustenta. Vacío si no hay evidencia. */
  candidateEvidence: string;
  /** Con qué habilidad del candidato se emparejó. */
  candidateValue: string | null;
  confidence: number;
}

export interface CategoryOutcome {
  /** 0..100. null si la oferta no exige nada en esta categoría. */
  score: number | null;
  requirements: RequirementResult[];
}

export interface CriticalGap {
  requirementText: string;
  reason: string;
}

export interface MatchExplanation {
  summary: string;
  strengths: string[];
  gaps: string[];
  questionsForRecruiter: string[];
}

export interface MatchResult {
  overallScore: number;
  band: Band;
  /** Independiente del score (spec §20): un 88 con 40% de confianza es posible. */
  scoreConfidence: number;
  categoryScores: Record<ScoreCategory, number | null>;
  requirements: RequirementResult[];
  criticalGaps: CriticalGap[];
  explanation: MatchExplanation;
  scoringVersion: string;
  /** Pesos realmente aplicados tras la renormalización (spec §12.2). */
  appliedWeights: Partial<ScoringWeights>;
}

// ─── Entradas normalizadas del motor ─────────────────────────────────────────

/**
 * El motor no consume los perfiles canónicos directamente: consume esta forma
 * reducida. Así el scoring queda aislado de los cambios de schema de la IA, y
 * los tests pueden construir casos sin fabricar un CanonicalProfile entero.
 */

export interface JobSkillRequirement {
  rawName: string;
  canonicalName: string;
  category: "technical" | "tool" | "domain" | "transferable" | "language" | "other";
  importance: Importance;
  minimumYears: number | null;
}

export interface JobRequirements {
  title: string;
  skills: JobSkillRequirement[];
  responsibilities: string[];
  experience: {
    minimumYears: number | null;
    relevantRoles: string[];
    industries: string[];
  };
  education: Array<{ level: string | null; field: string | null; importance: Importance }>;
  certifications: Array<{ name: string; importance: Importance }>;
  languages: Array<{ language: string; minimumLevel: string | null; importance: Importance }>;
  knockouts: string[];
}

export interface CandidateSkillEvidence {
  rawName: string;
  canonicalName: string;
  category: "technical" | "tool" | "domain" | "transferable" | "language" | "other";
  yearsEstimate: number | null;
  evidence: string;
  confidence: number;
}

export interface CandidateEvidence {
  skills: CandidateSkillEvidence[];
  transferableSkills: Array<{ name: string; evidence: string; confidence: number }>;
  experience: Array<{
    title: string;
    company: string;
    responsibilities: string[];
    achievements: string[];
    skills: string[];
  }>;
  totalYearsExperience: number | null;
  education: Array<{ degree: string; field: string | null; level: string | null }>;
  certifications: string[];
  languages: Array<{ language: string; level: string | null }>;
  /**
   * Texto descriptivo del perfil: titular, resumen profesional y proyectos.
   *
   * Muchos CV concentran ahí su especialidad ("8 años en marketing digital")
   * sin repetirla en la lista de habilidades. Ignorar este texto hacía que el
   * motor no viera competencias declaradas de forma explícita.
   */
  narrative: string[];
  /** Confianza global de la extracción del CV. Alimenta scoreConfidence. */
  extractionConfidence: number;
  /** true si el perfil tiene tan poco contenido que puntuarlo sería engañoso. */
  isSparse: boolean;
}
