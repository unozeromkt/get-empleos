import { z } from "zod";

export const companySchema = z.object({
  name:        z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  city:        z.string().optional(),
  industry:    z.string().optional(),
  website:     z.string().url("URL inválida").optional().or(z.literal("")),
  description: z.string().max(1000).optional(),
});

export type CompanyInput = z.infer<typeof companySchema>;
