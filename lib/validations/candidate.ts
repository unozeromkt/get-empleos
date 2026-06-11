import { z } from "zod";

export const candidateProfileSchema = z.object({
  // Datos de profiles
  full_name: z
    .string()
    .min(3, "Ingresa tu nombre completo")
    .max(100),

  phone: z.string().optional(),

  city: z.string().optional(),

  // Datos de candidates
  birth_date: z.string().optional().nullable(),

  gender: z
    .enum(["masculino", "femenino", "otro", "prefiero_no_decir"])
    .optional()
    .nullable(),

  education_level: z
    .enum([
      "bachiller",
      "tecnico",
      "tecnologo",
      "profesional",
      "especialista",
      "maestria",
      "doctorado",
    ])
    .optional()
    .nullable(),

  career: z.string().max(100).optional(),

  years_experience: z.coerce
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .nullable(),

  skills:    z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),

  linkedin_url: z.string().optional(),

  availability: z
    .enum(["inmediata", "15_dias", "30_dias"])
    .optional()
    .nullable(),

  expected_salary: z.coerce.number().positive().optional().nullable(),

  summary: z
    .string()
    .max(500, "El resumen no puede superar 500 caracteres")
    .optional(),
});

export type CandidateProfileFormData = z.infer<typeof candidateProfileSchema>;
