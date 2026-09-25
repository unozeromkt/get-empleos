import { z } from "zod";

export const matchAdjudicationResponseSchema = z.object({
  adjudications: z.array(
    z.object({
      requirement_type: z.enum(["skill", "experience", "responsibility"]),
      requirement_text: z.string(),
      decision: z.enum(["demonstrated", "partial", "unknown"]),
      evidence_quote: z.string(),
      candidate_value: z.string(),
      confidence: z.number(),
      reason: z.string(),
    })
  ),
});

export type MatchAdjudicationResponse = z.infer<typeof matchAdjudicationResponseSchema>;
