import { describe, it, expect } from "vitest";

import { DEFAULT_SCORING_CONFIG } from "@/lib/matching/config";
import { calculateMatch, combineScores, findCriticalGaps } from "@/lib/matching/engine";
import { findExcludedFields } from "@/lib/matching/excluded-attributes";
import type {
  CandidateEvidence,
  JobRequirements,
  JobSkillRequirement,
  ScoreCategory,
} from "@/lib/matching/types";

// ─── Constructores de casos ───────────────────────────────────────────────────

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return {
    title: "Analista de Logística",
    skills: [],
    responsibilities: [],
    experience: { minimumYears: null, relevantRoles: [], industries: [] },
    education: [],
    certifications: [],
    languages: [],
    knockouts: [],
    location: null,
    ...overrides,
  };
}

function skill(
  rawName: string,
  importance: JobSkillRequirement["importance"] = "required",
  extra: Partial<JobSkillRequirement> = {}
): JobSkillRequirement {
  return {
    rawName,
    canonicalName: rawName.toLowerCase(),
    category: "technical",
    importance,
    minimumYears: null,
    ...extra,
  };
}

function candidate(overrides: Partial<CandidateEvidence> = {}): CandidateEvidence {
  return {
    skills: [],
    transferableSkills: [],
    experience: [],
    totalYearsExperience: null,
    education: [],
    certifications: [],
    languages: [],
    narrative: [],
    city: null,
    extractionConfidence: 0.9,
    isSparse: false,
    ...overrides,
  };
}

function candidateSkill(rawName: string, extra: Partial<CandidateEvidence["skills"][0]> = {}) {
  return {
    rawName,
    canonicalName: rawName.toLowerCase(),
    category: "technical" as const,
    yearsEstimate: null,
    evidence: `Trabajó con ${rawName}`,
    confidence: 0.9,
    ...extra,
  };
}

// ─── §43 Matching: los 16 casos mínimos ───────────────────────────────────────

describe("§43.1 — match exacto", () => {
  it("puntúa 100 en habilidades cuando el candidato cubre todo", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel"), skill("SAP")] }),
      candidate({ skills: [candidateSkill("Excel"), candidateSkill("SAP")] })
    );

    expect(result.categoryScores.technical_skills).toBe(100);
    expect(result.overallScore).toBe(100);
    expect(result.criticalGaps).toEqual([]);
  });
});

describe("§43.2 — sinónimo de habilidad", () => {
  it("reconoce un alias como coincidencia plena", () => {
    const result = calculateMatch(
      job({ skills: [skill("JavaScript")] }),
      candidate({ skills: [candidateSkill("JS")] })
    );

    expect(result.categoryScores.technical_skills).toBe(100);
    expect(result.requirements[0].matchType).toBe("canonical_alias");
  });

  it("ignora acentos y mayúsculas", () => {
    const result = calculateMatch(
      job({ skills: [skill("Logística")] }),
      candidate({ skills: [candidateSkill("logistica")] })
    );

    expect(result.categoryScores.technical_skills).toBe(100);
  });
});

describe("§43.3 — habilidad relacionada pero no equivalente", () => {
  it("la marca como parcial, no como coincidencia plena", () => {
    const result = calculateMatch(
      job({ skills: [skill("Gestión de inventarios de bodega")] }),
      candidate({ skills: [candidateSkill("Gestión de inventarios")] })
    );

    const requirement = result.requirements[0];
    expect(requirement.status).toBe("partial");
    expect(requirement.matchScore).toBeGreaterThan(0);
    expect(requirement.matchScore).toBeLessThan(1);
  });
});

