import type { TalentQuery } from "@/lib/ai/schemas/talent-query";
import type { JobRequirements } from "@/lib/matching/types";
import { normalizeTerm } from "@/lib/search/normalize";

/**
 * Traduce la consulta del reclutador a la entrada del motor de matching.
 *
 * Aquí está la idea central del módulo: `calculateMatch()` no sabe de dónde
 * salen sus requisitos. Una frase de búsqueda se convierte en una "vacante
 * virtual" y el motor la evalúa con la misma aritmética, la misma evidencia y
 * las mismas protecciones que una oferta real. Cero código nuevo de scoring.
 *
 * Función PURA: sin red, sin base de datos, sin reloj.
 */
export function queryToRequirements(query: TalentQuery): JobRequirements {
  return {
    // Cadena vacía y no un texto de relleno: el motor solo compara cargos
    // cuando hay un cargo real que comparar (scoring/experience.ts).
    title: query.interpreted_role?.trim() ?? "",

    skills: query.skills.map((s) => ({
      rawName: s.raw_name,
      canonicalName: s.canonical_name,
      category: s.category,
      importance: s.importance,
      // Una frase de búsqueda no ata años a una habilidad concreta; los años
      // que mencione son del perfil completo, no de cada skill por separado.
      minimumYears: null,
    })),

    // Una búsqueda no describe responsabilidades del puesto. Dejarlo vacío
    // saca esa señal del denominador en vez de puntuarla como cero (§12.2).
    responsibilities: [],

    experience: {
      minimumYears: query.experience.minimum_years,
      relevantRoles: query.experience.relevant_roles,
      industries: query.experience.industries,
    },

    education: query.education.map((e) => ({
      level: e.level,
      field: e.field,
      importance: e.importance,
    })),

    certifications: query.certifications.map((c) => ({
      name: c.name,
      importance: c.importance,
    })),

    languages: query.languages.map((l) => ({
      language: l.language,
      minimumLevel: l.minimum_level,
      importance: l.importance,
    })),

    // Una búsqueda NUNCA genera requisitos excluyentes. Un knockout descarta de
    // forma tajante, y eso solo puede nacer de una oferta revisada por una
    // persona, jamás de una frase escrita al vuelo en una caja de texto.
    knockouts: [],
  };
}

export interface RecallParams {
  terms: string[];
  city: string | null;
  minYears: number | null;
}

/** Longitud mínima de un término para que aporte señal en el recall. */
const MIN_TERM_LENGTH = 3;

/**
 * Extrae los parámetros del prefiltro SQL.
 *
 * Deliberadamente generoso: el recall solo decide a quién MIRA el motor, no a
 * quién descarta. Perder aquí a alguien que sí encajaba es el fallo más caro
 * del módulo, así que ante la duda entra.
 */
export function queryToRecallParams(query: TalentQuery): RecallParams {
  const terms = new Set<string>();

  const add = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = normalizeTerm(value);
    if (normalized.length >= MIN_TERM_LENGTH) terms.add(normalized);
  };

  add(query.interpreted_role);
  for (const s of query.skills) {
    add(s.canonical_name);
    add(s.raw_name);
  }
  for (const role of query.experience.relevant_roles) add(role);
  for (const industry of query.experience.industries) add(industry);
  for (const c of query.certifications) add(c.name);
  for (const e of query.education) add(e.field);
  for (const l of query.languages) add(l.language);

  return {
    terms: Array.from(terms),
    city: query.location.city?.trim() || null,
    minYears: query.experience.minimum_years,
  };
}

/** Resumen de un criterio, para pintar los chips editables de la UI. */
export interface QueryChip {
  id: string;
  label: string;
  detail: string | null;
  kind: "skill" | "experience" | "role" | "industry" | "education" | "certification" | "language" | "location";
  importance: "must_have" | "required" | "preferred" | null;
}

/** Convierte la consulta en chips. El orden es el de lectura, no el del schema. */
export function queryToChips(query: TalentQuery): QueryChip[] {
  const chips: QueryChip[] = [];

  if (query.interpreted_role) {
    chips.push({ id: "role", label: query.interpreted_role, detail: "cargo", kind: "role", importance: null });
  }

  query.skills.forEach((s, i) => {
    chips.push({
      id: `skill:${i}`,
      label: s.raw_name || s.canonical_name,
      detail: IMPORTANCE_LABEL[s.importance],
      kind: "skill",
      importance: s.importance,
    });
  });

  if (query.experience.minimum_years !== null) {
    chips.push({
      id: "experience:years",
      label: `≥${query.experience.minimum_years} años`,
      detail: "experiencia",
      kind: "experience",
      importance: null,
    });
  }

  query.experience.relevant_roles.forEach((role, i) => {
    chips.push({ id: `role:${i}`, label: role, detail: "cargo previo", kind: "role", importance: null });
  });

  query.experience.industries.forEach((industry, i) => {
    chips.push({ id: `industry:${i}`, label: industry, detail: "sector", kind: "industry", importance: null });
  });

  query.education.forEach((e, i) => {
    const label = [e.level, e.field].filter(Boolean).join(" en ");
    if (label) {
      chips.push({
        id: `education:${i}`,
        label,
        detail: IMPORTANCE_LABEL[e.importance],
        kind: "education",
        importance: e.importance,
      });
    }
  });

  query.certifications.forEach((c, i) => {
    chips.push({
      id: `certification:${i}`,
      label: c.name,
      detail: IMPORTANCE_LABEL[c.importance],
      kind: "certification",
      importance: c.importance,
    });
  });

  query.languages.forEach((l, i) => {
    chips.push({
      id: `language:${i}`,
      label: [l.language, l.minimum_level].filter(Boolean).join(" "),
      detail: IMPORTANCE_LABEL[l.importance],
      kind: "language",
      importance: l.importance,
    });
  });

  if (query.location.city) {
    chips.push({
      id: "location:city",
      label: query.location.city,
      detail: "ciudad",
      kind: "location",
      importance: null,
    });
  }

  return chips;
}

const IMPORTANCE_LABEL: Record<"must_have" | "required" | "preferred", string> = {
  must_have: "indispensable",
  required: "requerido",
  preferred: "deseable",
};

/**
 * Devuelve la consulta sin el criterio indicado. Inmutable: la UI conserva la
 * consulta original para poder deshacer.
 */
export function removeChip(query: TalentQuery, chipId: string): TalentQuery {
  const [kind, rawIndex] = chipId.split(":");
  const index = Number(rawIndex);

  const without = <T,>(list: T[]) => list.filter((_, i) => i !== index);

  switch (kind) {
    case "role":
      return Number.isNaN(index)
        ? { ...query, interpreted_role: null }
        : { ...query, experience: { ...query.experience, relevant_roles: without(query.experience.relevant_roles) } };
    case "skill":
      return { ...query, skills: without(query.skills) };
    case "experience":
      return { ...query, experience: { ...query.experience, minimum_years: null } };
    case "industry":
      return { ...query, experience: { ...query.experience, industries: without(query.experience.industries) } };
    case "education":
      return { ...query, education: without(query.education) };
    case "certification":
      return { ...query, certifications: without(query.certifications) };
    case "language":
      return { ...query, languages: without(query.languages) };
    case "location":
      return { ...query, location: { ...query.location, city: null } };
    default:
      return query;
  }
}
