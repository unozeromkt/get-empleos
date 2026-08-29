import { stemToken, tokenWeight, tokensMatch } from "@/lib/matching/normalize/spanish";
import type { MatchType } from "@/lib/matching/types";

/**
 * Normalización y emparejamiento de habilidades — spec §9.
 *
 * Cascada de resolución (§9.2), niveles 1 a 3 en esta versión:
 *   1. Coincidencia exacta canónica
 *   2. Alias / sinónimo
 *   3. Taxonomía  ← Fase 5 (ESCO)
 *   4. Similitud semántica por embeddings  ← Fase 5
 *   5. Adjudicación por LLM  ← solo si hace falta, Fase 5
 *   6. Sin resolver
 *
 * En V1 no hay embeddings. El emparejamiento parcial se hace por solapamiento
 * de tokens, con un umbral CONFIGURABLE y explícitamente SIN CALIBRAR: la spec
 * §14 advierte de no asumir que una similitud numérica equivale a compatibilidad
 * real. Se calibra en la Fase 6 con dataset propio.
 */

/** Umbral de solapamiento para considerar una coincidencia parcial. SIN CALIBRAR. */
export const PARTIAL_MATCH_THRESHOLD = 0.5;

/**
 * Alias conocidos. Semilla mínima hasta que entre ESCO en la Fase 5.
 * Cada entrada mapea variantes → nombre canónico.
 */
const ALIASES: Record<string, string[]> = {
  // ── Tecnología (heredado) ──
  javascript: ["js", "ecmascript", "java script"],
  typescript: ["ts"],
  "power bi": ["powerbi", "microsoft power bi"],
  sap: ["sap erp", "sap r/3"],
  sql: ["structured query language"],
  python: [],
  react: ["react.js", "reactjs"],

  // ── Ofimática ──
  "microsoft excel": ["excel", "excel avanzado", "hoja de calculo", "hojas de calculo", "ms excel"],
  "microsoft word": ["word", "ms word"],
  "microsoft powerpoint": ["powerpoint", "power point", "powerppoint", "ppt"],
  "herramientas ofimaticas": [
    "ofimatica", "office", "microsoft office", "paquete office", "paquete de office",
    "herramientas office", "herramientas de office", "informatica basica",
  ],

  // ── Contact center y comercial: el grueso de las vacantes del portal ──
  "call center": [
    "callcenter", "contact center", "centro de llamadas", "centro de contacto",
    "bpo", "telemercadeo", "telemarketing", "televentas", "ventas telefonicas",
    "operario call center", "agente call center", "asesor call center",
  ],
  "servicio al cliente": [
    "atencion al cliente", "customer service", "servicio cliente", "servicio a clientes",
    "atencion y servicio al cliente", "atencion al usuario", "asesor de servicio",
    "agente de servicio al cliente", "consultor servicio a clientes", "sac",
    "soporte al cliente", "customer support",
  ],
  "atencion telefonica": [
    "llamadas telefonicas", "manejo de llamadas", "atencion de llamadas",
    "recepcion de llamadas", "gestion de llamadas", "llamadas",
  ],
  ventas: [
    "venta", "asesor comercial", "asesoria comercial", "gestion comercial",
    "cierre de ventas", "fuerza de ventas", "ejecutivo comercial", "cargos comerciales",
  ],
  "bases de datos": [
    "base de datos", "gestion de bases de datos", "manejo de bases de datos",
    "actualizacion de bases de datos", "crm",
  ],
  "prospeccion de clientes": ["prospectos", "consecucion de clientes", "captacion de clientes"],
  "seguimiento a clientes": ["seguimiento de clientes", "fidelizacion", "postventa", "post venta"],

  // ── Competencias blandas tal como las nombran las ofertas colombianas ──
  "comunicacion asertiva": ["comunicacion efectiva", "asertividad", "comunicacion verbal"],
  "escucha activa": ["capacidad de escucha", "escucha"],
  "orientacion al cliente": ["enfoque al cliente", "vocacion de servicio", "orientacion al servicio"],
  "orientacion al logro": [
    "orientacion a resultados", "orientada a resultados", "orientado a resultados",
    "cumplimiento de metas", "orientacion a metas", "enfoque a resultados", "logro de metas",
  ],
  "persuasion y negociacion": [
    "negociacion", "persuasion", "capacidad de negociacion", "poder de negociacion",
  ],
  "tolerancia a la presion": [
    "trabajo bajo presion", "manejo de presion", "resistencia a la presion",
    "tolerancia a la frustracion",
  ],
  proactividad: ["actitud proactiva", "iniciativa", "dinamismo", "actitud comercial"],
  "organizacion y seguimiento": ["organizacion", "seguimiento", "seguimiento de actividades"],
  "trabajo en equipo": ["teamwork", "colaboracion", "trabajo colaborativo"],
  liderazgo: ["leadership", "liderazgo de equipos", "manejo de personal"],
  adaptabilidad: ["adaptabilidad al cambio", "flexibilidad", "resiliencia"],

  // ── Administrativo y contable ──
  "recursos humanos": ["rrhh", "rh", "gestion humana", "talento humano"],
  contabilidad: ["accounting", "contable", "auxiliar contable", "procesos contables"],
  "manejo documental": [
    "gestion documental", "organizacion documental", "administracion documental",
    "archivo", "radicacion de documentos", "manejo de archivo",
  ],
  nomina: ["liquidacion de nomina", "seguridad social", "liquidacion de seguridad social"],
  facturacion: ["facturas", "elaboracion de facturas"],
  "manejo de caja": ["caja", "cajero", "arqueo de caja"],
  "elaboracion de reportes": ["reportes", "informes", "presentacion de reportes"],

  // ── Logística y operaciones ──
  logistica: ["logistics", "cadena de suministro", "supply chain"],
  "gestion de inventarios": ["inventarios", "control de inventario", "manejo de inventario"],

  // ── Idiomas ──
  ingles: ["english", "idioma ingles"],
  espanol: ["spanish", "castellano", "idioma espanol"],
};

