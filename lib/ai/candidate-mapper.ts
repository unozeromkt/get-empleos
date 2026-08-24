import type { CandidateProfile } from "@/lib/ai/schemas/candidate-profile";
import type { EducationLevel } from "@/lib/types/database";

/**
 * Traduce el CanonicalCandidateProfile a los campos planos de `candidates`.
 *
 * REGLA DE PRECEDENCIA (spec §33, decidida con el cliente):
 * la IA SOLO rellena lo que está vacío. Lo que el candidato escribió a mano se
 * respeta siempre. Donde la IA discrepa de un valor existente, no se pisa: se
 * devuelve como sugerencia para que la persona elija.
 *
 * El dato confirmado por el ser humano gana sobre la inferencia. Siempre.
 */

/** Los 6 campos que determinan `profile_complete` (lib/actions/candidates.ts:66). */
export interface FlatCandidateFields {
  full_name: string | null;
  /** Junto con full_name y cv_url, determina si el perfil queda completo para postularse. */
  phone: string | null;
  city: string | null;
  education_level: EducationLevel | null;
  career: string | null;
  years_experience: number | null;
  availability: string | null;
  linkedin_url: string | null;
  summary: string | null;
  skills: string[];
  languages: string[];
}

/** Un campo donde la IA propone algo distinto a lo que ya había. */
export interface FieldSuggestion {
  field: keyof FlatCandidateFields;
  label: string;
  currentValue: string;
  suggestedValue: string;
}

export interface MappingResult {
  /** Solo los campos que estaban vacíos y la IA pudo rellenar. */
  filled: Partial<FlatCandidateFields>;
  /** Discrepancias: la persona decide. Nunca se aplican solas. */
  suggestions: FieldSuggestion[];
}

/** Un valor cuenta como "vacío" si es null, cadena en blanco o array sin elementos. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Mapea el grado académico del CV al catálogo cerrado de `education_level`.
 * Devuelve null si no hay correspondencia clara: preferimos dejarlo vacío a
 * encasillar mal la formación de alguien.
 */
export function mapEducationLevel(profile: CandidateProfile): EducationLevel | null {
  const text = profile.education
    .map((e) => `${e.degree} ${e.field ?? ""}`)
    .join(" ")
    .toLowerCase();

  if (!text.trim()) return null;

  // Orden descendente: gana siempre el grado más alto que aparezca
  if (/\bdoctorad|\bph\.?d|\bdoctor\b/.test(text)) return "doctorado";
  if (/maestr|magíst|magist|\bmsc\b|master/.test(text)) return "maestria";
  if (/especializa|especialist/.test(text)) return "especialista";
  if (/tecnólog|tecnolog/.test(text)) return "tecnologo";
  if (/técnic|tecnic/.test(text)) return "tecnico";
  if (/bachill/.test(text)) return "bachiller";
  // "Ingeniería", "Licenciatura", "Profesional en…" y similares
  if (/ingenier|licenciat|profesional|pregrado|universitar|administra|contadur|psicolog|derecho|abogac/.test(text)) {
    return "profesional";
  }

  return null;
}

/**
 * Normaliza la ciudad al formato que usa el resto de la plataforma.
 *
 * Los CV suelen escribir "Medellín, Antioquia" o "Bogotá D.C. - Cundinamarca",
 * pero `profiles.city` alimenta los filtros de ofertas y espera solo la ciudad.
 * Guardar el departamento pegado rompería esos filtros en silencio.
 */
export function normalizeCity(raw: string | null): string | null {
  if (!raw?.trim()) return null;

  const city = raw
    .split(/[,\-–|/]/)[0] // corta en el primer separador
    // Anclado al final: un \b tras "D.C." no casa, porque después del punto
    // no hay transición de palabra a no-palabra
    .replace(/[\s,]*\b(d\.?\s*c\.?|distrito\s+capital)\s*$/i, "")
    .trim();

  return city || null;
}

/** La carrera se toma del título de mayor nivel disponible. */
export function mapCareer(profile: CandidateProfile): string | null {
  const withField = profile.education.find((e) => e.field?.trim());
  if (withField?.field) return withField.field.trim();

  const withDegree = profile.education.find((e) => e.degree?.trim());
  return withDegree?.degree?.trim() ?? null;
}

