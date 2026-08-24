import { describe, it, expect } from "vitest";

import {
  mapProfileToFlatFields,
  mapEducationLevel,
  mapSkills,
  mapYearsExperience,
  normalizeCity,
  type FlatCandidateFields,
} from "@/lib/ai/candidate-mapper";
import type { CandidateProfile } from "@/lib/ai/schemas/candidate-profile";

/** Perfil mínimo válido; cada test sobrescribe solo lo que le interesa. */
function makeProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    contact: {
      full_name: null,
      email: null,
      phone: null,
      city: null,
      linkedin_url: null,
    },
    headline: null,
    professional_summary: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    projects: [],
    transferable_skills: [],
    total_years_experience: null,
    profile_metadata: { overall_confidence: 0.9, warnings: [] },
    ...overrides,
  };
}

function skill(raw_name: string, confidence: number, category: "technical" | "language" = "technical") {
  return {
    raw_name,
    canonical_name: raw_name,
    category,
    proficiency: null,
    years_estimate: null,
    last_used: null,
    evidence: [{ source: "resume" as const, text: `Trabajó con ${raw_name}` }],
    confidence,
  };
}

/**
 * Spec §33 — el dato confirmado por la persona gana sobre la inferencia de la IA.
 * Es la regla de negocio más importante de la Fase 2.
 */
describe("mapProfileToFlatFields — precedencia (§33)", () => {
  it("rellena los campos que están vacíos", () => {
    const current: Partial<FlatCandidateFields> = { city: null, career: null };
    const profile = makeProfile({
      contact: { full_name: "Ana Restrepo", email: null, phone: null, city: "Medellín", linkedin_url: null },
      education: [
        {
          institution: "UPB",
          degree: "Ingeniería Industrial",
          field: "Ingeniería Industrial",
          start_date: null,
          end_date: null,
          status: "completed",
        },
      ],
    });

    const { filled, suggestions } = mapProfileToFlatFields(current, profile);

    expect(filled.city).toBe("Medellín");
    expect(filled.career).toBe("Ingeniería Industrial");
    expect(filled.full_name).toBe("Ana Restrepo");
    expect(suggestions).toEqual([]);
  });

  it("NUNCA sobrescribe un valor que el candidato ya escribió", () => {
    const current: Partial<FlatCandidateFields> = { city: "Bogotá" };
    const profile = makeProfile({
      contact: { full_name: null, email: null, phone: null, city: "Medellín", linkedin_url: null },
    });

    const { filled, suggestions } = mapProfileToFlatFields(current, profile);

    // El valor del candidato permanece intacto
    expect(filled.city).toBeUndefined();
    // Y la discrepancia se ofrece como sugerencia, no se aplica
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      field: "city",
      currentValue: "Bogotá",
      suggestedValue: "Medellín",
    });
  });

  it("no genera sugerencia cuando el valor coincide, ignorando mayúsculas", () => {
    const current: Partial<FlatCandidateFields> = { city: "medellín" };
    const profile = makeProfile({
      contact: { full_name: null, email: null, phone: null, city: "Medellín", linkedin_url: null },
    });

    const { filled, suggestions } = mapProfileToFlatFields(current, profile);

    expect(filled.city).toBeUndefined();
    expect(suggestions).toEqual([]);
  });

  it("trata la cadena vacía como campo vacío, no como valor del candidato", () => {
    const current: Partial<FlatCandidateFields> = { city: "   " };
    const profile = makeProfile({
      contact: { full_name: null, email: null, phone: null, city: "Cali", linkedin_url: null },
    });

    const { filled, suggestions } = mapProfileToFlatFields(current, profile);

    expect(filled.city).toBe("Cali");
    expect(suggestions).toEqual([]);
  });

  it("fusiona habilidades en lugar de reemplazarlas", () => {
    const current: Partial<FlatCandidateFields> = { skills: ["Excel", "SAP"] };
    const profile = makeProfile({ skills: [skill("Power BI", 0.9), skill("Excel", 0.9)] });

    const { filled } = mapProfileToFlatFields(current, profile);

    // No se pierde nada de lo que el candidato ya tenía
    expect(filled.skills).toContain("Excel");
    expect(filled.skills).toContain("SAP");
    expect(filled.skills).toContain("Power BI");
    // Y "Excel" no se duplica
    expect(filled.skills?.filter((s) => s.toLowerCase() === "excel")).toHaveLength(1);
  });

  it("no toca las habilidades si el CV no aporta ninguna nueva", () => {
    const current: Partial<FlatCandidateFields> = { skills: ["Excel"] };
    const profile = makeProfile({ skills: [skill("Excel", 0.9)] });

    const { filled } = mapProfileToFlatFields(current, profile);

    expect(filled.skills).toBeUndefined();
  });

  it("trunca el resumen al límite de 500 caracteres de la base de datos", () => {
    const profile = makeProfile({ professional_summary: "a".repeat(600) });

    const { filled } = mapProfileToFlatFields({}, profile);

    expect(filled.summary).toHaveLength(500);
    expect(filled.summary?.endsWith("...")).toBe(true);
  });
});

