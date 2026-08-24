import { describe, expect, it } from "vitest";

import { EMPTY_TALENT_QUERY, type TalentQuery } from "@/lib/ai/schemas/talent-query";
import { calculateMatch } from "@/lib/matching/engine";
import type { CandidateEvidence } from "@/lib/matching/types";
import {
  queryToChips,
  queryToRecallParams,
  queryToRequirements,
  removeChip,
} from "@/lib/search/query-adapter";

function query(overrides: Partial<TalentQuery> = {}): TalentQuery {
  return { ...EMPTY_TALENT_QUERY, ...overrides };
}

const SALES_QUERY = query({
  interpreted_role: "Asesor comercial",
  skills: [
    { raw_name: "Ventas", canonical_name: "ventas", category: "domain", importance: "required" },
    {
      raw_name: "Excel",
      canonical_name: "microsoft excel",
      category: "tool",
      importance: "preferred",
    },
  ],
  experience: { minimum_years: 3, relevant_roles: ["vendedor"], industries: ["retail"] },
  location: { city: "Medellín", work_mode: "unspecified" },
});

describe("queryToRequirements", () => {
  it("nunca genera requisitos excluyentes", () => {
    // Un knockout descarta de forma tajante. Eso solo puede nacer de una oferta
    // revisada por una persona, jamás de una frase escrita en una caja de texto.
    expect(queryToRequirements(SALES_QUERY).knockouts).toEqual([]);
  });

  it("deja el título vacío cuando la frase no nombra un cargo", () => {
    // Con un título de relleno, el motor compararía todos los cargos del CV
    // contra un texto inventado y produciría un requisito falso.
    expect(queryToRequirements(query({ skills: SALES_QUERY.skills })).title).toBe("");
  });

  it("no ata años a cada habilidad por separado", () => {
    const requirements = queryToRequirements(SALES_QUERY);
    expect(requirements.skills.every((s) => s.minimumYears === null)).toBe(true);
    expect(requirements.experience.minimumYears).toBe(3);
  });

  it("no inventa responsabilidades del puesto", () => {
    expect(queryToRequirements(SALES_QUERY).responsibilities).toEqual([]);
  });

  it("conserva la importancia de cada criterio", () => {
    const requirements = queryToRequirements(SALES_QUERY);
    expect(requirements.skills.map((s) => s.importance)).toEqual(["required", "preferred"]);
  });
});

describe("queryToRecallParams", () => {
  it("normaliza, deduplica y descarta términos demasiado cortos", () => {
    const params = queryToRecallParams(
      query({
        skills: [
          { raw_name: "Excel", canonical_name: "excel", category: "tool", importance: "required" },
          { raw_name: "SQ", canonical_name: "sq", category: "technical", importance: "required" },
        ],
        experience: { minimum_years: null, relevant_roles: ["Vendedor"], industries: [] },
      })
    );

    expect(params.terms).toContain("excel");
    expect(params.terms).toContain("vendedor");
    expect(params.terms).not.toContain("sq"); // menos de 3 caracteres
    expect(new Set(params.terms).size).toBe(params.terms.length);
  });

  it("quita las tildes igual que search_normalize en SQL", () => {
    const params = queryToRecallParams(query({ interpreted_role: "Técnico Logístico" }));
    expect(params.terms).toContain("tecnico logistico");
  });

  it("separa ciudad y años del resto de criterios", () => {
    const params = queryToRecallParams(SALES_QUERY);
    expect(params.city).toBe("Medellín");
    expect(params.minYears).toBe(3);
  });
});

describe("chips", () => {
  it("produce un chip por criterio evaluable", () => {
    const labels = queryToChips(SALES_QUERY).map((c) => c.label);
    expect(labels).toContain("Ventas");
    expect(labels).toContain("Excel");
    expect(labels).toContain("≥3 años");
    expect(labels).toContain("Medellín");
  });

  it("quitar un chip devuelve una consulta nueva sin mutar la original", () => {
    const chips = queryToChips(SALES_QUERY);
    const excel = chips.find((c) => c.label === "Excel");
    const next = removeChip(SALES_QUERY, excel!.id);

    expect(next.skills.map((s) => s.raw_name)).toEqual(["Ventas"]);
    expect(SALES_QUERY.skills).toHaveLength(2);
  });

  it("quitar los años borra solo el mínimo de experiencia", () => {
    const next = removeChip(SALES_QUERY, "experience:years");
    expect(next.experience.minimum_years).toBeNull();
    expect(next.experience.relevant_roles).toEqual(["vendedor"]);
  });
});

describe("integración con el motor de matching", () => {
  const candidate: CandidateEvidence = {
    skills: [
      {
        rawName: "Ventas",
        canonicalName: "ventas",
        category: "domain",
        yearsEstimate: null,
        evidence: "Atención y venta directa en piso",
        confidence: 0.9,
      },
    ],
    transferableSkills: [],
    experience: [
      {
        title: "Asesor comercial",
        company: "Almacén",
        responsibilities: ["Venta en piso"],
        achievements: [],
        skills: ["ventas"],
      },
    ],
    totalYearsExperience: 5,
    education: [],
    certifications: [],
    languages: [],
    narrative: [],
    extractionConfidence: 0.8,
    isSparse: false,
  };

  it("puntúa una consulta como si fuera una vacante", () => {
    const result = calculateMatch(queryToRequirements(SALES_QUERY), candidate);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.requirements.some((r) => r.requirementText === "Ventas")).toBe(true);
  });

  it("es determinística: la misma consulta produce el mismo score", () => {
    const requirements = queryToRequirements(SALES_QUERY);
    const a = calculateMatch(requirements, candidate);
    const b = calculateMatch(requirements, candidate);
    expect(a.overallScore).toBe(b.overallScore);
  });

  it("un Excel ausente no se marca como carencia demostrada", () => {
    // spec §8: que el CV no lo mencione no demuestra que la persona no lo sepa
    const result = calculateMatch(queryToRequirements(SALES_QUERY), candidate);
    const excel = result.requirements.find((r) => r.requirementText === "Excel");

    expect(excel?.status).not.toBe("matched");
    expect(["unknown", "not_found"]).toContain(excel?.status);
  });
});
