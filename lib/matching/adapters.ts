import type { CandidateProfile } from "@/lib/ai/schemas/candidate-profile";
import type { JobProfile } from "@/lib/ai/schemas/job-profile";
import type { CandidateEvidence, JobRequirements } from "@/lib/matching/types";

/**
 * Traduce los perfiles canónicos que produce la IA a las entradas del motor.
 *
 * Esta frontera existe a propósito: `lib/matching/` no debe conocer los
 * schemas del LLM. Si mañana cambia el CanonicalCandidateProfile, se ajusta
 * este archivo y el motor —con toda su batería de tests— sigue intacto.
 *
 * También es el punto donde se aplica la exclusión de atributos protegidos
 * (§29): nombre, contacto e institución educativa simplemente no se copian.
 */

export function toJobRequirements(profile: JobProfile): JobRequirements {
  return {
    title: profile.title,

    skills: profile.required_skills.map((s) => ({
      rawName: s.raw_name,
      canonicalName: s.canonical_name,
      category: s.category,
      importance: s.importance,
      minimumYears: s.minimum_years,
    })),

    responsibilities: profile.responsibilities.map((r) => r.text),

    experience: {
      minimumYears: profile.experience_requirements.minimum_years,
      relevantRoles: profile.experience_requirements.relevant_roles,
      industries: profile.experience_requirements.industries,
    },

    education: profile.education_requirements.map((e) => ({
      level: e.level,
      field: e.field,
      importance: e.importance,
    })),

    certifications: profile.certifications.map((c) => ({
      name: c.name,
      importance: c.importance,
    })),

    languages: profile.languages.map((l) => ({
      language: l.language,
      minimumLevel: l.minimum_level,
      importance: l.importance,
    })),

    knockouts: profile.knockout_requirements,

    // Solo ciudad, departamento y modalidad. Es un requisito del puesto para
    // un cargo presencial, no un dato personal: la dirección exacta nunca
    // entra al motor (§29).
    location: profile.location.city
      ? {
          city: profile.location.city,
          region: profile.location.region,
          workMode: profile.location.work_mode,
        }
      : null,
  };
}

/**
 * Umbral por debajo del cual un perfil se considera demasiado escueto para
 * puntuarlo con confianza. Deriva en banda `insufficient_data` (§12.3).
 */
const SPARSE_SKILL_THRESHOLD = 3;

export function toCandidateEvidence(profile: CandidateProfile): CandidateEvidence {
  const skills = profile.skills.map((s) => ({
    rawName: s.raw_name,
    canonicalName: s.canonical_name,
    category: s.category,
    yearsEstimate: s.years_estimate,
    evidence: s.evidence[0]?.text ?? "",
    confidence: s.confidence,
  }));

  const experience = profile.experience.map((e) => ({
    title: e.title,
    company: e.company,
    responsibilities: e.responsibilities,
    achievements: e.achievements,
    skills: e.skills,
  }));

  // Un CV del que apenas se extrajo nada no debe puntuarse como si fuera
  // información fiable: es "no sabemos", no "mal candidato" (§20)
  const isSparse =
    skills.length < SPARSE_SKILL_THRESHOLD &&
    experience.length === 0 &&
    profile.education.length === 0;

  return {
    skills,
    transferableSkills: profile.transferable_skills.map((t) => ({
      name: t.name,
      evidence: t.evidence[0]?.text ?? "",
      confidence: t.confidence,
    })),
    experience,
    totalYearsExperience: profile.total_years_experience,

    // Se copian degree, field y nivel — NUNCA la institución (§29): convertir
    // la universidad en medida de prestigio es exactamente el sesgo a evitar
    education: profile.education.map((e) => ({
      degree: e.degree,
      field: e.field,
      level: e.degree,
    })),

    certifications: profile.certifications.map((c) => c.name),
    languages: profile.languages.map((l) => ({ language: l.language, level: l.level })),

    // La CIUDAD es lo único que se copia del bloque de contacto, y solo para
    // contrastarla con la ciudad de la vacante. Nombre, correo, teléfono y
    // dirección siguen sin cruzar esta frontera (§29).
    city: profile.contact.city,

    // Titular, resumen y proyectos: donde muchos CV declaran su especialidad
    // sin repetirla en la lista de habilidades
    narrative: [
      profile.headline,
      profile.professional_summary,
      ...profile.projects.map((p) => [p.name, p.description].filter(Boolean).join(". ")),
      ...profile.education.map((e) => [e.degree, e.field].filter(Boolean).join(" en ")),
    ].filter((text): text is string => !!text?.trim()),

    extractionConfidence: profile.profile_metadata.overall_confidence,
    isSparse,
  };
}
