import { z } from "zod";

/**
 * CanonicalCandidateProfile — spec §8.
 *
 * Mismas restricciones de Structured Outputs que el perfil de oferta: todo
 * obligatorio con `.nullable()`, nunca `.optional()`.
 *
 * DISTINCIÓN CRÍTICA (spec §8): "no se encontró evidencia" NO es lo mismo que
 * "el candidato no tiene esa habilidad". Que algo no aparezca en el CV no
 * demuestra que la persona no lo sepa hacer. Por eso cada habilidad lleva su
 * evidencia y su confianza, y el motor de matching distingue `unknown` de
 * `not_found` en lugar de penalizar por igual.
 */

export const skillCategoryEnum = z.enum([
  "technical",
  "tool",
  "domain",
  "transferable",
  "language",
  "other",
]);

/** De dónde sale un dato. Ordenado por confiabilidad (spec §17). */
export const evidenceSourceEnum = z.enum([
  "resume",
  "candidate_profile",
  "application_answer",
]);

const evidenceItem = z.object({
  source: evidenceSourceEnum,
  text: z.string().describe("Fragmento literal del CV que sustenta el dato."),
});

export const candidateProfileSchema = z.object({
  /** Datos de contacto: sirven para operar la plataforma, NUNCA para rankear (spec §29). */
  contact: z.object({
    full_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    city: z.string().nullable(),
    linkedin_url: z.string().nullable(),
  }),

  headline: z.string().nullable().describe("Titular profesional, si el CV lo trae."),
  professional_summary: z.string().nullable(),

  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      /** Formato ISO parcial: "2021-03" o "2021". null si el CV no lo dice. */
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      current: z.boolean(),
      responsibilities: z.array(z.string()),
      achievements: z.array(z.string()),
      skills: z.array(z.string()).describe("Habilidades demostradas en este puesto."),
    })
  ),

  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      status: z
        .enum(["completed", "in_progress", "incomplete", "unspecified"])
        .describe("Solo si el CV lo indica; si no, 'unspecified'."),
    })
  ),

  skills: z.array(
    z.object({
      raw_name: z.string().describe("Tal como aparece literalmente en el CV."),
      canonical_name: z.string(),
      category: skillCategoryEnum,
      proficiency: z.string().nullable(),
      years_estimate: z
        .number()
        .nullable()
        .describe("Solo si es deducible de fechas concretas del CV. null si no."),
      last_used: z.string().nullable(),
      evidence: z.array(evidenceItem),
      confidence: z
        .number()
        .describe(
          "0 a 1. Alta si la habilidad está declarada explícitamente o demostrada en un puesto concreto; baja si solo se infiere de una actividad laboral."
        ),
    })
  ),

  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().nullable(),
      date: z.string().nullable(),
      evidence: z.string(),
    })
  ),

  languages: z.array(
    z.object({
      language: z.string(),
      level: z.string().nullable().describe("Solo el nivel que declare el CV. null si no lo dice."),
      evidence: z.string(),
    })
  ),

  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      skills: z.array(z.string()),
    })
  ),

  /**
   * Habilidades transferibles / blandas. Solo con evidencia laboral concreta.
   * PROHIBIDO inferirlas del nombre, la foto, la universidad, la redacción o
   * el estilo del CV (spec §17).
   */
  transferable_skills: z.array(
    z.object({
      name: z.string(),
      evidence: z.array(evidenceItem),
      confidence: z.number(),
    })
  ),

  /** Años totales de experiencia, solo si son calculables de fechas reales. */
  total_years_experience: z.number().nullable(),

  profile_metadata: z.object({
    overall_confidence: z
      .number()
      .describe("0 a 1. Baja si el CV es corto, está mal extraído o es ambiguo."),
    warnings: z.array(z.string()),
  }),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
