import { z } from "zod";

export const jobSchema = z.object({
  title: z
    .string()
    .min(5, "El título debe tener al menos 5 caracteres")
    .max(100, "El título no puede superar 100 caracteres"),

  area_id: z.coerce
    .number()
    .int()
    .positive("Selecciona un área válida"),

  modality: z.enum(["presencial", "remoto", "hibrido"]),

  contract_type: z.enum([
    "tiempo_completo",
    "tiempo_parcial",
    "temporal",
    "por_obra",
  ]),

  city: z.string().min(2, "Ingresa la ciudad"),

  department: z.string().optional(),

  vacancies: z.coerce
    .number()
    .int()
    .min(1, "Debe haber al menos 1 vacante")
    .max(999),

  salary_min: z.coerce.number().positive().optional().nullable(),
  salary_max: z.coerce.number().positive().optional().nullable(),
  salary_visible: z.coerce.boolean().default(true),

  description: z
    .string()
    .min(10, "La descripción debe tener al menos 10 caracteres"),

  requirements: z.string().optional(),
  benefits:     z.string().optional(),

  featured: z.coerce.boolean().default(false),

  status: z
    .enum(["draft", "active", "paused", "closed"])
    .default("active"),

  expires_at: z.string().optional().nullable(),
});

export type JobFormData = z.infer<typeof jobSchema>;
