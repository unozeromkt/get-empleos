import { describe, expect, it } from "vitest";

import { calculateMatch } from "@/lib/matching/engine";
import { callCenterJob, dannaCandidate } from "./caso-call-center";
import {
  asesorTiendaNeiva,
  desarrolladorBogota,
  operarioProduccionNeiva,
} from "./contra-casos";

/**
 * Calibración contra un caso real — vacante "Operario(a) Call Center" (Neiva).
 *
 * El cliente comparó este par oferta/CV contra la herramienta que ya usa, que
 * puntuó 89% y consideró apta a la candidata. El motor v1 daba 71: cumplía el
 * cargo casi punto por punto y aun así salía por debajo de la banda alta,
 * porque comparaba textos en lugar de comparar competencias.
 *
 * Estos tests fijan las dos mitades de la corrección:
 *   - la candidata idónea tiene que entrar en banda alta;
 *   - los perfiles que no encajan tienen que seguir quedándose fuera.
 * Lo segundo importa tanto como lo primero: un motor generoso con todo el
 * mundo no ordena a nadie.
 */
describe("calibración — Operario(a) Call Center (Neiva)", () => {
  const evaluate = (candidate: Parameters<typeof calculateMatch>[1]) =>
    calculateMatch(callCenterJob, candidate);

  it("la candidata idónea entra en banda alta", () => {
    const result = evaluate(dannaCandidate);

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe("high");
    expect(result.criticalGaps).toHaveLength(0);
  });

  it("reconoce el cargo aunque no se llame igual que la vacante", () => {
    const result = evaluate(dannaCandidate);
    const role = result.requirements.find((r) =>
      r.requirementText.startsWith("Experiencia en cargos similares")
    );

    // "Agente de Servicio al Cliente" no comparte una sola palabra con
    // "Operario(a) Call Center": sin taxonomía esto valía cero.
    expect(role?.status).toBe("matched");
  });

  it("sustenta las competencias blandas en la experiencia, no solo en la lista declarada", () => {
    const result = evaluate(dannaCandidate);
    const organizacion = result.requirements.find(
      (r) => r.requirementText === "Organización y seguimiento"
    );

    expect(organizacion?.status).toBe("matched");
    expect(organizacion?.candidateEvidence).not.toBe("");
  });

  it("no inventa lo que el CV no sustenta", () => {
    const result = evaluate(dannaCandidate);
    const presion = result.requirements.find(
      (r) => r.requirementText === "Tolerancia a la presión"
    );

    // No hay una sola línea del CV sobre trabajo bajo presión. Que la
    // candidata sea buena no autoriza a dar por cumplido lo que no está.
    expect(presion?.status).toBe("not_found");
  });

  it("un perfil ajeno al cargo se queda muy por debajo", () => {
    const result = evaluate(desarrolladorBogota);

    expect(result.overallScore).toBeLessThan(50);
    expect(result.band).not.toBe("high");
  });

  it("marca brecha crítica cuando el cargo es presencial y el candidato vive en otra ciudad", () => {
    const result = evaluate(desarrolladorBogota);

    expect(result.criticalGaps.map((g) => g.requirementText)).toContain("Residir en Neiva, Huila");
  });

  it("estar en la ciudad correcta no compensa no saber hacer el trabajo", () => {
    const result = evaluate(operarioProduccionNeiva);

    expect(result.categoryScores.location).toBe(100);
    expect(result.overallScore).toBeLessThan(60);
  });

  it("ordena correctamente: idónea > encaje parcial > operario de planta > ajeno", () => {
    const idonea = evaluate(dannaCandidate).overallScore;
    const parcial = evaluate(asesorTiendaNeiva).overallScore;
    const planta = evaluate(operarioProduccionNeiva).overallScore;
    const ajeno = evaluate(desarrolladorBogota).overallScore;

    // El orden importa más que los valores absolutos: es lo que ve el
    // reclutador cuando abre la lista de postulantes.
    expect(idonea).toBeGreaterThan(parcial);
    expect(parcial).toBeGreaterThan(planta);
    expect(planta).toBeGreaterThan(ajeno);
  });
});