describe("§43.4 — habilidad ausente", () => {
  it("marca not_found cuando el candidato tiene otras habilidades pero no esa", () => {
    const result = calculateMatch(
      job({ skills: [skill("Power BI")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.requirements[0].status).toBe("not_found");
    expect(result.categoryScores.technical_skills).toBe(0);
  });
});

describe("§43.5 — habilidad desconocida (unknown ≠ not_found)", () => {
  it("marca unknown cuando el CV no aportó ninguna habilidad", () => {
    const result = calculateMatch(
      job({ skills: [skill("Power BI")] }),
      candidate({ skills: [] })
    );

    // Distinción central de la spec §8: ausencia de evidencia no es carencia
    expect(result.requirements[0].status).toBe("unknown");
    expect(result.requirements[0].matchType).toBe("unknown");
  });

  it("un must_have unknown NO genera brecha crítica", () => {
    const result = calculateMatch(
      job({ skills: [skill("Power BI", "must_have")] }),
      candidate({ skills: [] })
    );

    expect(result.criticalGaps).toEqual([]);
  });

  it("un must_have not_found SÍ genera brecha crítica", () => {
    const result = calculateMatch(
      job({ skills: [skill("Power BI", "must_have")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.criticalGaps).toHaveLength(1);
    expect(result.criticalGaps[0].requirementText).toBe("Power BI");
  });
});

describe("§43.6 — CV muy corto", () => {
  it("devuelve banda insufficient_data en lugar de baja compatibilidad", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel")] }),
      candidate({ skills: [candidateSkill("Excel")], isSparse: true, extractionConfidence: 0.3 })
    );

    // El score puede ser alto, pero no es confiable: son cosas distintas (§20)
    expect(result.overallScore).toBe(100);
    expect(result.band).toBe("insufficient_data");
    expect(result.scoreConfidence).toBeLessThan(0.65);
  });
});

describe("§43.7 — candidato sobrecualificado", () => {
  it("no penaliza superar los años requeridos", () => {
    const result = calculateMatch(
      job({ experience: { minimumYears: 3, relevantRoles: [], industries: [] } }),
      candidate({
        totalYearsExperience: 12,
        experience: [{ title: "Analista", company: "X", responsibilities: [], achievements: [], skills: [] }],
      })
    );

    const yearsReq = result.requirements.find((r) => r.requirementText.includes("años"));
    expect(yearsReq?.status).toBe("matched");
    expect(yearsReq?.matchScore).toBe(1);
  });
});

describe("§43.8 — experiencia suficiente con título distinto", () => {
  it("reconoce responsabilidades equivalentes aunque el cargo se llame distinto", () => {
    const result = calculateMatch(
      job({
        title: "Coordinador de Logística",
        responsibilities: ["Coordinar el inventario de bodega"],
      }),
      candidate({
        experience: [
          {
            title: "Supervisor de Almacén",
            company: "X",
            responsibilities: ["Coordinar el inventario de bodega central"],
            achievements: [],
            skills: [],
          },
        ],
      })
    );

    const responsibility = result.requirements.find((r) => r.type === "responsibility");
    expect(responsibility?.status).toBe("matched");
    expect(responsibility?.candidateEvidence).toContain("inventario de bodega");
  });
});

describe("§43.9 — título igual pero responsabilidades no relacionadas", () => {
  it("no da por buena la coincidencia solo por el nombre del cargo", () => {
    const result = calculateMatch(
      job({
        title: "Analista",
        responsibilities: ["Programar rutinas de mantenimiento de maquinaria industrial"],
      }),
      candidate({
        experience: [
          {
            title: "Analista",
            company: "X",
            responsibilities: ["Atender clientes en punto de venta"],
            achievements: [],
            skills: [],
          },
        ],
      })
    );

    const responsibility = result.requirements.find((r) => r.type === "responsibility");
    expect(responsibility?.status).toBe("not_found");
  });
});

describe("§43.10 — must-have no encontrado", () => {
  it("muestra la brecha pero NO descarta al candidato", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel"), skill("Certificación X", "must_have")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.criticalGaps).toHaveLength(1);
    // Sigue teniendo score: la spec §13 prohíbe el rechazo automático
    expect(result.overallScore).toBeGreaterThan(0);
  });
});

describe("§43.11 — vacante sin requisitos educativos", () => {
  it("saca la categoría del denominador en vez de penalizar", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.categoryScores.education_certifications).toBeNull();
    expect(result.appliedWeights.education_certifications).toBeUndefined();
    // 100% en la única categoría aplicable → 100 global, no 35
    expect(result.overallScore).toBe(100);
  });
});

describe("§43.12 — vacante sin idiomas", () => {
  it("no incluye idiomas en el cálculo", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel")] }),
      candidate({ skills: [candidateSkill("Excel")], languages: [] })
    );

    expect(result.categoryScores.languages).toBeNull();
    expect(result.appliedWeights.languages).toBeUndefined();
  });
});

