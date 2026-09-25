import type { JobProfile } from "@/lib/ai/schemas/job-profile";
import type { JobImprovement } from "@/lib/ai/schemas/job-improvement";
import { normalizeText } from "@/lib/matching/normalize/skill-normalizer";

export type JobQualityIssue = JobImprovement["issues"][number];

export interface JobQualityAnalysis {
  score: number;
  label: "Lista para revisar" | "Conviene mejorar" | "Información insuficiente";
  issues: JobQualityIssue[];
}

const PROTECTED_PATTERN =
  /\b(hombre|mujer|masculino|femenino|edad|estado civil|solter[oa]|casad[oa]|embarazo|religion|nacionalidad)\b/i;

/**
 * Diagnóstico instantáneo y determinístico. No bloquea la publicación ni hace
 * llamadas de red: sirve para mostrar pocas alertas útiles apenas abre la vista.
 */
export function analyzeJobProfileQuality(profile: JobProfile): JobQualityAnalysis {
  const issues: JobQualityIssue[] = [];
  let penalty = 0;

  const add = (
    severity: JobQualityIssue["severity"],
    field: string,
    title: string,
    message: string,
    question: string,
    points: number
  ) => {
    issues.push({ severity, field, title, message, question });
    penalty += points;
  };

  if (!profile.summary?.trim()) {
    add(
      "medium",
      "summary",
      "Falta un resumen del propósito del cargo",
      "Un resumen corto ayuda a interpretar el contexto de los requisitos.",
      "¿Cuál es el objetivo principal de este cargo?",
      8
    );
  }
  if (profile.responsibilities.length === 0) {
    add(
      "high",
      "responsibilities",
      "No hay funciones verificables",
      "Sin funciones es difícil reconocer experiencia equivalente en un CV.",
      "¿Cuáles son las tres funciones principales del cargo?",
      20
    );
  }
  if (profile.required_skills.length === 0) {
    add(
      "high",
      "required_skills",
      "No hay conocimientos o habilidades definidos",
      "El matching no tendrá criterios técnicos con los cuales comparar.",
      "¿Qué debe saber hacer la persona desde el primer día?",
      25
    );
  }
  if (profile.experience_requirements.minimum_years === null) {
    add(
      "low",
      "experience_requirements.minimum_years",
      "Experiencia mínima no especificada",
      "No es obligatorio exigir años, pero conviene confirmar si existe un mínimo real.",
      "¿Existe un mínimo de experiencia o basta con demostrar las funciones?",
      5
    );
  }
  if (!profile.location.city && profile.location.work_mode !== "remote") {
    add(
      "medium",
      "location.city",
      "Ubicación presencial sin ciudad",
      "La persona no podrá saber dónde se desarrolla el trabajo.",
      "¿En qué ciudad se desempeñará el cargo?",
      10
    );
  }
  if (profile.employment_type === "unspecified") {
    add(
      "low",
      "employment_type",
      "Tipo de vinculación no especificado",
      "Completarlo mejora la claridad para el candidato, aunque no cambia su match.",
      "¿La vinculación es tiempo completo, temporal o por obra?",
      4
    );
  }

  const canonical = new Set<string>();
  let duplicates = 0;
  let alternativeMustHaves = 0;
  for (const skill of profile.required_skills) {
    const key = normalizeText(skill.canonical_name || skill.raw_name);
    if (key && canonical.has(key)) duplicates++;
    canonical.add(key);
    if (skill.importance === "must_have" && /\b(o|y\/o)\b/i.test(skill.raw_name)) {
      alternativeMustHaves++;
    }
  }

  if (duplicates > 0) {
    add(
      "medium",
      "required_skills",
      "Hay requisitos duplicados",
      "Una misma competencia repetida puede adquirir más peso del que merece.",
      "¿Deseas unificar los requisitos repetidos?",
      Math.min(12, duplicates * 4)
    );
  }
  if (alternativeMustHaves > 0) {
    add(
      "high",
      "required_skills",
      "Una alternativa aparece como obligación simultánea",
      "Las expresiones con “o” deben evaluarse como rutas alternativas.",
      "¿Cualquiera de esas alternativas permite cumplir el requisito?",
      Math.min(15, alternativeMustHaves * 7)
    );
  }

  const mustHaveCount = profile.required_skills.filter((s) => s.importance === "must_have").length;
  if (mustHaveCount > 7) {
    add(
      "medium",
      "required_skills",
      "Hay demasiados requisitos indispensables",
      "Marcar todo como indispensable reduce la capacidad de priorizar.",
      "¿Cuáles son realmente excluyentes y cuáles podrían ser requeridos o deseables?",
      8
    );
  }

  const protectedText = [
    profile.title,
    profile.summary ?? "",
    ...profile.required_skills.map((s) => s.raw_name),
    ...profile.responsibilities.map((r) => r.text),
  ].join(" ");
  if (PROTECTED_PATTERN.test(normalizeText(protectedText))) {
    add(
      "high",
      "protected_attributes",
      "Posible criterio personal o discriminatorio",
      "La oferta menciona una característica que no debe intervenir en el matching.",
      "¿Deseas eliminar esa referencia antes de publicar?",
      25
    );
  }

  const score = Math.max(0, 100 - penalty);
  return {
    score,
    label:
      score >= 80
        ? "Lista para revisar"
        : score >= 55
          ? "Conviene mejorar"
          : "Información insuficiente",
    issues: issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
  };
}

