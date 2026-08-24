import { describe, expect, it } from "vitest";

import type { RequirementResult } from "@/lib/matching/types";
import { buildSnippet, suggestRelaxations } from "@/lib/search/talent-search";

function requirement(overrides: Partial<RequirementResult> = {}): RequirementResult {
  return {
    type: "skill",
    requirementText: "Excel",
    importance: "required",
    status: "not_found",
    matchType: "not_found",
    matchScore: 0,
    candidateEvidence: "",
    candidateValue: null,
    confidence: 0,
    ...overrides,
  };
}

describe("suggestRelaxations", () => {
  it("cuenta solo a quien falla exactamente un requisito obligatorio", () => {
    const suggestions = suggestRelaxations([
      // Falla solo Excel → quitarlo lo desbloquea
      [requirement(), requirement({ requirementText: "Ventas", status: "matched" })],
      [requirement(), requirement({ requirementText: "Ventas", status: "matched" })],
      // Falla dos: quitar Excel no le sirve de nada
      [requirement(), requirement({ requirementText: "Ventas" })],
    ]);

    expect(suggestions).toEqual([{ requirementText: "Excel", unlocked: 2 }]);
  });

  it("ignora los requisitos deseables", () => {
    // Un 'preferred' no bloquea a nadie, así que quitarlo no desbloquea nada
    const suggestions = suggestRelaxations([[requirement({ importance: "preferred" })]]);
    expect(suggestions).toEqual([]);
  });

  it("no sugiere quitar algo por un 'unknown'", () => {
    // 'unknown' no es 'not_found' (spec §8): no hay carencia que relajar
    const suggestions = suggestRelaxations([[requirement({ status: "unknown" })]]);
    expect(suggestions).toEqual([]);
  });

  it("ordena por impacto y devuelve como mucho tres", () => {
    const sets = [
      ...Array(3).fill([requirement({ requirementText: "SAP" })]),
      ...Array(5).fill([requirement({ requirementText: "Excel" })]),
      ...Array(1).fill([requirement({ requirementText: "Inglés" })]),
      ...Array(2).fill([requirement({ requirementText: "Power BI" })]),
    ];

    const suggestions = suggestRelaxations(sets);

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.requirementText)).toEqual(["Excel", "SAP", "Power BI"]);
  });
});

describe("buildSnippet", () => {
  it("recorta alrededor del término encontrado", () => {
    const text = `${"a ".repeat(200)}experiencia en logistica${" b".repeat(200)}`;
    const snippet = buildSnippet(text, ["logistica"]);

    expect(snippet).toContain("logistica");
    expect(snippet.length).toBeLessThan(300);
    expect(snippet.startsWith("…")).toBe(true);
  });

  it("encuentra el término aunque el CV lo escriba con tilde", () => {
    const snippet = buildSnippet("Amplia experiencia en logística de bodega", ["logistica"]);
    expect(snippet).toContain("logística");
  });

  it("devuelve el principio del texto si ningún término aparece", () => {
    const snippet = buildSnippet("Perfil profesional sin coincidencias", ["excel"]);
    expect(snippet).toContain("Perfil profesional");
  });
});