/**
 * Taxonomía de género/especie — nivel 3 de la cascada de §9.2.
 *
 * Cada clave es un término amplio; sus valores son términos concretos que lo
 * satisfacen. Sin esto, una oferta que pide "herramientas ofimáticas" no ve a
 * la candidata que declaró Word, Excel y PowerPoint a nivel avanzado: el
 * solapamiento de tokens entre "ofimatica" y "excel" es exactamente cero.
 */
const TAXONOMY: Record<string, string[]> = {
  "herramientas ofimaticas": [
    "microsoft excel", "microsoft word", "microsoft powerpoint", "outlook",
    "google sheets", "google docs",
  ],
  "call center": ["atencion telefonica", "servicio al cliente", "ventas"],
  ventas: ["persuasion y negociacion", "prospeccion de clientes", "seguimiento a clientes"],
  "servicio al cliente": ["atencion telefonica", "escucha activa", "orientacion al cliente"],
  "bases de datos": ["microsoft excel", "sql", "crm"],
  contabilidad: ["nomina", "facturacion", "manejo de caja"],
  logistica: ["gestion de inventarios"],
  "recursos humanos": ["nomina", "seleccion de personal"],
};

/** Índice especie → géneros que satisface. Construido una sola vez. */
const TAXONOMY_INDEX: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const [broad, specifics] of Object.entries(TAXONOMY)) {
    for (const specific of specifics) {
      const entry = index.get(specific) ?? new Set<string>();
      entry.add(broad);
      index.set(specific, entry);
    }
  }
  return index;
})();

/**
 * Una habilidad concreta prueba el término amplio casi por completo: quien
 * maneja Excel maneja herramientas ofimáticas.
 */
const SPECIFIC_SATISFIES_BROAD = 0.9;

/**
 * El sentido inverso vale menos: declarar "ofimática" no demuestra Excel en
 * particular. Se marca como parcial para que lo confirme una persona.
 */
const BROAD_SATISFIES_SPECIFIC = 0.6;

/** ¿La habilidad del candidato cubre el requisito por taxonomía? 0 si no. */
function taxonomyScore(requirementCanonical: string, candidateCanonical: string): number {
  if (TAXONOMY_INDEX.get(candidateCanonical)?.has(requirementCanonical)) {
    return SPECIFIC_SATISFIES_BROAD;
  }
  if (TAXONOMY_INDEX.get(requirementCanonical)?.has(candidateCanonical)) {
    return BROAD_SATISFIES_SPECIFIC;
  }
  return 0;
}

/** Índice inverso alias → canónico, construido una sola vez. */
const ALIAS_INDEX: Map<string, string> = (() => {
  const index = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(ALIASES)) {
    index.set(canonical, canonical);
    for (const variant of variants) index.set(variant, canonical);
  }
  return index;
})();

/** Palabras sin valor discriminante al comparar habilidades. */
const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "en", "y", "con", "para", "a", "al",
  "un", "una", "of", "the", "and", "in", "for", "with", "avanzado", "basico",
  "intermedio", "nivel", "conocimiento", "conocimientos", "manejo", "uso",
]);