describe("normalizeCity", () => {
  it("descarta el departamento que los CV suelen pegar a la ciudad", () => {
    expect(normalizeCity("Medellín, Antioquia")).toBe("Medellín");
    expect(normalizeCity("Cali - Valle del Cauca")).toBe("Cali");
    expect(normalizeCity("Barranquilla / Atlántico")).toBe("Barranquilla");
  });

  it("limpia el sufijo D.C. de Bogotá", () => {
    expect(normalizeCity("Bogotá D.C.")).toBe("Bogotá");
    expect(normalizeCity("Bogotá D.C., Cundinamarca")).toBe("Bogotá");
  });

  it("deja intacta una ciudad ya limpia", () => {
    expect(normalizeCity("Medellín")).toBe("Medellín");
  });

  it("devuelve null para valores vacíos", () => {
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity("   ")).toBeNull();
  });

  it("se aplica al mapear el perfil completo", () => {
    const profile = makeProfile({
      contact: { full_name: null, email: null, phone: null, city: "Medellín, Antioquia", linkedin_url: null },
    });

    expect(mapProfileToFlatFields({}, profile).filled.city).toBe("Medellín");
  });
});

describe("mapEducationLevel", () => {
  const cases: Array<[string, string]> = [
    ["Doctorado en Economía", "doctorado"],
    ["Maestría en Finanzas", "maestria"],
    ["Especialización en Gerencia", "especialista"],
    ["Tecnólogo en Sistemas", "tecnologo"],
    ["Técnico en Mantenimiento", "tecnico"],
    ["Bachiller académico", "bachiller"],
    ["Ingeniería Industrial", "profesional"],
    ["Licenciatura en Educación", "profesional"],
  ];

  it.each(cases)("mapea %s → %s", (degree, expected) => {
    const profile = makeProfile({
      education: [
        { institution: "X", degree, field: null, start_date: null, end_date: null, status: "completed" },
      ],
    });
    expect(mapEducationLevel(profile)).toBe(expected);
  });

  it("gana el grado más alto cuando hay varios títulos", () => {
    const profile = makeProfile({
      education: [
        { institution: "A", degree: "Ingeniería Industrial", field: null, start_date: null, end_date: null, status: "completed" },
        { institution: "B", degree: "Maestría en Logística", field: null, start_date: null, end_date: null, status: "completed" },
      ],
    });
    expect(mapEducationLevel(profile)).toBe("maestria");
  });

  it("devuelve null en vez de encasillar mal una formación desconocida", () => {
    const profile = makeProfile({
      education: [
        { institution: "X", degree: "Curso de repostería", field: null, start_date: null, end_date: null, status: "completed" },
      ],
    });
    expect(mapEducationLevel(profile)).toBeNull();
  });

  it("devuelve null si no hay formación en el CV", () => {
    expect(mapEducationLevel(makeProfile())).toBeNull();
  });
});

describe("mapSkills", () => {
  it("descarta las habilidades de baja confianza", () => {
    const profile = makeProfile({
      skills: [skill("Excel", 0.9), skill("Liderazgo", 0.3)],
    });

    const result = mapSkills(profile);

    expect(result).toContain("Excel");
    expect(result).not.toContain("Liderazgo");
  });

  it("excluye los idiomas, que van en su propio campo", () => {
    const profile = makeProfile({
      skills: [skill("Excel", 0.9), skill("Inglés", 0.9, "language")],
    });

    expect(mapSkills(profile)).toEqual(["Excel"]);
  });
});

describe("mapYearsExperience", () => {
  it("usa el valor calculado por la IA", () => {
    expect(mapYearsExperience(makeProfile({ total_years_experience: 5.4 }))).toBe(5);
  });

  it("no estima cuando el CV no permite calcularlo", () => {
    expect(mapYearsExperience(makeProfile({ total_years_experience: null }))).toBeNull();
  });

  it("rechaza valores absurdos", () => {
    expect(mapYearsExperience(makeProfile({ total_years_experience: 99 }))).toBeNull();
    expect(mapYearsExperience(makeProfile({ total_years_experience: -3 }))).toBeNull();
  });
});
