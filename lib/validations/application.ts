import { z } from "zod";

export const applicationSchema = z.object({
  job_id: z.string().uuid("ID de oferta inválido"),

  cover_letter: z
    .string()
    .max(1000, "La carta de presentación no puede superar 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export const applicationStatusSchema = z.object({
  application_id: z.string().uuid(),
  status: z.enum(["pending", "reviewing", "shortlisted", "rejected", "hired"]),
  admin_notes: z.string().max(2000).optional().or(z.literal("")),
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;
export type ApplicationStatusData = z.infer<typeof applicationStatusSchema>;