describe("§43.16 — determinismo", () => {
  it("el mismo input produce el mismo score con la misma versión", () => {
    const j = job({
      skills: [skill("Excel"), skill("SAP", "must_have")],
      responsibilities: ["Coordinar inventario"],
      experience: { minimumYears: 3, relevantRoles: ["Analista"], industries: [] },
      languages: [{ language: "Inglés", minimumLevel: "B1", importance: "preferred" }],
    });
    const c = candidate({
      skills: [candidateSkill("Excel"), candidateSkill("SAP")],
      totalYearsExperience: 5,
      experience: [
        { title: "Analista", company: "X", responsibilities: ["Coordinar inventario"], achievements: [], skills: [] },
      ],
      languages: [{ language: "Inglés", level: "B1" }],
    });

    const a = calculateMatch(j, c);
    const b = calculateMatch(j, c);

    expect(a.overallScore).toBe(b.overallScore);
    expect(a.scoreConfidence).toBe(b.scoreConfidence);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ─── Renormalización de pesos (§12.2) ─────────────────────────────────────────

describe("combineScores — renormalización (§12.2)", () => {
  const weights = DEFAULT_SCORING_CONFIG.weights;

  it("reparte el peso de las categorías ausentes entre las aplicables", () => {
    const scores = {
      technical_skills: 80,
      experience: 60,
      education_certifications: null,
      transferable_skills: null,
      languages: null,
      preferred_skills: null,
      location: null,
    } as Record<ScoreCategory, number | null>;

    const { overallScore, appliedWeights } = combineScores(scores, weights);

    // (80×wt + 60×we) / (wt+we): solo pesan las dos categorías aplicables.
    // Se calcula desde la configuración para que el test siga midiendo la
    // renormalización y no los valores concretos de los pesos.
    const wt = weights.technical_skills;
    const we = weights.experience;
    expect(overallScore).toBe(Math.round((80 * wt + 60 * we) / (wt + we)));
    expect(appliedWeights).toEqual({ technical_skills: wt, experience: we });
  });

  it("una sola categoría aplicable determina el score completo", () => {
    const scores = {
      technical_skills: 75,
      experience: null,
      education_certifications: null,
      transferable_skills: null,
      languages: null,
      preferred_skills: null,
      location: null,
    } as Record<ScoreCategory, number | null>;

    expect(combineScores(scores, weights).overallScore).toBe(75);
  });

  it("devuelve 0 si no hay ninguna categoría aplicable", () => {
    const scores = {
      technical_skills: null,
      experience: null,
      education_certifications: null,
      transferable_skills: null,
      languages: null,
      preferred_skills: null,
      location: null,
    } as Record<ScoreCategory, number | null>;

    expect(combineScores(scores, weights).overallScore).toBe(0);
  });
});

// ─── Bandas (§12.3) ───────────────────────────────────────────────────────────

describe("bandas visuales (§12.3)", () => {
  function resultWithSkillCoverage(matchedCount: number, total: number) {
    const skills = Array.from({ length: total }, (_, i) => skill(`Skill${i}`));
    const owned = Array.from({ length: matchedCount }, (_, i) => candidateSkill(`Skill${i}`));
    return calculateMatch(job({ skills }), candidate({ skills: owned }));
  }

  it("80 o más → high", () => {
    expect(resultWithSkillCoverage(5, 5).band).toBe("high");
  });

  it("entre 60 y 79 → potential", () => {
    const result = resultWithSkillCoverage(7, 10);
    expect(result.overallScore).toBe(70);
    expect(result.band).toBe("potential");
  });

  it("menos de 60 → low", () => {
    const result = resultWithSkillCoverage(3, 10);
    expect(result.overallScore).toBe(30);
    expect(result.band).toBe("low");
  });
});

// ─── Requisitos indispensables (§13) ──────────────────────────────────────────

describe("findCriticalGaps (§13)", () => {
  it("no genera brechas cuando todo está cubierto", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel", "must_have")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(findCriticalGaps(result.requirements, job())).toEqual([]);
  });

  it("un requisito 'required' incumplido no es brecha crítica", () => {
    const result = calculateMatch(
      job({ skills: [skill("Power BI", "required")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.criticalGaps).toEqual([]);
  });
});

// ─── Confianza independiente del score (§20) ──────────────────────────────────

describe("scoreConfidence (§20)", () => {
  it("es alta cuando hay evidencia para todos los requisitos", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel"), skill("SAP")] }),
      candidate({ skills: [candidateSkill("Excel"), candidateSkill("SAP")] })
    );

    expect(result.scoreConfidence).toBeGreaterThan(0.8);
  });

  it("baja cuando la mayoría de requisitos son unknown", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel"), skill("SAP"), skill("Power BI")] }),
      candidate({ skills: [], extractionConfidence: 0.5 })
    );

    expect(result.scoreConfidence).toBeLessThan(0.5);
  });

  it("puede haber score alto con confianza baja a la vez", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel")] }),
      candidate({
        skills: [candidateSkill("Excel", { evidence: "" })],
        extractionConfidence: 0.3,
        isSparse: true,
      })
    );

    expect(result.overallScore).toBe(100);
    expect(result.scoreConfidence).toBeLessThan(0.5);
  });
});

