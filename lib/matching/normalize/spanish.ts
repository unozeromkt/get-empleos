/**
 * Morfología ligera del español para comparar textos — soporte de §9 y §14.
 *
 * El motor comparaba tokens por igualdad exacta. En español eso descarta
 * coincidencias evidentes: "cliente" ≠ "clientes", "negociar" ≠ "negociación",
 * "llamada" ≠ "llamadas". En un portal donde las ofertas se redactan con
 * infinitivos ("Realizar llamadas a clientes") y los CV con sustantivos
 * ("atención de llamadas al cliente"), esa rigidez producía falsos negativos
 * masivos: candidatos que hacen exactamente el trabajo pedido puntuaban cerca
 * de cero en cobertura de responsabilidades.
 *
 * Deliberadamente NO se usa un stemmer agresivo tipo Snowball completo: un
 * falso positivo (dar por cumplido algo que no está) es más caro que un falso
 * negativo, porque el reclutador no tiene forma de detectarlo. Se aplica solo
 * flexión segura (plural y género) más una comparación por prefijo con guardas.
 */

/**
 * Longitud mínima de prefijo común para aceptar dos tokens como la misma
 * familia léxica ("negociar" / "negociación" → "negocia").
 *
 * Con 5 aparecen falsos positivos reales del dominio ("contable" / "contacto").
 * Con 7 se pierden pares legítimos frecuentes ("persuadir" / "persuasión").
 */
const MIN_COMMON_PREFIX = 6;

/**
 * Los dos tokens deben tener longitudes comparables. Sin esta guarda,
 * "ventas" emparejaría con cualquier palabra larga que empiece igual.
 */
const MIN_LENGTH_RATIO = 0.5;

/** Terminaciones tras las que un plural en "-es" pierde toda la sílaba. */
const CONSONANT_BEFORE_ES = /[lrndjsx]es$/;

/**
 * Reduce un token a su forma flexiva base.
 *
 * Solo plural y vocal final de género. Nada de sufijos derivativos: eso lo
 * cubre —con guardas— la comparación por prefijo.
 */
export function stemToken(token: string): string {
  let stem = token;

  // Plural
  if (stem.length > 4 && stem.endsWith("ces")) {
    stem = `${stem.slice(0, -3)}z`; // voces → voz
  } else if (stem.length > 4 && CONSONANT_BEFORE_ES.test(stem)) {
    stem = stem.slice(0, -2); // ciudades → ciudad, meses → mes
  } else if (stem.length > 3 && stem.endsWith("s")) {
    stem = stem.slice(0, -1); // clientes → cliente, metas → meta
  }

  // Vocal final: neutraliza género y las alternancias sustantivo/participio
  // ("producto"/"producta", "llamada"/"llamado"). Solo en palabras largas:
  // en las cortas la vocal final suele ser parte de la raíz ("meta", "venta").
  if (stem.length > 5 && /[aoe]$/.test(stem)) {
    stem = stem.slice(0, -1);
  }

  return stem;
}

/** Prefijo común entre dos cadenas, en caracteres. */
function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

/**
 * ¿Son el mismo concepto léxico?
 *
 * Primero por flexión (barato y exacto), después por familia de palabras.
 * La segunda vía es la que conecta el infinitivo de la oferta con el
 * sustantivo del CV, que es como se redactan de verdad ambos documentos.
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;

  const stemA = stemToken(a);
  const stemB = stemToken(b);
  if (stemA === stemB) return true;

  const shorter = stemA.length <= stemB.length ? stemA : stemB;
  const longer = stemA.length <= stemB.length ? stemB : stemA;

  if (shorter.length < MIN_COMMON_PREFIX) return false;
  if (shorter.length / longer.length < MIN_LENGTH_RATIO) return false;

  return commonPrefixLength(shorter, longer) >= MIN_COMMON_PREFIX;
}

/**
 * ¿Aparece el token en el conjunto, admitiendo variantes morfológicas?
 *
 * El conjunto se recorre entero porque la coincidencia no es por igualdad.
 * Los tamaños en juego (decenas de tokens) hacen irrelevante el coste.
 */
export function tokenInSet(token: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => tokensMatch(token, candidate));
}

/**
 * Peso informativo de un token al medir cobertura.
 *
 * Las ofertas colombianas se redactan con un andamiaje verbal fijo —"realizar",
 * "garantizar", "de manera oportuna"— que no distingue a un candidato de otro:
 * aparece igual en la oferta de call center y en la de bodega. Contarlo con el
 * mismo peso que "telefónicas" o "inventarios" diluye la señal real hasta
 * hacer imposible superar cualquier umbral en requisitos largos.
 */
const LOW_INFORMATION_TOKENS = new Set([
  // Verbos de andamiaje
  "realizar", "efectuar", "hacer", "cumplir", "mantener", "garantizar",
  "apoyar", "brindar", "dar", "tener", "contar", "poseer", "ejecutar",
  "llevar", "permitir", "lograr", "desarrollar", "participar", "asegurar",
  // Calificadores y muletillas
  "correctamente", "manera", "oportuna", "oportuno", "adecuado", "adecuada",
  "establecidas", "establecidos", "acordes", "demas", "diferentes", "buena",
  "buen", "excelente", "capacidad", "habilidad", "habilidades", "disposicion",
  "actitud", "alto", "alta", "nivel", "general", "generales", "propias",
  "correspondiente", "correspondientes", "respectivo", "respectiva",
  "mismo", "misma", "todas", "todos", "cada", "segun", "sobre", "asi",
]);

export const LOW_INFORMATION_WEIGHT = 0.35;

export function tokenWeight(token: string): number {
  return LOW_INFORMATION_TOKENS.has(token) ? LOW_INFORMATION_WEIGHT : 1;
}
