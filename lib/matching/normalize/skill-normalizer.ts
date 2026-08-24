import type { MatchType } from "@/lib/matching/types";

/**
 * Normalización y emparejamiento de habilidades — spec §9.
 *
 * Cascada de resolución (§9.2), niveles 1 a 3 en esta versión:
 *   1. Coincidencia exacta canónica
 *   2. Alias / sinónimo
 *   3. Taxonomía  ← Fase 5 (ESCO)
 *   4. Similitud semántica por embeddings  ← Fase 5
 *   5. Adjudicación por LLM  ← solo si hace falta, Fase 5
 *   6. Sin resolver
 *
 * En V1 no hay embeddings. El emparejamiento parcial se hace por solapamiento
 * de tokens, con un umbral CONFIGURABLE y explícitamente SIN CALIBRAR: la spec
 * §14 advierte de no asumir que una similitud numérica equivale a compatibilidad
 * real. Se calibra en la Fase 6 con dataset propio.
 */

/** Umbral de solapamiento para considerar una coincidencia parcial. SIN CALIBRAR. */
export const PARTIAL_MATCH_THRESHOLD = 0.5;

/**
 * Alias conocidos. Semilla mínima hasta que entre ESCO en la Fase 5.
 * Cada entrada mapea variantes → nombre canónico.
 */
const ALIASES: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "java script"],
  typescript: ["ts"],
  "microsoft excel": ["excel", "excel avanzado", "hoja de calculo", "hojas de calculo", "ms excel"],
  "microsoft word": ["word", "ms word"],
  "power bi": ["powerbi", "microsoft power bi"],
  sap: ["sap erp", "sap r/3"],
  "recursos humanos": ["rrhh", "rh", "gestion humana", "talento humano"],
  ingles: ["english", "idioma ingles"],
  espanol: ["spanish", "castellano", "idioma espanol"],
  logistica: ["logistics", "cadena de suministro", "supply chain"],
  "servicio al cliente": ["atencion al cliente", "customer service", "servicio cliente"],
  contabilidad: ["accounting", "contable"],
  "gestion de inventarios": ["inventarios", "control de inventario", "manejo de inventario"],
  liderazgo: ["leadership", "liderazgo de equipos", "manejo de personal"],
  "trabajo en equipo": ["teamwork", "colaboracion"],
  sql: ["structured query language"],
  python: [],
  react: ["react.js", "reactjs"],
};

/** Índice inverso alias → canónico, construido una sola vez. */
const ALIAS_INDEX: Map<string, string> = (() => {
  const index = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(ALIASES)) {
    index.set(canonical, canonical);
    for (const variant of variants) index.set(variant, canonical);
  }
  return index;
})();

/** Palabras sin valor discriminante al comparar habilidades. */
const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "en", "y", "con", "para", "a", "al",
  "un", "una", "of", "the", "and", "in", "for", "with", "avanzado", "basico",
  "intermedio", "nivel", "conocimiento", "conocimientos", "manejo", "uso",
]);

/**
 * Normaliza un texto para comparar: minúsculas, sin acentos, sin puntuación.
 * Sin esto, "Logística" y "logistica" serían habilidades distintas.
 */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    // Marcas diacríticas combinantes, con escapes explícitos: escribirlas
    // literalmente deja el fuente ilegible e imposible de revisar en un diff
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resuelve un nombre a su forma canónica conocida, si existe un alias. */
export function toCanonical(raw: string): string {
  const normalized = normalizeText(raw);
  return ALIAS_INDEX.get(normalized) ?? normalized;
}

function tokenize(raw: string): string[] {
  return normalizeText(raw)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Solapamiento de tokens (índice de Jaccard asimétrico): qué proporción de los
 * tokens del requisito aparece en la habilidad del candidato.
 *
 * Asimétrico a propósito: "Excel" contra "Excel avanzado con tablas dinámicas"
 * debe puntuar alto, porque el requisito está totalmente cubierto aunque el
 * candidato describa más cosas.
 */
export function tokenOverlap(requirement: string, candidate: string): number {
  const reqTokens = tokenize(requirement);
  const candTokens = new Set(tokenize(candidate));

  if (reqTokens.length === 0) return 0;

  const hits = reqTokens.filter((t) => candTokens.has(t)).length;
  return hits / reqTokens.length;
}

export interface SkillMatch {
  matchType: MatchType;
  /** 0..1 */
  score: number;
  candidateIndex: number;
}

/**
 * Empareja un requisito con la mejor habilidad del candidato.
 *
 * Devuelve `not_found` si nada supera el umbral. Quien llama decide si eso es
 * una carencia real o simplemente ausencia de evidencia (spec §8).
 */
export function matchSkill(
  requirement: string,
  candidateSkills: Array<{ rawName: string; canonicalName: string }>,
  /**
   * Nombre normalizado del requisito, tal como lo devolvió el extractor.
   *
   * Importa mucho: la IA convierte "Manejo intermedio de Excel o Google Sheets"
   * en canonical_name "Excel". Comparar solo contra la frase larga hace
   * imposible cualquier coincidencia — se estaría tirando a la basura la
   * normalización que ya hizo el extractor.
   */
  requirementCanonical?: string
): SkillMatch {
  // Se prueban ambas formas del requisito: la literal y la normalizada
  const reqVariants = Array.from(
    new Set([requirement, requirementCanonical].filter((v): v is string => !!v?.trim()))
  );

  let best: SkillMatch = { matchType: "not_found", score: 0, candidateIndex: -1 };

  candidateSkills.forEach((skill, index) => {
    // Y ambas formas de la habilidad del candidato
    const candVariants = Array.from(
      new Set([skill.rawName, skill.canonicalName].filter((v) => !!v?.trim()))
    );

    for (const reqText of reqVariants) {
      const reqNormalized = normalizeText(reqText);
      const reqCanonical = toCanonical(reqText);

      for (const candText of candVariants) {
        const candNormalized = normalizeText(candText);
        const candCanonical = toCanonical(candText);

        // 1. Coincidencia exacta
        if (reqNormalized && reqNormalized === candNormalized) {
          best = { matchType: "exact", score: 1, candidateIndex: index };
          return;
        }

        // 2. Mismo canónico vía alias
        if (best.matchType !== "exact" && reqCanonical && reqCanonical === candCanonical) {
          best = { matchType: "canonical_alias", score: 1, candidateIndex: index };
          return;
        }

        // 3. Solapamiento parcial de tokens
        if (best.score < 1) {
          const overlap = tokenOverlap(reqText, candText);
          if (overlap >= PARTIAL_MATCH_THRESHOLD && overlap > best.score) {
            best = {
              matchType: overlap >= 0.99 ? "exact" : "partial",
              score: overlap,
              candidateIndex: index,
            };
          }
        }
      }
    }
  });

  return best;
}

/**
 * Similitud entre dos textos libres (responsabilidades, cargos).
 * En V1 es solapamiento de tokens; en la Fase 5 pasará a embeddings (§16).
 */
export function textSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = new Set(tokenize(b));

  if (aTokens.length === 0) return 0;

  const hits = aTokens.filter((t) => bTokens.has(t)).length;
  return hits / aTokens.length;
}
