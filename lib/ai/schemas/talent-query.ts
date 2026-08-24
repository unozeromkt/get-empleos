import { z } from "zod";

/**
 * TalentQuery — la frase del reclutador convertida en criterios estructurados.
 *
 * Es lo ÚNICO que hace el LLM en el módulo de búsqueda: interpretar la
 * pregunta. Puntuar candidatos lo hace después el motor determinístico
 * (`lib/matching/engine.ts`), igual que en el screening por vacante.
 *
 * Mismas restricciones de Structured Outputs que el resto de schemas:
 * todo obligatorio con `.nullable()`, nunca `.optional()`, sin `.min()`,
 * `.max()`, `.default()` ni refinamientos.
 *
 * Referencia: docs/BUSQUEDA_LENGUAJE_NATURAL.md §4
 */

export const importanceEnum = z.enum(["must_have", "required", "preferred"]);

export const skillCategoryEnum = z.enum([
  "technical",
  "tool",
  "domain",
  "transferable",
  "language",
  "other",
]);

export const talentQuerySchema = z.object({
  /** Rol o cargo que el reclutador busca, si la frase lo nombra. */
  interpreted_role: z
    .string()
    .nullable()
    .describe("Cargo buscado, tal como lo nombra la frase. null si no menciona ninguno."),

  skills: z.array(
    z.object({
      raw_name: z.string().describe("Tal como aparece en la frase del reclutador."),
      canonical_name: z.string().describe("Nombre normalizado de la habilidad."),
      category: skillCategoryEnum,
      importance: importanceEnum.describe(
        "'must_have' solo ante 'indispensable', 'obligatorio', 'excluyente'; " +
          "'preferred' ante 'deseable', 'ojalá', 'plus', 'preferiblemente'; " +
          "'required' en cualquier otro caso."
      ),
    })
  ),

  experience: z.object({
    minimum_years: z
      .number()
      .nullable()
      .describe("Solo si la frase da un número explícito. null si no lo dice."),
    relevant_roles: z.array(z.string()).describe("Cargos previos que la frase pide haber ejercido."),
    industries: z.array(z.string()).describe("Sectores o industrias que la frase menciona."),
  }),

  education: z.array(
    z.object({
      level: z.string().nullable(),
      field: z.string().nullable(),
      importance: importanceEnum,
    })
  ),

  certifications: z.array(
    z.object({
      name: z.string(),
      importance: importanceEnum,
    })
  ),

  languages: z.array(
    z.object({
      language: z.string(),
      minimum_level: z.string().nullable(),
      importance: importanceEnum,
    })
  ),

  /** Filtro de recall, NO criterio puntuable: dónde se busca, no qué se evalúa. */
  location: z.object({
    city: z.string().nullable(),
    work_mode: z.enum(["onsite", "hybrid", "remote", "unspecified"]),
  }),

  /**
   * Criterios que la frase pide pero que NO se pueden usar por ser atributos
   * protegidos (spec §29). Se devuelven para avisar al reclutador de forma
   * explícita, nunca para filtrar. Fuente de verdad de la lista:
   * `lib/matching/excluded-attributes.ts`.
   */
  rejected_criteria: z.array(
    z.object({
      criterion: z.string().describe("El criterio tal como aparece en la frase."),
      reason: z.string().describe("Por qué no puede usarse, en una línea y en español."),
    })
  ),

  /** Criterios legítimos que el sistema todavía no sabe evaluar. */
  unsupported_criteria: z.array(z.string()),

  /** Ambigüedades y supuestos que el reclutador debería revisar. */
  interpretation_notes: z.array(z.string()),

  confidence: z
    .number()
    .describe("0 a 1. Baja si la frase es vaga, ambigua o demasiado corta."),
});

export type TalentQuery = z.infer<typeof talentQuerySchema>;

/** Consulta vacía: base para construir criterios a mano desde la UI. */
export const EMPTY_TALENT_QUERY: TalentQuery = {
  interpreted_role: null,
  skills: [],
  experience: { minimum_years: null, relevant_roles: [], industries: [] },
  education: [],
  certifications: [],
  languages: [],
  location: { city: null, work_mode: "unspecified" },
  rejected_criteria: [],
  unsupported_criteria: [],
  interpretation_notes: [],
  confidence: 1,
};

/** true si la consulta no aporta ningún criterio evaluable. */
export function isEmptyQuery(query: TalentQuery): boolean {
  return (
    query.skills.length === 0 &&
    query.education.length === 0 &&
    query.certifications.length === 0 &&
    query.languages.length === 0 &&
    query.experience.relevant_roles.length === 0 &&
    query.experience.industries.length === 0 &&
    query.experience.minimum_years === null &&
    !query.interpreted_role
  );
}