/**
 * Años de experiencia. Solo se usa el valor que la IA pudo calcular de fechas
 * concretas; no se estima a partir de la cantidad de empleos ni nada parecido.
 */
export function mapYearsExperience(profile: CandidateProfile): number | null {
  if (profile.total_years_experience === null) return null;
  const years = Math.round(profile.total_years_experience);
  return years >= 0 && years <= 60 ? years : null;
}

/** Habilidades con confianza suficiente para mostrarlas como propias del candidato. */
export function mapSkills(profile: CandidateProfile, minConfidence = 0.5): string[] {
  const names = profile.skills
    .filter((s) => s.confidence >= minConfidence && s.category !== "language")
    .map((s) => s.raw_name.trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

export function mapLanguages(profile: CandidateProfile): string[] {
  const names = profile.languages.map((l) => l.language.trim()).filter(Boolean);
  return Array.from(new Set(names));
}

/**
 * Aplica la regla de precedencia sobre el perfil actual del candidato.
 *
 * @param current  Lo que el candidato tiene guardado hoy
 * @param profile  Lo que la IA extrajo del CV
 */
export function mapProfileToFlatFields(
  current: Partial<FlatCandidateFields>,
  profile: CandidateProfile
): MappingResult {
  const filled: Partial<FlatCandidateFields> = {};
  const suggestions: FieldSuggestion[] = [];

  function consider<K extends keyof FlatCandidateFields>(
    field: K,
    label: string,
    extracted: FlatCandidateFields[K] | null,
    format: (value: NonNullable<FlatCandidateFields[K]>) => string = String
  ) {
    if (isEmpty(extracted)) return;

    const currentValue = current[field];

    // Campo vacío → la IA lo rellena
    if (isEmpty(currentValue)) {
      filled[field] = extracted as FlatCandidateFields[K];
      return;
    }

    // Campo con valor → nunca se pisa. Si la IA discrepa, se pregunta.
    const currentText = format(currentValue as NonNullable<FlatCandidateFields[K]>);
    const extractedText = format(extracted as NonNullable<FlatCandidateFields[K]>);

    if (currentText.trim().toLowerCase() !== extractedText.trim().toLowerCase()) {
      suggestions.push({
        field,
        label,
        currentValue: currentText,
        suggestedValue: extractedText,
      });
    }
  }

  consider("full_name", "Nombre completo", profile.contact.full_name);
  consider("phone", "Teléfono", profile.contact.phone);
  consider("city", "Ciudad", normalizeCity(profile.contact.city));
  consider("linkedin_url", "LinkedIn", profile.contact.linkedin_url);
  consider("summary", "Resumen profesional", truncateSummary(profile));
  consider("education_level", "Nivel educativo", mapEducationLevel(profile));
  consider("career", "Carrera o área de estudio", mapCareer(profile));
  consider("years_experience", "Años de experiencia", mapYearsExperience(profile));

  // Listas: se fusionan en lugar de reemplazar. Quitarle a alguien una
  // habilidad que declaró a mano sería destruir información suya.
  const extractedSkills = mapSkills(profile);
  if (extractedSkills.length > 0) {
    const merged = mergeUnique(current.skills ?? [], extractedSkills);
    if (merged.length !== (current.skills ?? []).length) filled.skills = merged;
  }

  const extractedLanguages = mapLanguages(profile);
  if (extractedLanguages.length > 0) {
    const merged = mergeUnique(current.languages ?? [], extractedLanguages);
    if (merged.length !== (current.languages ?? []).length) filled.languages = merged;
  }

  return { filled, suggestions };
}

/** `candidates.summary` tiene un CHECK de 500 caracteres en la base de datos. */
function truncateSummary(profile: CandidateProfile): string | null {
  const text = profile.professional_summary ?? profile.headline;
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  return trimmed.length <= 500 ? trimmed : `${trimmed.slice(0, 497)}...`;
}

/** Fusiona sin duplicar, ignorando mayúsculas pero conservando la grafía original. */
function mergeUnique(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((v) => v.trim().toLowerCase()));
  const result = [...existing];

  for (const value of incoming) {
    const key = value.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(value.trim());
    }
  }

  return result;
}