/**
 * Protege los hechos verificables: la IA puede ordenar, dividir y redactar,
 * pero no introducir credenciales o condiciones nuevas antes de la aprobación.
 */
export function constrainImprovedProfile(
  original: JobProfile,
  proposed: JobProfile
): JobProfile {
  const originalCorpus = [
    original.title,
    original.summary ?? "",
    ...original.required_skills.flatMap((item) => [item.raw_name, item.evidence]),
    ...original.responsibilities.flatMap((item) => [item.text, item.evidence]),
  ].join(" ");
  const originalSkillByEvidence = new Map(
    original.required_skills
      .map((item) => [normalizeText(item.evidence), item] as const)
      .filter(([evidence]) => !!evidence)
  );
  const originalResponsibilityByEvidence = new Map(
    original.responsibilities
      .map((item) => [normalizeText(item.evidence), item] as const)
      .filter(([evidence]) => !!evidence)
  );

  const skills = proposed.required_skills.flatMap((item) => {
    const evidence = normalizeText(item.evidence);
    const source = originalSkillByEvidence.get(evidence);
    if (!source || !isGroundedLabel(item.raw_name, `${source.raw_name} ${source.evidence}`)) {
      return [];
    }

    // La redacción puede mejorar o una alternativa puede separarse, pero la
    // IA no puede volver indispensable algo deseable ni inventar antigüedad.
    return [{
      ...item,
      canonical_name: isGroundedLabel(item.canonical_name, `${source.raw_name} ${source.evidence}`)
        ? item.canonical_name
        : normalizeText(item.raw_name),
      category: source.category,
      importance: source.importance,
      proficiency: source.proficiency,
      minimum_years: source.minimum_years,
      evidence: source.evidence,
    }];
  });
  const responsibilities = proposed.responsibilities.flatMap((item) => {
    const evidence = normalizeText(item.evidence);
    const source = originalResponsibilityByEvidence.get(evidence);
    if (!source || groundingRatio(item.text, `${source.text} ${source.evidence}`) < 0.55) {
      return [];
    }
    return [{ ...item, importance: source.importance, evidence: source.evidence }];
  });

  return {
    ...proposed,
    title: original.title,
    summary:
      proposed.summary && groundingRatio(proposed.summary, originalCorpus) >= 0.55
        ? proposed.summary
        : original.summary,
    department: original.department,
    employment_type: original.employment_type,
    seniority: original.seniority,
    location: original.location,
    experience_requirements: original.experience_requirements,
    education_requirements: original.education_requirements,
    certifications: original.certifications,
    languages: original.languages,
    knockout_requirements: original.knockout_requirements,
    salary: original.salary,
    benefits: original.benefits,
    application_questions: original.application_questions,
    required_skills: skills.length > 0 ? skills : original.required_skills,
    responsibilities:
      responsibilities.length > 0 ? responsibilities : original.responsibilities,
    extraction_metadata: original.extraction_metadata,
  };
}

function isGroundedLabel(label: string, source: string): boolean {
  const normalizedLabel = normalizeText(label);
  const normalizedSource = normalizeText(source);
  return normalizedLabel.length >= 2 && normalizedSource.includes(normalizedLabel);
}

function groundingRatio(value: string, source: string): number {
  const sourceTokens = new Set(significantTokens(source));
  const valueTokens = significantTokens(value);
  if (valueTokens.length === 0) return 0;
  const found = valueTokens.filter((token) => sourceTokens.has(token)).length;
  return found / valueTokens.length;
}

function significantTokens(value: string): string[] {
  const stop = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "o", "para", "con"]);
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function severityRank(value: JobQualityIssue["severity"]): number {
  return value === "high" ? 0 : value === "medium" ? 1 : 2;
}
