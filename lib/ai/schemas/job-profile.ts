import { z } from "zod";

/**
 * CanonicalJobProfile — spec §6.
 *
 * IMPORTANTE — restricciones de OpenAI Structured Outputs en modo strict:
 *   - Todos los campos deben ser obligatorios → usar `.nullable()`, NUNCA `.optional()`
 *   - Sin `.default()`, sin `.min()`, `.max()`, `.email()` ni refinamientos
 *   - Sin uniones de objetos
 *
 * Esa limitación encaja con la regla crítica de la spec §6: si el documento no
 * aporta un dato, el modelo devuelve `null` / `[]` / `"unspecified"`. Nunca lo
 * inventa ni lo completa con lo que "normalmente" pide ese cargo.
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

const evidence = z
  .string()
  .describe(
    "Fragmento textual literal del documento que sustenta este dato. Cadena vacía si no lo hay."
  );

export const jobProfileSchema = z.object({
  title: z.string().describe("Título del cargo tal como aparece en el documento."),
  summary: z.string().nullable().describe("Resumen breve del rol. null si el documento no lo trae."),
  department: z.string().nullable(),

  employment_type: z
    .enum([
      "full_time",
      "part_time",
      "temporary",
      "contract",
      "internship",
      "unspecified",
    ])
    .describe("'unspecified' si el documento no lo indica."),

  seniority: z
    .enum(["intern", "junior", "mid", "senior", "lead", "manager", "director", "unspecified"])
    .describe("Solo si el documento lo indica explícitamente; si no, 'unspecified'."),

  location: z.object({
    work_mode: z.enum(["onsite", "hybrid", "remote", "unspecified"]),
    city: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string().nullable(),
  }),

  responsibilities: z.array(
    z.object({
      text: z.string(),
      importance: z.enum(["high", "medium", "low"]),
      evidence,
    })
  ),

  required_skills: z.array(
    z.object({
      raw_name: z.string().describe("La habilidad tal como aparece literalmente en el documento."),
      canonical_name: z.string().describe("Nombre normalizado de la habilidad."),
      category: skillCategoryEnum,
      importance: importanceEnum.describe(
        "Clasificar SOLO según el lenguaje del documento: 'must_have'/'required' ante palabras como indispensable, obligatorio, requerido; 'preferred' ante deseable, plus, valorable."
      ),
      proficiency: z.string().nullable(),
      minimum_years: z.number().nullable(),
      evidence,
    })
  ),

  experience_requirements: z.object({
    minimum_years: z.number().nullable(),
    preferred_years: z.number().nullable(),
    relevant_roles: z.array(z.string()),
    industries: z.array(z.string()),
  }),

  education_requirements: z.array(
    z.object({
      level: z.string().nullable(),
      field: z.string().nullable(),
      importance: importanceEnum,
      evidence,
    })
  ),

  certifications: z.array(
    z.object({
      name: z.string(),
      importance: importanceEnum,
      evidence,
    })
  ),

  languages: z.array(
    z.object({
      language: z.string(),
      minimum_level: z.string().nullable(),
      importance: importanceEnum,
      evidence,
    })
  ),

  knockout_requirements: z
    .array(z.string())
    .describe(
      "Requisitos excluyentes declarados de forma explícita y objetiva en el documento. Vacío si no hay ninguno."
    ),

  salary: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string().nullable(),
    period: z.enum(["hour", "day", "week", "month", "year", "unspecified"]),
  }),

  benefits: z.array(z.string()),

  application_questions: z.array(z.string()),

  extraction_metadata: z.object({
    source: z.enum(["manual", "pdf", "docx"]),
    confidence: z
      .number()
      .describe("Confianza global de la extracción, de 0 a 1. Baja si el documento es pobre o ambiguo."),
    warnings: z
      .array(z.string())
      .describe("Ambigüedades o datos faltantes relevantes que el revisor humano debería mirar."),
  }),
});

export type JobProfile = z.infer<typeof jobProfileSchema>;

/** Campos mínimos para poder crear la oferta a partir del perfil extraído. */
export const REQUIRED_FOR_PUBLISH = ["title", "location.city"] as const;

/**
 * Datos faltantes que el revisor debe completar antes de publicar.
 * Se muestran en la pantalla Review & Confirm (spec §5.3).
 */
export function missingFieldsForPublish(profile: JobProfile): string[] {
  const missing: string[] = [];
  if (!profile.title.trim()) missing.push("Título del cargo");
  if (!profile.location.city) missing.push("Ciudad");
  if (profile.required_skills.length === 0) missing.push("Habilidades requeridas");
  if (profile.responsibilities.length === 0) missing.push("Responsabilidades");
  return missing;
}
