import type { JobProfile } from "@/lib/ai/schemas/job-profile";
import type { ContractType, JobModality } from "@/lib/types/database";

/**
 * Traduce el CanonicalJobProfile (vocabulario de la spec, en inglés) a los
 * campos que ya usa la tabla `jobs` (vocabulario del producto, en español).
 *
 * El perfil canónico y la oferta conviven: el primero es la fuente estructurada
 * para el matching, la segunda es lo que ve el público. Ninguna sustituye a la
 * otra, y por eso `jobs` no cambia de forma.
 */

const WORK_MODE_MAP: Record<JobProfile["location"]["work_mode"], JobModality | null> = {
  onsite: "presencial",
  hybrid: "hibrido",
  remote: "remoto",
  unspecified: null,
};

const EMPLOYMENT_TYPE_MAP: Record<JobProfile["employment_type"], ContractType | null> = {
  full_time: "tiempo_completo",
  part_time: "tiempo_parcial",
  temporary: "temporal",
  contract: "por_obra",
  internship: "tiempo_parcial",
  unspecified: null,
};

export function mapWorkMode(profile: JobProfile): JobModality | null {
  return WORK_MODE_MAP[profile.location.work_mode];
}

export function mapEmploymentType(profile: JobProfile): ContractType | null {
  return EMPLOYMENT_TYPE_MAP[profile.employment_type];
}

/** Compone la descripción pública a partir del resumen y las responsabilidades. */
export function buildDescription(profile: JobProfile): string {
  const parts: string[] = [];

  if (profile.summary?.trim()) parts.push(profile.summary.trim());

  if (profile.responsibilities.length > 0) {
    parts.push(
      "**Responsabilidades**\n" +
        profile.responsibilities.map((r) => `- ${r.text}`).join("\n")
    );
  }

  return parts.join("\n\n");
}

/** Compone los requisitos públicos a partir de las secciones del perfil canónico. */
export function buildRequirements(profile: JobProfile): string {
  const parts: string[] = [];

  const mustHave = profile.required_skills.filter((s) => s.importance !== "preferred");
  const preferred = profile.required_skills.filter((s) => s.importance === "preferred");

  if (mustHave.length > 0) {
    parts.push(
      "**Requisitos**\n" +
        mustHave
          .map((s) => `- ${s.raw_name}${s.minimum_years ? ` (${s.minimum_years}+ años)` : ""}`)
          .join("\n")
    );
  }

  const exp = profile.experience_requirements;
  if (exp.minimum_years !== null) {
    parts.push(`**Experiencia**\n- Mínimo ${exp.minimum_years} años`);
  }

  if (profile.education_requirements.length > 0) {
    parts.push(
      "**Formación**\n" +
        profile.education_requirements
          .map((e) => `- ${[e.level, e.field].filter(Boolean).join(" en ")}`)
          .join("\n")
    );
  }

  if (profile.languages.length > 0) {
    parts.push(
      "**Idiomas**\n" +
        profile.languages
          .map((l) => `- ${l.language}${l.minimum_level ? ` (${l.minimum_level})` : ""}`)
          .join("\n")
    );
  }

  if (profile.certifications.length > 0) {
    parts.push(
      "**Certificaciones**\n" + profile.certifications.map((c) => `- ${c.name}`).join("\n")
    );
  }

  if (preferred.length > 0) {
    parts.push("**Deseable**\n" + preferred.map((s) => `- ${s.raw_name}`).join("\n"));
  }

  return parts.join("\n\n");
}

export function buildBenefits(profile: JobProfile): string {
  if (profile.benefits.length === 0) return "";
  return profile.benefits.map((b) => `- ${b}`).join("\n");
}

/**
 * El salario solo se traslada si el documento lo expresaba en periodo mensual
 * o sin especificar. Convertir un salario anual a mensual dividiendo entre 12
 * sería inventar un dato que el documento no dio (spec §6, regla crítica).
 */
export function mapSalary(profile: JobProfile): { min: number | null; max: number | null } {
  const { min, max, period } = profile.salary;
  if (period !== "month" && period !== "unspecified") return { min: null, max: null };
  return { min, max };
}
