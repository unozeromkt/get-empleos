import { describe, expect, it } from "vitest";

import { calculateMatch } from "@/lib/matching/engine";
import { calculateRequirementsScore } from "@/lib/matching/requirement-score";
import { warehouseAssistantCandidate, warehouseAssistantJob } from "./caso-auxiliar-bodega";

describe("calibración — Auxiliar de Bodega con CV escueto", () => {
  const result = calculateMatch(warehouseAssistantJob, warehouseAssistantCandidate);

  it("elige el cargo logístico relacionado, no el primer empate lexical", () => {
    const role = result.requirements.find((r) =>
      r.requirementText.startsWith("Experiencia en cargos similares")
    );

    expect(role?.status).toBe("matched");
    expect(role?.candidateValue).toBe("Auxiliar logístico");
  });

  it("usa la duración explícita del cargo relacionado", () => {
    const years = result.requirements.find((r) =>
      r.requirementText.startsWith("Mínimo 1 años")
    );

    expect(years?.status).toBe("matched");
    expect(years?.candidateEvidence).toContain("5.67 años");
  });

  it("trata funciones no descritas como unknown y no como nueve ceros", () => {
    const responsibilities = result.requirements.filter((r) => r.type === "responsibility");

    expect(responsibilities).toHaveLength(9);
    expect(responsibilities.every((r) => r.status === "unknown")).toBe(true);
    expect(result.categoryScores.experience).toBe(100);
  });

  it("sube a compatibilidad potencial sin inventar habilidades técnicas", () => {
    expect(result.categoryScores.technical_skills).toBe(0);
    expect(result.overallScore).toBe(65);
    expect(result.band).toBe("insufficient_data");
  });

  it("la cobertura visible excluye unknown y pondera indispensables", () => {
    expect(calculateRequirementsScore(result.requirements)).toBe(69);
  });
});
