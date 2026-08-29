"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateApplicationStatusAction } from "@/lib/actions/applications";
import { DOCUMENT_LIMITS, extensionForMime, isAllowedMimeType } from "@/lib/ai/config";
import { sha256 } from "@/lib/documents/hash";
import { dispatchPendingRuns } from "@/lib/queue/dispatch";
import { enqueueRun } from "@/lib/queue/enqueue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  return { supabase, user };
}

// ─── Listado de candidatos de una oferta ──────────────────────────────────────

export interface ScreeningRow {
  id: string;
  systemRef: number;
  source: "application" | "admin_upload";
  displayName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  status: string;
  documentId: string | null;
  /** null si todavía no se ha calculado el match */
  match: {
    overallScore: number;
    band: string;
    scoreConfidence: number;
    requirementsScore: number | null;
    criticalGaps: Array<{ requirementText: string; reason: string }>;
    categoryScores: Record<string, number | null>;
    explanation: {
      summary: string;
      strengths: string[];
      gaps: string[];
      questionsForRecruiter: string[];
    };
  } | null;
  processingStatus: string | null;
  /** Motivo real del fallo de procesamiento, si lo hubo. */
  processingError: { code: string; message: string } | null;
}

export async function listJobCandidatesAction(jobId: string): Promise<ScreeningRow[]> {
  const { supabase } = await requireAdmin();

  const { data: rows } = await supabase
    .from("job_candidates")
    .select(
      `id, system_ref, source, display_name, email, phone, created_at, status,
       document_id, candidate_id,
       candidate:candidates(id, profile:profiles(full_name, email, phone)),
       document:candidate_documents(status, error_code, error_message),
       match:match_results(id, overall_score, band, score_confidence, category_scores,
                           critical_gaps, explanation, is_current)`
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (!rows) return [];

  /** Supabase devuelve las relaciones anidadas como objeto o como array. */
  interface MatchRow {
    id: string;
    overall_score: number;
    band: string;
    score_confidence: number | string;
    category_scores: Record<string, number | null>;
    critical_gaps: Array<{ requirementText: string; reason: string }>;
    explanation: ScreeningRow["match"] extends null ? never : NonNullable<ScreeningRow["match"]>["explanation"];
    is_current: boolean;
  }

  const currentMatchOf = (raw: unknown): MatchRow | null => {
    const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as MatchRow[];
    return list.find((m) => m && m.is_current !== false) ?? null;
  };

  // La "Puntuación de requisitos" del listado sale del detalle por requisito,
  // no del score agregado: es la cobertura de los obligatorios (ver §13 del plan)
  const matchIds = rows
    .map((r) => currentMatchOf(r.match)?.id)
    .filter((id): id is string => !!id);

  const requirementsByMatch = new Map<string, number>();

  if (matchIds.length > 0) {
    const { data: reqs } = await supabase
      .from("match_requirement_results")
      .select("match_result_id, importance, match_score")
      .in("match_result_id", matchIds);

    const grouped = new Map<string, { earned: number; total: number }>();
    for (const r of reqs ?? []) {
      if (r.importance === "preferred") continue; // solo cuentan los obligatorios
      const key = r.match_result_id as string;
      const acc = grouped.get(key) ?? { earned: 0, total: 0 };
      acc.total += 1;
      acc.earned += Number(r.match_score);
      grouped.set(key, acc);
    }

    grouped.forEach((acc, key) => {
      requirementsByMatch.set(key, acc.total === 0 ? 0 : Math.round((100 * acc.earned) / acc.total));
    });
  }

  return rows.map((row) => {
    const candidate = Array.isArray(row.candidate) ? row.candidate[0] : row.candidate;
    const profile = candidate
      ? Array.isArray(candidate.profile)
        ? candidate.profile[0]
        : candidate.profile
      : null;

    const doc = Array.isArray(row.document) ? row.document[0] : row.document;
    const match = currentMatchOf(row.match);

    return {
      id: row.id as string,
      systemRef: row.system_ref as number,
      source: row.source as "application" | "admin_upload",
      // Nombre y contacto son para operar, nunca para rankear (spec §29)
      displayName: (profile?.full_name as string) ?? (row.display_name as string) ?? "Sin nombre",
      email: (profile?.email as string) ?? (row.email as string) ?? null,
      phone: (profile?.phone as string) ?? (row.phone as string) ?? null,
      createdAt: row.created_at as string,
      status: row.status as string,
      documentId: (row.document_id as string) ?? null,
      processingStatus: (doc?.status as string) ?? null,
      // El motivo importa para saber si se reintenta o si hay que resubir el
      // archivo: un TIMEOUT del proveedor se reintenta; un PDF escaneado no.
      processingError: doc?.error_code
        ? {
            code: doc.error_code as string,
            message: (doc.error_message as string) ?? "",
          }
        : null,
      match: match
        ? {
            overallScore: match.overall_score,
            band: match.band,
            scoreConfidence: Number(match.score_confidence),
            requirementsScore: requirementsByMatch.get(match.id) ?? null,
            criticalGaps: match.critical_gaps ?? [],
            categoryScores: match.category_scores ?? {},
            explanation: match.explanation,
          }
        : null,
    };
  });
}

// ─── Subida manual de CVs por el admin ────────────────────────────────────────

/**
 * Sube el CV de alguien que NO tiene cuenta y lo encola para evaluarlo contra
 * la oferta.
 *
 * Riesgo R9 del plan: son datos personales de una persona que nunca aceptó los
 * términos de la plataforma. Bucket privado, acceso por URL firmada, y queda
 * registrado qué admin lo subió y cuándo.
 */
export async function uploadCandidateCVAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const jobId = formData.get("job_id") as string;
  const file = formData.get("cv") as File | null;

  if (!jobId) return { error: "Falta la oferta." };
  if (!file || file.size === 0) return { error: "Selecciona un archivo." };
  if (!isAllowedMimeType(file.type)) return { error: `${file.name}: debe ser PDF o Word (.docx).` };
  if (file.size > DOCUMENT_LIMITS.maxSizeBytes) return { error: `${file.name}: supera los 10 MB.` };

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buffer);
  const storagePath = `admin-uploads/${randomUUID()}.${extensionForMime(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from("cvs")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `${file.name}: no se pudo subir.` };

  // candidate_id queda NULL: esta persona no tiene cuenta (plan §3.8)
  const { data: doc, error: docError } = await supabase
    .from("candidate_documents")
    .insert({
      candidate_id: null,
      uploaded_by: user.id,
      storage_path: storagePath,
      original_filename: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      sha256: hash,
      version: 1,
      is_current: true,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    await supabase.storage.from("cvs").remove([storagePath]);
    return { error: `${file.name}: no se pudo registrar.` };
  }

  const { error: jcError } = await supabase.from("job_candidates").insert({
    job_id: jobId,
    source: "admin_upload",
    application_id: null,
    candidate_id: null,
    display_name: file.name.replace(/\.(pdf|docx)$/i, "").slice(0, 200),
    document_id: doc.id,
    status: "pending",
    created_by: user.id,
  });

  if (jcError) return { error: `${file.name}: no se pudo asociar a la oferta.` };

  await enqueueRun(createAdminClient(), {
    runType: "extract_document_text",
    entityType: "candidate_document",
    entityId: doc.id as string,
    inputHash: hash,
  });

  revalidatePath(`/admin/jobs/${jobId}/cvs`);
  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  return { success: true, filename: file.name };
}

// ─── Recalcular el match de un candidato ──────────────────────────────────────

export async function recalculateMatchAction(jobCandidateId: string, jobId: string) {
  await requireAdmin();

  await enqueueRun(createAdminClient(), {
    runType: "calculate_match",
    entityType: "job_candidate",
    entityId: jobCandidateId,
  });

  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  return { success: true };
}

/**
 * Reintenta el procesamiento de una hoja de vida que quedó en `failed`.
 *
 * Sin esto, un fallo transitorio del proveedor (un TIMEOUT, un 5xx) dejaba al
 * candidato muerto para siempre: `recalculateMatchAction` solo reencola el
 * match, que no puede calcularse porque nunca llegó a existir el perfil, así
 * que la única salida era borrar y volver a subir el archivo.
 *
 * Se reanuda en el paso que falló: si el texto ya se había extraído no se
 * vuelve a descargar ni a parsear el PDF, solo se repite la llamada al modelo.
 */
export async function reprocessCandidateDocumentAction(jobCandidateId: string, jobId: string) {
  const { supabase } = await requireAdmin();

  const { data: jc } = await supabase
    .from("job_candidates")
    .select("id, document_id")
    .eq("id", jobCandidateId)
    .maybeSingle();

  if (!jc) return { error: "Candidato no encontrado." };
  if (!jc.document_id) return { error: "Este candidato no tiene hoja de vida asociada." };

  const { data: doc } = await supabase
    .from("candidate_documents")
    .select("id, sha256, extracted_text, extracted_text_hash")
    .eq("id", jc.document_id)
    .maybeSingle();

  if (!doc) return { error: "La hoja de vida ya no existe." };

  const admin = createAdminClient();

  // Los match encolados contra un perfil que no existe solo generan ruido:
  // la extracción encolará uno nuevo cuando haya algo que evaluar.
  await admin
    .from("ai_processing_runs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("run_type", "calculate_match")
    .eq("entity_type", "job_candidate")
    .eq("entity_id", jobCandidateId)
    .in("status", ["queued"]);

  const hasText = ((doc.extracted_text as string | null) ?? "").trim().length > 0;

  const { error: resetError } = await supabase
    .from("candidate_documents")
    .update({
      status: hasText ? "extracting_profile" : "uploaded",
      error_code: null,
      error_message: null,
    })
    .eq("id", doc.id);

  if (resetError) return { error: "No se pudo reiniciar el procesamiento." };

  const enqueued = await enqueueRun(
    admin,
    hasText
      ? {
          runType: "extract_candidate_profile",
          entityType: "candidate_document",
          entityId: doc.id as string,
          inputHash: (doc.extracted_text_hash as string | null) ?? null,
        }
      : {
          runType: "extract_document_text",
          entityType: "candidate_document",
          entityId: doc.id as string,
          inputHash: (doc.sha256 as string | null) ?? null,
        }
  );

  if ("error" in enqueued) return { error: "No se pudo encolar el reproceso." };

  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  revalidatePath(`/admin/jobs/${jobId}/cvs`);
  return { success: true };
}

/**
 * Cambia el estado del candidato en el pipeline (spec §30).
 *
 * Si viene de una postulación real, se delega en `updateApplicationStatusAction`
 * en lugar de escribir directo: esa acción envía el email de notificación al
 * candidato y conserva las notas internas. Escribir solo en `job_candidates`
 * dejaría al candidato viendo un estado desactualizado y sin avisar.
 * El trigger de la migración 015 propaga el cambio de vuelta.
 */
export async function updateJobCandidateStatusAction(
  jobCandidateId: string,
  jobId: string,
  status: string
) {
  const { supabase } = await requireAdmin();

  const { data: row } = await supabase
    .from("job_candidates")
    .select("id, application_id")
    .eq("id", jobCandidateId)
    .maybeSingle();

  if (!row) return { error: "Candidato no encontrado." };

  if (row.application_id) {
    // Recuperar las notas para no borrarlas al reenviar el formulario
    const { data: application } = await supabase
      .from("applications")
      .select("admin_notes")
      .eq("id", row.application_id)
      .maybeSingle();

    const formData = new FormData();
    formData.set("application_id", row.application_id as string);
    formData.set("status", status);
    formData.set("admin_notes", (application?.admin_notes as string) ?? "");

    const result = await updateApplicationStatusAction(formData);
    if (result?.error) return { error: "No se pudo cambiar el estado." };
  } else {
    // CV subido por el admin: no hay postulación ni candidato a quien notificar
    const { error } = await supabase
      .from("job_candidates")
      .update({ status })
      .eq("id", jobCandidateId);

    if (error) return { error: "No se pudo cambiar el estado." };
  }

  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  return { success: true };
}

/**
 * Quita a una persona de una oferta.
 *
 * Hace falta para deshacer una carga duplicada y, sobre todo, para poder
 * reemplazar una hoja de vida: el pipeline evalúa el documento con el que
 * entró, así que actualizar el CV pasa por sacar al candidato y volver a
 * subirlo. Sin esto, un CV subido dos veces se quedaba para siempre.
 *
 * El borrado no es el mismo según de dónde vino la persona:
 *
 * - `admin_upload`: la hoja de vida existía solo para esta oferta, así que se
 *   borra entera — documento, perfil extraído (que arrastra el índice de
 *   búsqueda) y archivo del bucket. Solo así desaparece también de la base de
 *   hojas de vida y del buscador de talento.
 * - `application`: se borra la postulación y el ON DELETE CASCADE se lleva el
 *   job_candidate. El CV es del candidato y NO se toca; lo que se libera es el
 *   UNIQUE(job_id, candidate_id) para que pueda volver a postularse con su
 *   hoja de vida al día.
 */
export async function deleteJobCandidateAction(jobCandidateId: string, jobId: string) {
  const { supabase } = await requireAdmin();

  const { data: jc } = await supabase
    .from("job_candidates")
    .select("id, job_id, source, application_id, document_id")
    .eq("id", jobCandidateId)
    .maybeSingle();

  if (!jc) return { error: "Candidato no encontrado." };
  // El id de la oferta viene del cliente: sin esto se podría borrar a alguien
  // de otra vacante pasando otro jobCandidateId.
  if (jc.job_id !== jobId) return { error: "Ese candidato no pertenece a esta oferta." };

  const admin = createAdminClient();
  const documentId = jc.document_id as string | null;
  const isAdminUpload = jc.source === "admin_upload";

  // Un trabajo encolado sobre algo que va a dejar de existir solo produce
  // reintentos fallidos y ruido en la cola.
  await admin
    .from("ai_processing_runs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("entity_type", "job_candidate")
    .eq("entity_id", jobCandidateId)
    .in("status", ["queued"]);

  if (jc.application_id) {
    const { error } = await supabase.from("applications").delete().eq("id", jc.application_id);
    if (error) return { error: "No se pudo eliminar la postulación." };
  } else {
    const { error } = await supabase.from("job_candidates").delete().eq("id", jobCandidateId);
    if (error) return { error: "No se pudo eliminar el candidato." };
  }

  if (isAdminUpload && documentId) {
    await admin
      .from("ai_processing_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("entity_type", "candidate_document")
      .eq("entity_id", documentId)
      .in("status", ["queued"]);

    // Defensa por si el mismo documento llegara a estar asociado a otra oferta:
    // el archivo se conserva mientras alguien lo siga usando.
    const { count: stillUsed } = await supabase
      .from("job_candidates")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);

    // Estrictamente 0: si el conteo falla llega null, y ahí es preferible
    // dejar el documento huérfano antes que borrar uno que sigue en uso.
    if (stillUsed === 0) {
      const { data: doc } = await supabase
        .from("candidate_documents")
        .select("id, storage_path, candidate_id")
        .eq("id", documentId)
        .maybeSingle();

      // Guarda extra: nunca tocar el CV de alguien que sí tiene cuenta
      if (doc && !doc.candidate_id) {
        // Las versiones de perfil van primero y a mano: la FK las dejaría
        // huérfanas con source_document_id NULL y el candidato seguiría
        // apareciendo en /admin/talento apuntando a un CV inexistente.
        await supabase
          .from("candidate_profile_versions")
          .delete()
          .eq("source_document_id", documentId)
          .is("candidate_id", null);

        const { error: docError } = await supabase
          .from("candidate_documents")
          .delete()
          .eq("id", documentId);

        if (docError) return { error: "Se quitó de la oferta, pero no se pudo borrar la hoja de vida." };

        await supabase.storage.from("cvs").remove([doc.storage_path as string]);
      }
    }
  }

  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  revalidatePath(`/admin/jobs/${jobId}/cvs`);
  revalidatePath(`/admin/jobs/${jobId}/applications`);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/candidates");
  return { success: true };
}

/**
 * Procesa la cola a mano. En local pg_cron no alcanza a localhost.
 *
 * Vacía la cola en lugar de procesar un solo lote. El pipeline de un CV son
 * tres pasos encadenados — texto → perfil → match — y cada paso encola el
 * siguiente solo al terminar, así que una única pasada avanza una etapa y hacen
 * falta tres clics por hoja de vida. En producción no se nota porque pg_cron
 * dispara cada minuto; en local es la diferencia entre un clic y seis.
 *
 * El endpoint del cron NO hace esto a propósito: allí cada invocación procesa
 * un lote y termina, para no pasarse del maxDuration de la función.
 */
export async function runScreeningWorkerAction(jobId: string) {
  await requireAdmin();

  const supabase = createAdminClient();
  const total = { claimed: 0, succeeded: 0, failed: 0, skipped: 0 };

  // Tope de seguridad: si algo se reencola sin parar, preferimos devolver el
  // control al operador antes que quedarnos girando.
  const MAX_PASSES = 15;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const summary = await dispatchPendingRuns(supabase);
    total.claimed += summary.claimed;
    total.succeeded += summary.succeeded;
    total.failed += summary.failed;
    total.skipped += summary.skipped;

    // Nada que reclamar: la cola está vacía o lo que queda espera su backoff
    if (summary.claimed === 0) break;
  }

  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  revalidatePath(`/admin/jobs/${jobId}/cvs`);
  return { success: true, summary: total };
}

// ─── Reporte individual de un candidato ───────────────────────────────────────

export interface RequirementDetail {
  type: string;
  requirementText: string;
  importance: string;
  status: string;
  matchType: string;
  matchScore: number;
  candidateValue: string | null;
  candidateEvidence: string | null;
  confidence: number | null;
}

export interface CandidateReport {
  jobTitle: string;
  jobCity: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  systemRef: number;
  createdAt: string;
  match: {
    overallScore: number;
    band: string;
    scoreConfidence: number;
    requirementsScore: number | null;
    categoryScores: Record<string, number | null>;
    criticalGaps: Array<{ requirementText: string; reason: string }>;
    explanation: {
      summary: string;
      strengths: string[];
      gaps: string[];
      questionsForRecruiter: string[];
    };
    scoringVersion: string;
    computedAt: string;
  } | null;
  requirements: RequirementDetail[];
}

/**
 * Trae todo lo necesario para el reporte imprimible de un candidato — spec §32.
 *
 * No calcula nada nuevo: solo lee lo que `calculate_match` ya guardó. El
 * reporte es una vista, no una fuente de verdad adicional.
 */
export async function getCandidateReportAction(
  jobCandidateId: string
): Promise<CandidateReport | { error: string }> {
  const { supabase } = await requireAdmin();

  const { data: jc } = await supabase
    .from("job_candidates")
    .select(
      `id, system_ref, display_name, email, phone, created_at,
       job:jobs(title, city),
       candidate:candidates(profile:profiles(full_name, email, phone))`
    )
    .eq("id", jobCandidateId)
    .maybeSingle();

  if (!jc) return { error: "Candidato no encontrado." };

  const job = Array.isArray(jc.job) ? jc.job[0] : jc.job;
  const candidate = Array.isArray(jc.candidate) ? jc.candidate[0] : jc.candidate;
  const profile = candidate
    ? Array.isArray(candidate.profile)
      ? candidate.profile[0]
      : candidate.profile
    : null;

  const { data: matchRow } = await supabase
    .from("match_results")
    .select(
      "id, overall_score, band, score_confidence, category_scores, critical_gaps, explanation, scoring_version, computed_at"
    )
    .eq("job_candidate_id", jobCandidateId)
    .eq("is_current", true)
    .maybeSingle();

  let requirements: RequirementDetail[] = [];
  let requirementsScore: number | null = null;

  if (matchRow) {
    const { data: reqs } = await supabase
      .from("match_requirement_results")
      .select(
        "requirement_type, requirement_text, importance, status, match_type, match_score, candidate_value, candidate_evidence, confidence"
      )
      .eq("match_result_id", matchRow.id)
      .order("importance", { ascending: true });

    requirements = (reqs ?? []).map((r) => ({
      type: r.requirement_type as string,
      requirementText: r.requirement_text as string,
      importance: r.importance as string,
      status: r.status as string,
      matchType: r.match_type as string,
      matchScore: Number(r.match_score),
      candidateValue: r.candidate_value as string | null,
      candidateEvidence: r.candidate_evidence as string | null,
      confidence: r.confidence !== null ? Number(r.confidence) : null,
    }));

    const mandatory = requirements.filter((r) => r.importance !== "preferred");
    requirementsScore =
      mandatory.length === 0
        ? null
        : Math.round((100 * mandatory.reduce((sum, r) => sum + r.matchScore, 0)) / mandatory.length);
  }

  return {
    jobTitle: (job?.title as string) ?? "Oferta",
    jobCity: (job?.city as string) ?? null,
    displayName: (profile?.full_name as string) ?? (jc.display_name as string) ?? "Sin nombre",
    email: (profile?.email as string) ?? (jc.email as string) ?? null,
    phone: (profile?.phone as string) ?? (jc.phone as string) ?? null,
    systemRef: jc.system_ref as number,
    createdAt: jc.created_at as string,
    match: matchRow
      ? {
          overallScore: matchRow.overall_score as number,
          band: matchRow.band as string,
          scoreConfidence: Number(matchRow.score_confidence),
          requirementsScore,
          categoryScores: (matchRow.category_scores as Record<string, number | null>) ?? {},
          criticalGaps:
            (matchRow.critical_gaps as Array<{ requirementText: string; reason: string }>) ?? [],
          explanation: matchRow.explanation as CandidateReport["match"] extends null
            ? never
            : { summary: string; strengths: string[]; gaps: string[]; questionsForRecruiter: string[] },
          scoringVersion: matchRow.scoring_version as string,
          computedAt: matchRow.computed_at as string,
        }
      : null,
    requirements,
  };
}
