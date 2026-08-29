import type { JobProfile } from "@/lib/ai/schemas/job-profile";

/**
 * Tipos de las tablas del módulo de IA (migraciones 008–011).
 *
 * Escritos a mano igual que `database.ts`: este proyecto no genera los tipos
 * con el CLI de Supabase, y mezclar ambos enfoques sería peor que ser
 * consistente con lo que ya hay.
 */

export type DocumentStatus =
  | "uploaded"
  | "extracting_text"
  | "extracting_profile"
  | "needs_review"
  | "ready"
  | "failed";

export type AIRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type ProfileVersionStatus = "draft" | "confirmed" | "superseded";

export type DocumentSource = "manual" | "pdf" | "docx";

export interface JobDocument {
  id: string;
  job_id: string | null;
  company_id: string | null;
  uploaded_by: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  status: DocumentStatus;
  extracted_text: string | null;
  extracted_text_hash: string | null;
  page_count: number | null;
  ocr_used: boolean;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateDocument {
  id: string;
  /** null cuando lo sube un admin para alguien sin cuenta (plan §3.8) */
  candidate_id: string | null;
  uploaded_by: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  version: number;
  is_current: boolean;
  status: DocumentStatus;
  extracted_text: string | null;
  extracted_text_hash: string | null;
  page_count: number | null;
  ocr_used: boolean;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobProfileVersion {
  id: string;
  job_id: string | null;
  source_document_id: string | null;
  version: number;
  source: DocumentSource;
  /** Perfil vigente: lo que el humano aprobó */
  profile: JobProfile;
  /** Copia intacta de lo que extrajo la IA, para medir correcciones (spec §37) */
  ai_profile: JobProfile | null;
  profile_hash: string;
  confidence: number | null;
  extractor_version: string;
  prompt_version: string;
  model_provider: string | null;
  model_name: string | null;
  status: ProfileVersionStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ScoringWeights {
  technical_skills: number;
  experience: number;
  education_certifications: number;
  transferable_skills: number;
  languages: number;
  preferred_skills: number;
  /** Añadida en v2: ciudad del cargo frente a ciudad del candidato. */
  location: number;
}

export interface ScoringConfiguration {
  id: string;
  version: string;
  scope: "global" | "company" | "job";
  company_id: string | null;
  job_id: string | null;
  weights: ScoringWeights;
  bands: { high: number; potential: number };
  experience_weights: Record<string, number>;
  minimum_profile_confidence: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}
