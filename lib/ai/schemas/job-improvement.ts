import { z } from "zod";

import { jobProfileSchema } from "@/lib/ai/schemas/job-profile";

export const jobImprovementSchema = z.object({
  quality_score: z.number().describe("Calidad de la oferta entre 0 y 100."),
  summary: z.string(),
  issues: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      field: z.string(),
      title: z.string(),
      message: z.string(),
      question: z.string(),
    })
  ),
  changes: z.array(
    z.object({
      field: z.string(),
      before: z.string(),
      after: z.string(),
      reason: z.string(),
    })
  ),
  proposed_profile: jobProfileSchema,
});

export type JobImprovement = z.infer<typeof jobImprovementSchema>;