/**
 * Normaliza un texto para comparar: minúsculas, sin acentos, sin puntuación.
 * Sin esto, "Logística" y "logistica" serían habilidades distintas.
 */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    // Marcas diacríticas combinantes, con escapes explícitos: escribirlas
    // literalmente deja el fuente ilegible e imposible de revisar en un diff
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resuelve un nombre a su forma canónica conocida, si existe un alias.
 *
 * Se intenta dos veces: con el texto normalizado tal cual y con el texto
 * reducido a sus tokens significativos. Lo segundo es lo que hace que
 * "Manejo básico de herramientas ofimáticas" —tal como lo escribe una oferta
 * real— llegue al alias "herramientas ofimaticas" en vez de quedarse sin
 * canónico por culpa del andamiaje verbal que lo rodea.
 */
export function toCanonical(raw: string): string {
  const normalized = normalizeText(raw);
  const direct = ALIAS_INDEX.get(normalized);
  if (direct) return direct;

  const significant = tokenize(raw).join(" ");
  return ALIAS_INDEX.get(significant) ?? normalized;
}

function tokenize(raw: string): string[] {
  return normalizeText(raw)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Solapamiento de tokens (índice de Jaccard asimétrico): qué proporción de los
 * tokens del requisito aparece en la habilidad del candidato.
 *
 * Asimétrico a propósito: "Excel" contra "Excel avanzado con tablas dinámicas"
 * debe puntuar alto, porque el requisito está totalmente cubierto aunque el
 * candidato describa más cosas.
 */
export function tokenOverlap(requirement: string, candidate: string): number {
  return weightedOverlap(tokenize(requirement), tokenize(candidate));
}

/**
 * Núcleo de la comparación: qué proporción del *peso informativo* del
 * requisito está cubierta por el texto del candidato.
 *
 * Dos cambios frente a contar tokens iguales:
 *
 *  - La coincidencia es morfológica (`tokensMatch`), no literal. "clientes"
 *    cubre "cliente" y "negociación" cubre "negociar".
 *  - Cada token pesa según cuánto discrimina. Un requisito como "Cumplir con
 *    las metas comerciales establecidas" es en su mayoría andamiaje: si
 *    "cumplir" y "establecidas" pesan lo mismo que "metas" y "comerciales",
 *    el denominador se infla y ningún candidato puede superar el umbral.
 */
function weightedOverlap(reqTokens: string[], candTokens: string[]): number {
  if (reqTokens.length === 0) return 0;

  let matched = 0;
  let total = 0;

  for (const token of reqTokens) {
    const weight = tokenWeight(token);
    total += weight;
    if (candTokens.some((candidate) => tokensMatch(token, candidate))) matched += weight;
  }

  return total === 0 ? 0 : matched / total;
}

export interface SkillMatch {
  matchType: MatchType;
  /** 0..1 */
  score: number;
  candidateIndex: number;
}

/**
 * Empareja un requisito con la mejor habilidad del candidato.
 *
 * Devuelve `not_found` si nada supera el umbral. Quien llama decide si eso es
 * una carencia real o simplemente ausencia de evidencia (spec §8).
 */
export function matchSkill(
  requirement: string,
  candidateSkills: Array<{ rawName: string; canonicalName: string }>,
  /**
   * Nombre normalizado del requisito, tal como lo devolvió el extractor.
   *
   * Importa mucho: la IA convierte "Manejo intermedio de Excel o Google Sheets"
   * en canonical_name "Excel". Comparar solo contra la frase larga hace
   * imposible cualquier coincidencia — se estaría tirando a la basura la
   * normalización que ya hizo el extractor.
   */
  requirementCanonical?: string
): SkillMatch {
  // Se prueban ambas formas del requisito: la literal y la normalizada
  const reqVariants = Array.from(
    new Set([requirement, requirementCanonical].filter((v): v is string => !!v?.trim()))
  );

  let best: SkillMatch = { matchType: "not_found", score: 0, candidateIndex: -1 };

  candidateSkills.forEach((skill, index) => {
    // Y ambas formas de la habilidad del candidato
    const candVariants = Array.from(
      new Set([skill.rawName, skill.canonicalName].filter((v) => !!v?.trim()))
    );

    for (const reqText of reqVariants) {
      const reqNormalized = normalizeText(reqText);
      const reqCanonical = toCanonical(reqText);

      for (const candText of candVariants) {
        const candNormalized = normalizeText(candText);
        const candCanonical = toCanonical(candText);

        // 1. Coincidencia exacta
        if (reqNormalized && reqNormalized === candNormalized) {
          best = { matchType: "exact", score: 1, candidateIndex: index };
          return;
        }

        // 2. Mismo canónico vía alias
        if (best.matchType !== "exact" && reqCanonical && reqCanonical === candCanonical) {
          best = { matchType: "canonical_alias", score: 1, candidateIndex: index };
          return;
        }

        // 3. Taxonomía: género ↔ especie
        const byTaxonomy = taxonomyScore(reqCanonical, candCanonical);
        if (byTaxonomy > best.score) {
          best = { matchType: "taxonomy_related", score: byTaxonomy, candidateIndex: index };
        }

        // 4. Solapamiento parcial de tokens
        if (best.score < 1) {
          const overlap = tokenOverlap(reqText, candText);
          if (overlap >= PARTIAL_MATCH_THRESHOLD && overlap > best.score) {
            best = {
              matchType: overlap >= 0.99 ? "exact" : "partial",
              score: overlap,
              candidateIndex: index,
            };
          }
        }
      }
    }
  });

  return best;
}

/**
 * Similitud entre dos textos libres (responsabilidades, cargos).
 * En V1 es solapamiento de tokens; en la Fase 5 pasará a embeddings (§16).
 */
export function textSimilarity(a: string, b: string): number {
  return weightedOverlap(tokenize(a), tokenize(b));
}

/**
 * Cobertura de un requisito contra VARIOS textos a la vez, sumando lo que
 * aporta cada uno.
 *
 * Comparar el requisito contra cada frase por separado y quedarse con la mejor
 * —lo que hacía el motor— pierde toda la evidencia repartida: "Gestionar bases
 * de datos y mantener actualizada la información de los clientes" se cubre en
 * un CV real con dos frases distintas del mismo cargo. Ninguna de las dos
 * supera el umbral por sí sola; juntas describen exactamente el requisito.
 *
 * Se aplica dentro de un mismo puesto de trabajo, no sobre el CV entero: la
 * pregunta que responde un reclutador es "¿hizo esto en algún cargo?", no
 * "¿aparecen estas palabras en algún lugar de la hoja de vida?".
 */
export function coverageAcrossTexts(requirement: string, texts: string[]): number {
  const pooled = texts.flatMap((text) => tokenize(text));
  return weightedOverlap(tokenize(requirement), pooled);
}

/**
 * Similitud entre dos conceptos, no entre dos cadenas.
 *
 * Antes de comparar palabras se intenta resolver ambos textos a su forma
 * canónica y a la taxonomía. Sin esto, "Call Center" y "Agente de Servicio al
 * Cliente" tienen CERO tokens en común y el motor concluye que la persona no
 * ha trabajado nunca en un cargo parecido — cuando es exactamente su cargo.
 */
export function conceptSimilarity(a: string, b: string): number {
  return conceptMatch(a, b).score;
}

/**
 * Cómo se resolvió la equivalencia entre dos conceptos.
 *
 * Importa quién lo dice, no solo cuánto puntúa. Un `canonical` o un `taxonomy`
 * son afirmaciones CURADAS: alguien escribió a mano que "telemercadeo" es call
 * center, o que quien vende ejerce persuasión. Un `lexical` es una conjetura
 * por parecido de palabras.
 *
 * La diferencia tiene consecuencias en el cálculo: a un valor lexical hay que
 * aplicarle la curva de cumplimiento (ver `scoring/coverage.ts`), porque un
 * solapamiento de 0,6 significa "seguramente lo cumple". A un valor curado NO:
 * el 0,6 de la taxonomía ya es el juicio final —"declarar ventas no demuestra
 * negociación en particular"— y pasarlo por la curva lo convertiría en un 1,0,
 * afirmando justo lo que la taxonomía dice que no se puede afirmar.
 */
export interface ConceptMatch {
  score: number;
  via: "canonical" | "taxonomy" | "lexical";
}

export function conceptMatch(a: string, b: string): ConceptMatch {
  if (!a?.trim() || !b?.trim()) return { score: 0, via: "lexical" };

  const canonicalA = toCanonical(a);
  const canonicalB = toCanonical(b);

  if (canonicalA === canonicalB) return { score: 1, via: "canonical" };

  const byTaxonomy = taxonomyScore(canonicalA, canonicalB);
  const byText = textSimilarity(a, b);

  return byTaxonomy >= byText
    ? { score: byTaxonomy, via: "taxonomy" }
    : { score: byText, via: "lexical" };
}

/** Expuesto para los tests de morfología. */
export { stemToken, tokensMatch };
