import { IMPORTANCE_WEIGHT } from "@/lib/matching/config";
import { bestEvidenceMatch, buildEvidenceBlocks } from "@/lib/matching/evidence";
import { conceptSimilarity, normalizeText, textSimilarity } from "@/lib/matching/normalize/skill-normalizer";
import { coverageCredit } from "@/lib/matching/scoring/coverage";
import type {
  CandidateEvidence,
  CategoryOutcome,
  JobRequirements,
  RequirementResult,
} from "@/lib/matching/types";

/** Jerarquía de niveles educativos. Un grado superior cumple uno inferior. */
const EDUCATION_RANK: Record<string, number> = {
  bachiller: 1,
  tecnico: 2,
  tecnologo: 3,
  profesional: 4,
  especialista: 5,
  maestria: 6,
  doctorado: 7,
};

function rankOf(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = normalizeText(raw);

  for (const [level, rank] of Object.entries(EDUCATION_RANK)) {
    if (normalized.includes(level)) return rank;
  }

  // Sinónimos frecuentes en los documentos reales
  if (/ingenier|licenciat|pregrado|universitar/.test(normalized)) return EDUCATION_RANK.profesional;
  if (/magist|master|msc/.test(normalized)) return EDUCATION_RANK.maestria;
  if (/phd|doctor/.test(normalized)) return EDUCATION_RANK.doctorado;
  if (/especializa/.test(normalized)) return EDUCATION_RANK.especialista;

  return null;
}

/**
 * Educación y certificaciones — categoría `education_certifications`.
 *
 * Nota de la spec §29: la institución NO influye. Solo cuentan el nivel y el
 * área de estudio; convertir la universidad en medida de prestigio sería
 * exactamente el sesgo que el sistema debe evitar.
 */
export function scoreCredentials(
  job: JobRequirements,
  candidate: CandidateEvidence
): CategoryOutcome {
  if (job.education.length === 0 && job.certifications.length === 0) {
    return { score: null, requirements: [] };
  }

  const results: RequirementResult[] = [];
  let earned = 0;
  let possible = 0;

  // ── Educación ──
  const candidateBestRank = candidate.education.reduce<number | null>((best, edu) => {
    const rank = rankOf(edu.level) ?? rankOf(edu.degree);
    if (rank === null) return best;
    return best === null || rank > best ? rank : best;
  }, null);

  for (const requirement of job.education) {
    const requiredRank = rankOf(requirement.level) ?? rankOf(requirement.field);
    const weight = IMPORTANCE_WEIGHT[requirement.importance];
    possible += weight;

    const label = [requirement.level, requirement.field].filter(Boolean).join(" en ") || "Formación";

    if (candidate.education.length === 0) {
      results.push(makeResult("education", label, requirement.importance, "unknown", 0, "", null, 0));
      continue;
    }

    // Nivel: un grado superior cumple el requisito
    let score = 0;
    if (requiredRank !== null && candidateBestRank !== null) {
      score = candidateBestRank >= requiredRank ? 1 : candidateBestRank / requiredRank;
    }

    // Área de estudio, si la oferta la especifica
    if (requirement.field) {
      const fieldMatch = Math.max(
        ...candidate.education.map((e) =>
          Math.max(textSimilarity(requirement.field as string, e.field ?? ""), textSimilarity(requirement.field as string, e.degree))
        ),
        0
      );
      score = requiredRank !== null ? (score + fieldMatch) / 2 : fieldMatch;
    }

    const best = candidate.education[0];
    results.push(
      makeResult(
        "education",
        label,
        requirement.importance,
        score >= 0.8 ? "matched" : score >= 0.3 ? "partial" : "not_found",
        score,
        `${best.degree}${best.field ? ` (${best.field})` : ""}`,
        best.degree,
        candidate.extractionConfidence
      )
    );

    earned += weight * score;
  }

  // ── Certificaciones ──
  for (const certification of job.certifications) {
    const weight = IMPORTANCE_WEIGHT[certification.importance];
    possible += weight;

    if (candidate.certifications.length === 0) {
      results.push(
        makeResult("certification", certification.name, certification.importance, "unknown", 0, "", null, 0)
      );
      continue;
    }

    let bestScore = 0;
    let bestValue = "";
    for (const owned of candidate.certifications) {
      const similarity = textSimilarity(certification.name, owned);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestValue = owned;
      }
    }

    results.push(
      makeResult(
        "certification",
        certification.name,
        certification.importance,
        bestScore >= 0.8 ? "matched" : bestScore >= 0.3 ? "partial" : "not_found",
        bestScore,
        bestValue,
        bestValue || null,
        candidate.extractionConfidence
      )
    );

    earned += weight * bestScore;
  }

  return {
    score: scoreOrNull(results, earned, possible),
    requirements: results,
  };
}

