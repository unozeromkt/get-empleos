/**
 * Conversión de similitud a cumplimiento — corrección de §14 y §16.
 *
 * El motor usaba la similitud textual DIRECTAMENTE como puntaje del requisito.
 * Eso confunde dos cosas distintas:
 *
 *   similitud  = cuánto se parecen dos textos
 *   cumplimiento = si la persona hace o no hace lo que pide el requisito
 *
 * Un candidato que cubre un requisito a la perfección casi nunca pasa de 0,6
 * de solapamiento, porque describe su trabajo con otras palabras y añade
 * contexto propio. Usar ese 0,6 como nota deja el techo de la categoría en
 * torno al 60% para el candidato IDEAL, y arrastra el score global hacia
 * abajo de forma sistemática: no mide al candidato, mide la distancia entre
 * dos estilos de redacción.
 *
 * Esta curva traduce: a partir de `FULL_CREDIT_SIMILARITY` se considera el
 * requisito cubierto, por debajo de `NO_CREDIT_SIMILARITY` se considera ruido,
 * y en medio se reparte de forma lineal.
 *
 * SIN CALIBRAR con dataset propio: los dos umbrales salen de revisar casos
 * reales a mano, no de un modelo ajustado. Son configurables por esa razón.
 */

/** Por encima de esta similitud, el requisito se da por cubierto. */
export const FULL_CREDIT_SIMILARITY = 0.6;

/** Por debajo de esta similitud, la coincidencia es ruido léxico. */
export const NO_CREDIT_SIMILARITY = 0.15;

export interface CoverageThresholds {
  full: number;
  none: number;
}

export const DEFAULT_COVERAGE_THRESHOLDS: CoverageThresholds = {
  full: FULL_CREDIT_SIMILARITY,
  none: NO_CREDIT_SIMILARITY,
};

export function coverageCredit(
  similarity: number,
  thresholds: CoverageThresholds = DEFAULT_COVERAGE_THRESHOLDS
): number {
  if (similarity >= thresholds.full) return 1;
  if (similarity <= thresholds.none) return 0;

  const span = thresholds.full - thresholds.none;
  if (span <= 0) return similarity >= thresholds.full ? 1 : 0;

  return round2((similarity - thresholds.none) / span);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
