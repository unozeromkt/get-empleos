import { coverageAcrossTexts, textSimilarity } from "@/lib/matching/normalize/skill-normalizer";
import type { CandidateEvidence } from "@/lib/matching/types";

/**
 * Corpus de evidencia del candidato — soporte de §14, §16 y §17.
 *
 * Un reclutador no lee la lista de habilidades de forma aislada: lee cada
 * cargo entero y decide si esa persona ha hecho lo que la oferta pide. El
 * motor comparaba requisito contra frase suelta y se quedaba con la mejor
 * coincidencia individual, lo que descarta toda la evidencia repartida entre
 * varias frases del mismo puesto.
 *
 * Aquí la evidencia se agrupa por CARGO. La agrupación importa: permite sumar
 * lo que aporta un puesto sin llegar a sumar el CV completo, que convertiría
 * cualquier hoja de vida larga en un comodín que cubre cualquier requisito.
 */

export interface EvidenceBlock {
  /** Cargo y empresa, o "perfil profesional". Se muestra al reclutador. */
  context: string;
  texts: string[];
}

export interface EvidenceItem {
  text: string;
  context: string;
}

export function buildEvidenceBlocks(candidate: CandidateEvidence): EvidenceBlock[] {
  const blocks: EvidenceBlock[] = [];

  for (const job of candidate.experience) {
    const context = `${job.title}${job.company ? ` en ${job.company}` : ""}`;
    const texts = [
      job.title,
      ...job.responsibilities,
      ...job.achievements,
      ...job.skills,
    ].filter((text) => !!text?.trim());

    if (texts.length > 0) blocks.push({ context, texts });
  }

  // El resumen profesional es un bloque más: muchos CV concentran ahí la
  // especialidad ("8 años en marketing digital") sin repetirla en ningún cargo
  const narrative = candidate.narrative.flatMap(splitSentences);
  if (narrative.length > 0) {
    blocks.push({ context: "perfil profesional", texts: narrative });
  }

  return blocks;
}

/**
 * La misma evidencia, frase a frase.
 *
 * Se usa cuando hace falta CITAR el fragmento concreto que sustenta un
 * requisito: un bloque entero no sirve como cita para el reclutador.
 */
export function flattenEvidence(blocks: EvidenceBlock[]): EvidenceItem[] {
  return blocks.flatMap((block) =>
    block.texts.map((text) => ({ text, context: block.context }))
  );
}

/**
 * Trocea el texto largo en frases. Comparar un requisito contra un párrafo
 * entero diluye el solapamiento de tokens hasta hacerlo inservible.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/[.;\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 3);
}

/**
 * Granularidad con la que se busca un requisito en la evidencia.
 *
 * - `sentence`: el requisito debe aparecer en UNA frase. Es lo correcto para
 *   una habilidad o competencia, que es un concepto atómico: "actitud
 *   comercial" no se demuestra sumando la palabra "comercial" de un renglón
 *   con la palabra "actitud" de otro.
 * - `pooled`: el requisito puede repartirse entre las frases de un mismo
 *   cargo. Es lo correcto para una responsabilidad, que casi siempre viene
 *   redactada con varias cláusulas ("Gestionar bases de datos Y mantener
 *   actualizada la información de los clientes") que en el CV aparecen
 *   descritas por separado.
 */
export type EvidenceGranularity = "sentence" | "pooled";

export interface EvidenceMatch {
  similarity: number;
  /** Frase concreta que se le muestra al reclutador como sustento. */
  text: string;
  context: string;
}

/**
 * Mejor sustento del requisito en la experiencia del candidato.
 *
 * Se prueba cada variante del requisito (su forma literal y su forma
 * canónica) y se devuelve siempre una cita verificable, nunca solo un número.
 */
export function bestEvidenceMatch(
  variants: string[],
  blocks: EvidenceBlock[],
  granularity: EvidenceGranularity
): EvidenceMatch | null {
  const usable = variants.filter((variant) => !!variant?.trim());
  if (usable.length === 0) return null;

  let best: EvidenceMatch | null = null;

  for (const block of blocks) {
    const similarity =
      granularity === "pooled"
        ? Math.max(...usable.map((variant) => coverageAcrossTexts(variant, block.texts)), 0)
        : Math.max(
            ...block.texts.flatMap((text) => usable.map((variant) => textSimilarity(variant, text))),
            0
          );

    if (similarity <= 0 || (best && similarity <= best.similarity)) continue;

    best = { similarity, text: bestQuote(usable, block.texts), context: block.context };
  }

  return best;
}

/** Frase del bloque que más se parece al requisito: la que se cita. */
function bestQuote(variants: string[], texts: string[]): string {
  let quote = texts[0] ?? "";
  let quoteScore = -1;

  for (const text of texts) {
    const score = Math.max(...variants.map((variant) => textSimilarity(variant, text)), 0);
    if (score > quoteScore) {
      quoteScore = score;
      quote = text;
    }
  }

  return quote;
}