/** Idiomas — categoría `languages`. */
export function scoreLanguages(
  job: JobRequirements,
  candidate: CandidateEvidence
): CategoryOutcome {
  if (job.languages.length === 0) return { score: null, requirements: [] };

  const results: RequirementResult[] = [];
  let earned = 0;
  let possible = 0;

  for (const requirement of job.languages) {
    const weight = IMPORTANCE_WEIGHT[requirement.importance];
    possible += weight;

    const owned = candidate.languages.find(
      (l) => textSimilarity(requirement.language, l.language) >= 0.5
    );

    if (!owned) {
      const noData = candidate.languages.length === 0;
      results.push(
        makeResult(
          "language",
          requirement.language,
          requirement.importance,
          noData ? "unknown" : "not_found",
          0,
          "",
          null,
          noData ? 0 : candidate.extractionConfidence
        )
      );
      continue;
    }

    // El nivel no se compara numéricamente: los CV lo declaran de formas muy
    // dispares (B1, intermedio, conversacional) y equipararlas sin calibrar
    // produciría falsos negativos. Si la oferta pide nivel y el CV no lo trae,
    // se marca parcial para que lo revise una persona.
    const hasLevel = !!owned.level?.trim();
    const score = requirement.minimumLevel && !hasLevel ? 0.7 : 1;

    results.push(
      makeResult(
        "language",
        requirement.language,
        requirement.importance,
        score >= 1 ? "matched" : "partial",
        score,
        `${owned.language}${owned.level ? ` (${owned.level})` : ""}`,
        owned.language,
        candidate.extractionConfidence
      )
    );

    earned += weight * score;
  }

  return {
    score: scoreOrNull(results, earned, possible),
    requirements: results,
  };
}

/**
 * Habilidades transferibles — spec §17, revisada.
 *
 * La versión anterior contradecía su propia regla. La spec dice que una
 * habilidad blanda solo cuenta con evidencia laboral concreta; el código, en
 * cambio, solo miraba la lista declarada de habilidades blandas y NO podía
 * leer la experiencia. El resultado era el peor de los dos mundos: premiaba al
 * candidato que escribe "liderazgo" en una lista y no veía al que describe
 * haber liderado un equipo.
 *
 * Ahora se busca en dos sitios, en orden de fuerza probatoria:
 *   1. La habilidad declarada, resuelta por concepto (alias y taxonomía).
 *   2. La evidencia laboral, cargo por cargo, con el descuento por tratarse de
 *      una deducción y no de una declaración.
 *
 * Lo que sigue prohibido es inferirlas del nombre, la foto, la universidad o
 * el estilo de redacción del CV.
 */
