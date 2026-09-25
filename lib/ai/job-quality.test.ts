import { describe, expect, it } from "vitest";

import { analyzeJobProfileQuality, constrainImprovedProfile } from "@/lib/ai/job-quality";
import type { JobProfile } from "@/lib/ai/schemas/job-profile";

function profile(overrides: Partial<JobProfile> = {}): JobProfile {
  return {
    title: "Ingeniero de misión",
    summary: "Planear y acompañar operaciones de misión.",
    department: "Operaciones",
    employment_type: "full_time",
    seniority: "senior",
    location: { work_mode: "onsite", city: "Medellín", region: "Antioquia", country: "Colombia" },
    responsibilities: [
      {
        text: "Planear operaciones de misión",
        importance: "high",
        evidence: "Planear operaciones de misión",
      },
    ],
    required_skills: [
      {
        raw_name: "Dinámica orbital",
        canonical_name: "dinámica orbital",
        category: "technical",
        importance: "required",
        proficiency: null,
        minimum_years: null,
        evidence: "Conocimiento en dinámica orbital",
      },
    ],
    experience_requirements: {
      minimum_years: 3,
      preferred_years: null,
      relevant_roles: ["Ingeniero de misión"],
      industries: ["Aeroespacial"],
    },
    education_requirements: [],
    certifications: [],
    languages: [],
    knockout_requirements: [],
    salary: { min: null, max: null, currency: null, period: "unspecified" },
    benefits: [],
    application_questions: [],
    extraction_metadata: { source: "pdf", confidence: 0.9, warnings: [] },
    ...overrides,
  };
}

describe("analyzeJobProfileQuality", () => {
  it("reconoce una oferta suficientemente definida", () => {
    const result = analyzeJobProfileQuality(profile());

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe("Lista para revisar");
  });

  it("señala vacíos importantes sin impedir continuar", () => {
    const result = analyzeJobProfileQuality(
      profile({ summary: null, responsibilities: [], required_skills: [] })
    );

    expect(result.score).toBeLessThan(55);
    expect(result.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["summary", "responsibilities", "required_skills"])
    );
  });

  it("detecta alternativas mal marcadas y atributos personales", () => {
    const result = analyzeJobProfileQuality(
      profile({
        summary: "Buscamos hombre soltero para el cargo.",
        required_skills: [
          {
            ...profile().required_skills[0],
            raw_name: "NASA o ESA",
            canonical_name: "programa espacial",
            importance: "must_have",
          },
        ],
      })
    );

    expect(result.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["required_skills", "protected_attributes"])
    );
  });
});

describe("constrainImprovedProfile", () => {
  it("preserva condiciones duras y elimina requisitos sin evidencia de origen", () => {
    const original = profile();
    const proposed = profile({
      title: "Astronauta jefe",
      location: { work_mode: "remote", city: null, region: null, country: null },
      summary: "Planear operaciones de misión con dinámica orbital.",
      required_skills: [
        original.required_skills[0],
        {
          ...original.required_skills[0],
          raw_name: "Python",
          canonical_name: "python",
          evidence: "Experiencia en Python",
        },
      ],
    });

    const constrained = constrainImprovedProfile(original, proposed);

    expect(constrained.title).toBe(original.title);
    expect(constrained.location).toEqual(original.location);
    expect(constrained.summary).toBe("Planear operaciones de misión con dinámica orbital.");
    expect(constrained.required_skills.map((item) => item.raw_name)).toEqual(["Dinámica orbital"]);
  });
});
