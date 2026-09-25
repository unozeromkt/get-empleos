import type { Importance, RequirementStatus } from "@/lib/matching/types";

export interface RequirementScoreInput {
  importance: Importance;
  status: RequirementStatus;
  matchScore: number;
}

/**
 * Cobertura de requisitos obligatorios para el listado de candidatos.
 *
 * Es una métrica distinta del match global: solo resume requisitos evaluables,
 * excluye deseables y no convierte `unknown` en cero. Los indispensables pesan
 * más que los requeridos, igual que dentro del motor.
 */
export function calculateRequirementsScore(
  requirements: RequirementScoreInput[]
): number | null {
  let earned = 0;
  let possible = 0;

  for (const requirement of requirements) {
    if (requirement.importance === "preferred" || requirement.status === "unknown") continue;

    const weight = requirement.importance === "must_have" ? 3 : 2;
    possible += weight;
    earned += weight * requirement.matchScore;
  }

  return possible === 0 ? null : Math.round((100 * earned) / possible);
}