export function scoreTransferable(
  job: JobRequirements,
  candidate: CandidateEvidence
): CategoryOutcome {
  const required = job.skills.filter((s) => s.category === "transferable");
  if (required.length === 0) return { score: null, requirements: [] };

  const pool = [
    ...candidate.transferableSkills.map((t) => ({ name: t.name, evidence: t.evidence, confidence: t.confidence })),
    ...candidate.skills
      .filter((s) => s.category === "transferable")
      .map((s) => ({ name: s.rawName, evidence: s.evidence, confidence: s.confidence })),
  ];

  const blocks = buildEvidenceBlocks(candidate);

  const results: RequirementResult[] = [];
  let earned = 0;
  let possible = 0;

  for (const requirement of required) {
    const weight = IMPORTANCE_WEIGHT[requirement.importance];
    possible += weight;

    // ── 1. Declarada ──
    let bestScore = 0;
    let best: (typeof pool)[number] | null = null;

    for (const owned of pool) {
      const similarity = Math.max(
        conceptSimilarity(requirement.canonicalName || requirement.rawName, owned.name),
        conceptSimilarity(requirement.rawName, owned.name)
      );
      if (similarity > bestScore) {
        bestScore = similarity;
        best = owned;
      }
    }

    let score = best ? coverageCredit(bestScore) * Math.max(0.5, best.confidence) : 0;
    let evidence = best?.evidence ?? "";
    let value = best?.name ?? null;

    // ── 2. Demostrada en un cargo ──
    const fromWork = bestEvidenceMatch(
      [requirement.canonicalName, requirement.rawName],
      blocks,
      "sentence"
    );

    if (fromWork) {
      const credit = coverageCredit(fromWork.similarity) * INFERRED_FROM_WORK_SCORE;
      if (credit > score) {
        score = credit;
        evidence = `${fromWork.text} (${fromWork.context})`;
        value = fromWork.text || fromWork.context;
      }
    }

    // Sin evidencia no se afirma nada: una habilidad blanda ausente del CV no
    // demuestra que la persona no la tenga (§17)
    const noData = pool.length === 0 && blocks.length === 0;

    results.push(
      makeResult(
        "skill",
        requirement.rawName,
        requirement.importance,
        noData ? "unknown" : score >= 0.6 ? "matched" : score >= 0.25 ? "partial" : "not_found",
        score,
        evidence,
        value,
        best?.confidence ?? candidate.extractionConfidence
      )
    );

    earned += weight * score;
  }

  return {
    score: scoreOrNull(results, earned, possible),
    requirements: results,
  };
}

/**
 * Techo de una competencia deducida del relato de un cargo en vez de
 * declarada. Es evidencia legítima —de hecho la que pide §17— pero se
 * reconoce por coincidencia de texto, con el margen de error que eso implica.
 */
const INFERRED_FROM_WORK_SCORE = 0.85;

/**
 * Puntaje de la categoría, o `null` si no es evaluable.
 *
 * Cuando de NINGÚN requisito se pudo obtener evidencia, la categoría queda
 * fuera del cálculo en vez de valer 0. Devolver 0 significaría "no cumple
 * nada", cuando lo que realmente ocurre es "no sabemos" — y esa distinción
 * (spec §8) es la que sostiene todo el motor. Sin esto, un CV que no declara
 * habilidades blandas perdía 10 puntos del total por algo que el propio
 * sistema admite no poder juzgar.
 */
function scoreOrNull(
  results: RequirementResult[],
  earned: number,
  possible: number
): number | null {
  if (possible === 0) return null;
  if (results.length > 0 && results.every((r) => r.status === "unknown")) return null;
  return Math.round(100 * (earned / possible));
}

function makeResult(
  type: RequirementResult["type"],
  requirementText: string,
  importance: RequirementResult["importance"],
  status: RequirementResult["status"],
  matchScore: number,
  candidateEvidence: string,
  candidateValue: string | null,
  confidence: number
): RequirementResult {
  return {
    type,
    requirementText,
    importance,
    status,
    matchType:
      status === "matched" ? "exact" : status === "partial" ? "partial" : status === "unknown" ? "unknown" : "not_found",
    matchScore: Math.round(matchScore * 100) / 100,
    candidateEvidence,
    candidateValue,
    confidence,
  };
}
