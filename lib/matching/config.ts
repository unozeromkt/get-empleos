import type { Band, ScoringConfiguration } from "@/lib/matching/types";
import { SCORING_VERSION } from "@/lib/matching/types";

/**
 * Configuración de scoring por defecto — spec §12.1 y §18.
 *
 * ⚠️ SIN CALIBRAR. Estos pesos son el punto de partida que propone la spec, no
 * un modelo validado con datos reales. Presentar el score como confiable antes
 * de la Fase 6 (dataset de evaluación, Precision@K, revisión de falsos
 * negativos) sería darle apariencia de rigor a un número inventado.
 *
 * Los valores en base de datos (`scoring_configurations`) mandan sobre estos:
 * esto es solo el fallback si no hay ninguna configuración activa.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfiguration = {
  version: SCORING_VERSION,
  weights: {
    technical_skills: 35,
    experience: 30,
    education_certifications: 10,
    transferable_skills: 10,
    languages: 5,
    preferred_skills: 10,
  },
  bands: { high: 80, potential: 60 },
  experience_weights: {
    relevant_years_fit: 0.35,
    role_similarity: 0.25,
    responsibility_coverage: 0.3,
    required_domain_experience: 0.1,
  },
  minimum_profile_confidence: 0.65,
};

/**
 * Peso relativo de cada requisito dentro de su categoría.
 * Un `must_have` pesa el triple que un `preferred` a la hora de calcular
 * cobertura, pero NO descarta al candidato por sí solo (spec §13).
 */
export const IMPORTANCE_WEIGHT = {
  must_have: 3,
  required: 2,
  preferred: 1,
} as const;

/**
 * Determina la banda visual — spec §12.3.
 *
 * `insufficient_data` (GRAY) no es "mal candidato": es "no tenemos con qué
 * juzgarlo". Confundir ambos sería el error más caro del sistema.
 */
export function resolveBand(
  score: number,
  scoreConfidence: number,
  config: ScoringConfiguration,
  hasSparseProfile: boolean
): Band {
  if (hasSparseProfile || scoreConfidence < config.minimum_profile_confidence) {
    return "insufficient_data";
  }
  if (score >= config.bands.high) return "high";
  if (score >= config.bands.potential) return "potential";
  return "low";
}

export const BAND_LABEL: Record<Band, string> = {
  high: "Alta compatibilidad",
  potential: "Compatibilidad parcial",
  low: "Baja compatibilidad",
  insufficient_data: "Datos insuficientes",
};
