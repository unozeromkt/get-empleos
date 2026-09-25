import { describe, expect, it } from "vitest";

import { calculateMatch } from "@/lib/matching/engine";
import {
  buildSemanticAdjudicationRequest,
  validateSemanticAdjudications,
} from "@/lib/matching/semantic-adjudication";
import type { CandidateEvidence, JobRequirements } from "@/lib/matching/types";

const job: JobRequirements = {
  title: "Astronauta",
  skills: [
    {
      rawName: "Actividad extravehicular",
      canonicalName: "actividad extravehicular",
      category: "technical",
      importance: "must_have",
      minimumYears: null,
    },
  ],
  responsibilities: [],
  experience: { minimumYears: null, relevantRoles: [], industries: [] },
  education: [],
  certifications: [],
  languages: [],
  knockouts: [],
  location: null,
};

const candidate: CandidateEvidence = {
  skills: [
    {
      rawName: "EVA",
      canonicalName: "eva",
      category: "technical",
      yearsEstimate: null,
      evidence: "Participó en dos misiones EVA desde la EEI",
      confidence: 0.94,
    },
  ],
  transferableSkills: [],
  experience: [],
  totalYearsExperience: null,
  education: [],
  certifications: [],
  languages: [],
  narrative: [],
  city: null,
  extractionConfidence: 0.94,
  isSparse: false,
};

describe("semantic adjudication", () => {
  it("solo acepta una equivalencia respaldada por una cita literal", () => {
    const firstPass = calculateMatch(job, candidate);
    const request = buildSemanticAdjudicationRequest(job, candidate, firstPass);

    expect(request).not.toBeNull();
    const adjudications = validateSemanticAdjudications(request!, {
      adjudications: [
        {
          requirement_type: "skill",
          requirement_text: "Actividad extravehicular",
          decision: "demonstrated",
          evidence_quote: "Participó en dos misiones EVA desde la EEI",
          candidate_value: "EVA",
          confidence: 0.93,
          reason: "EVA es la sigla usual de actividad extravehicular.",
        },
      ],
    });

    const result = calculateMatch(job, candidate, undefined, adjudications);

    expect(adjudications).toHaveLength(1);
    expect(result.categoryScores.technical_skills).toBe(95);
    expect(result.requirements[0]).toMatchObject({
      status: "matched",
      matchType: "semantic",
      matchScore: 0.95,
      candidateValue: "EVA",
    });
  });

  it("rechaza citas inventadas y confianza insuficiente", () => {
    const request = buildSemanticAdjudicationRequest(job, candidate, calculateMatch(job, candidate));
    const adjudications = validateSemanticAdjudications(request!, {
      adjudications: [
        {
          requirement_type: "skill",
          requirement_text: "Actividad extravehicular",
          decision: "demonstrated",
          evidence_quote: "Caminó sobre la Luna",
          candidate_value: "EVA",
          confidence: 0.99,
          reason: "No está en el CV.",
        },
        {
          requirement_type: "skill",
          requirement_text: "Actividad extravehicular",
          decision: "partial",
          evidence_quote: "Participó en dos misiones EVA desde la EEI",
          candidate_value: "EVA",
          confidence: 0.4,
          reason: "Confianza insuficiente.",
        },
      ],
    });

    expect(adjudications).toEqual([]);
  });

  it("una adjudicación parcial nunca reduce una coincidencia exacta", () => {
    const exactCandidate: CandidateEvidence = {
      ...candidate,
      skills: [
        {
          ...candidate.skills[0],
          rawName: "Actividad extravehicular",
          canonicalName: "actividad extravehicular",
        },
      ],
    };
    const result = calculateMatch(job, exactCandidate, undefined, [
      {
        type: "skill",
        requirementText: "Actividad extravehicular",
        status: "partial",
        matchScore: 0.65,
        candidateEvidence: "Actividad extravehicular",
        candidateValue: "Actividad extravehicular",
        confidence: 0.9,
        reason: "Prueba de no degradación.",
      },
    ]);

    expect(result.categoryScores.technical_skills).toBe(100);
    expect(result.requirements[0].matchType).toBe("exact");
  });
});
