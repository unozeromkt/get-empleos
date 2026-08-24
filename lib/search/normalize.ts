/**
 * Normalización de texto de búsqueda.
 *
 * REPLICA EXACTA de `public.search_normalize(text)` (migración 019): minúsculas
 * y sin tildes. Si una de las dos cambia, la otra tiene que cambiar igual — de
 * lo contrario los términos de la consulta dejan de casar con el índice.
 */

/** Marcas diacríticas combinantes que deja NFD. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036F]", "g");

/**
 * Caracteres invisibles y de control. Se construye con escapes explícitos a
 * propósito: escribirlos literalmente vuelve el archivo imposible de revisar
 * en un diff (mismo criterio que `lib/ai/sanitize.ts`).
 */
const INVISIBLE_CHARS = new RegExp(
  [
    "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
    "[\\u200B-\\u200F]",
    "[\\u202A-\\u202E]",
    "[\\u2060-\\u2064]",
    "\\uFEFF",
  ].join("|"),
  "g"
);

export function normalizeTerm(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase().trim();
}

/**
 * Limpia la consulta antes de enviarla al modelo.
 *
 * La escribe un admin, así que el riesgo de inyección es bajo, pero la regla de
 * la spec §26 no admite excepciones por origen: el texto de un usuario nunca se
 * concatena en crudo dentro de un prompt.
 */
export function sanitizeQuery(raw: string, maxChars: number): string {
  return raw
    .normalize("NFKC")
    .replace(INVISIBLE_CHARS, "")
    .replace(/<<<\/?[A-Z_]+>>>/g, "") // que la consulta no falsifique los delimitadores
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

/** Delimita la consulta para que el modelo no la confunda con instrucciones. */
export function wrapQuery(sanitized: string): string {
  return `<<<SEARCH_QUERY>>>\n${sanitized}\n<<<END_SEARCH_QUERY>>>`;
}