// ─── Explicabilidad (§19) ─────────────────────────────────────────────────────

describe("explicación del score (§19)", () => {
  it("lista fortalezas con su evidencia", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.explanation.strengths[0]).toContain("Excel");
    expect(result.explanation.summary).toContain("1 de 1");
  });

  it("presenta los unknown como preguntas, no como carencias", () => {
    const result = calculateMatch(
      job({ skills: [skill("Power BI")] }),
      candidate({ skills: [] })
    );

    expect(result.explanation.gaps).toEqual([]);
    expect(result.explanation.questionsForRecruiter[0]).toContain("Power BI");
  });
});

// ─── Atributos prohibidos (§29) ───────────────────────────────────────────────

describe("atributos excluidos del scoring (§29)", () => {
  it("la entrada del motor no contiene ningún campo protegido", () => {
    const input = {
      job: job({ skills: [skill("Excel")] }),
      candidate: candidate({ skills: [candidateSkill("Excel")] }),
    };

    // Red de seguridad frente a regresiones: si alguien añade birth_date,
    // gender o similares a las entradas del motor, esto falla
    expect(findExcludedFields(input)).toEqual([]);
  });

  it("el resultado tampoco los expone", () => {
    const result = calculateMatch(
      job({ skills: [skill("Excel")] }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(findExcludedFields(result)).toEqual([]);
  });
});

// ─── Regresiones detectadas con datos reales (2026-08-12) ────────────────────

describe("regresión — el motor debe usar canonical_name del requisito", () => {
  it("empareja cuando la oferta trae una frase larga pero canonical atómico", () => {
    // Caso real: la IA extrae raw_name "Manejo intermedio de Excel o Google
    // Sheets" con canonical_name "Excel". Comparar solo contra la frase larga
    // hacía imposible la coincidencia.
    const result = calculateMatch(
      job({
        skills: [
          {
            rawName: "Manejo intermedio de Excel o Google Sheets",
            canonicalName: "Excel",
            category: "tool",
            importance: "must_have",
            minimumYears: null,
          },
        ],
      }),
      candidate({ skills: [candidateSkill("Excel")] })
    );

    expect(result.requirements[0].status).toBe("matched");
    expect(result.categoryScores.technical_skills).toBe(100);
  });
});

describe("regresión — buscar evidencia en la experiencia laboral", () => {
  it("reconoce una habilidad declarada en las responsabilidades del puesto", () => {
    // Caso real: el candidato no listó "Publicidad ADS" en sus skills, pero la
    // escribió al describir su cargo. Un reclutador lee el CV entero.
    const result = calculateMatch(
      job({ skills: [skill("Publicidad ADS")] }),
      candidate({
        skills: [candidateSkill("Diseño gráfico")],
        experience: [
          {
            title: "Gerente de marcas",
            company: "Agencia X",
            responsibilities: ["Publicidad ADS", "Creación de contenido"],
            achievements: [],
            skills: [],
          },
        ],
      })
    );

    const req = result.requirements[0];
    expect(req.status).toBe("partial");
    expect(req.candidateEvidence).toContain("Publicidad ADS");
  });

  it("sigue marcando not_found si no está ni en skills ni en la experiencia", () => {
    const result = calculateMatch(
      job({ skills: [skill("Contabilidad")] }),
      candidate({
        skills: [candidateSkill("Diseño gráfico")],
        experience: [
          {
            title: "Diseñador",
            company: "X",
            responsibilities: ["Diseño de piezas"],
            achievements: [],
            skills: [],
          },
        ],
      })
    );

    expect(result.requirements[0].status).toBe("not_found");
  });
});

describe("regresión — categoría sin evidencia no puede valer 0", () => {
  it("excluye habilidades blandas del cálculo cuando el CV no aporta ninguna", () => {
    // Antes: 3 requisitos transferibles sin datos → categoría 0 con peso 10,
    // restando 10 puntos por algo que el sistema admite no poder juzgar.
    const result = calculateMatch(
      job({
        skills: [
          skill("Excel"),
          {
            rawName: "comunicación efectiva",
            canonicalName: "Comunicación efectiva",
            category: "transferable",
            importance: "required",
            minimumYears: null,
          },
        ],
      }),
      candidate({ skills: [candidateSkill("Excel")], transferableSkills: [] })
    );

    expect(result.categoryScores.transferable_skills).toBeNull();
    expect(result.appliedWeights.transferable_skills).toBeUndefined();
    // La única categoría evaluable está al 100%, así que el total es 100
    expect(result.overallScore).toBe(100);
  });
});
