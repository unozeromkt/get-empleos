"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { aiConfig, DOCUMENT_LIMITS, isAllowedMimeType, extensionForMime } from "@/lib/ai/config";
import {
  buildBenefits,
  buildDescription,
  buildRequirements,
  mapEmploymentType,
  mapSalary,
  mapWorkMode,
} from "@/lib/ai/job-mapper";
import { jobProfileSchema, type JobProfile } from "@/lib/ai/schemas/job-profile";
import { sha256 } from "@/lib/documents/hash";
import { enqueueRun } from "@/lib/queue/enqueue";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/utils/slug";

const BUCKET = "job-documents";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  return { supabase, user };
}

// ─── Subir documento de oferta ────────────────────────────────────────────────

/**
 * Sube un Word/PDF y encola su procesamiento.
 *
 * Responde de inmediato: la extracción ocurre en la cola, no aquí. Una función
 * serverless no puede sostener una llamada al LLM sin arriesgar un timeout.
 */
export async function uploadJobDocumentAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  if (!aiConfig.enabled || !aiConfig.features.jobCreation) {
    return { error: "La creación de ofertas con IA no está habilitada." };
  }

  const file = formData.get("document") as File | null;
  if (!file || file.size === 0) {
    return { error: "Selecciona un archivo PDF o Word." };
  }

  if (!isAllowedMimeType(file.type)) {
    return { error: "El archivo debe ser PDF o Word (.docx)." };
  }

  if (file.size > DOCUMENT_LIMITS.maxSizeBytes) {
    return { error: "El archivo no puede superar 10 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buffer);

  // Nombre generado por el sistema: nunca usar el del usuario en la ruta (spec §28)
  const storagePath = `${user.id}/${randomUUID()}.${extensionForMime(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return {
      error: `No se pudo subir el archivo. Verifica que el bucket "${BUCKET}" exista y sea privado.`,
    };
  }

  const companyId = (formData.get("company_id") as string) || null;

  const { data: doc, error: insertError } = await supabase
    .from("job_documents")
    .insert({
      company_id: companyId,
      uploaded_by: user.id,
      storage_path: storagePath,
      original_filename: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      sha256: hash,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (insertError || !doc) {
    // No dejar el archivo huérfano en Storage si falla el registro
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: "No se pudo registrar el documento." };
  }

  const enqueued = await enqueueRun(supabase, {
    runType: "extract_document_text",
    entityType: "job_document",
    entityId: doc.id as string,
    inputHash: hash,
  });

  if ("error" in enqueued) {
    return { error: "El documento se subió pero no se pudo encolar su procesamiento." };
  }

  revalidatePath("/admin/jobs");
  return { success: true, documentId: doc.id as string };
}

// ─── Estado del procesamiento (polling desde la UI) ───────────────────────────

export async function getJobDocumentStatusAction(documentId: string) {
  const { supabase } = await requireAdmin();

  const { data: doc } = await supabase
    .from("job_documents")
    .select("id, status, error_code, error_message, original_filename")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return { error: "Documento no encontrado." };

  const { data: version } = await supabase
    .from("job_profile_versions")
    .select("id")
    .eq("source_document_id", documentId)
    .eq("status", "draft")
    .maybeSingle();

  return {
    status: doc.status as string,
    errorCode: doc.error_code as string | null,
    errorMessage: doc.error_message as string | null,
    filename: doc.original_filename as string,
    profileVersionId: (version?.id as string) ?? null,
  };
}

// ─── Reintentar un documento fallido ──────────────────────────────────────────

export async function retryJobDocumentAction(documentId: string) {
  const { supabase } = await requireAdmin();

  await supabase
    .from("job_documents")
    .update({ status: "uploaded", error_code: null, error_message: null })
    .eq("id", documentId);

  const enqueued = await enqueueRun(supabase, {
    runType: "extract_document_text",
    entityType: "job_document",
    entityId: documentId,
  });

  if ("error" in enqueued) return { error: "No se pudo reencolar el procesamiento." };

  revalidatePath(`/admin/jobs/new-ai/${documentId}/review`);
  return { success: true };
}

// ─── Confirmar y publicar ─────────────────────────────────────────────────────

/**
 * Crea la oferta a partir del perfil revisado por el admin.
 *
 * La IA nunca llega hasta aquí sola: este paso solo ocurre tras la pantalla de
 * Review & Confirm (spec §5.3, §30 human-in-the-loop).
 */
export async function confirmJobProfileAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const profileVersionId = formData.get("profile_version_id") as string;
  const rawProfile = formData.get("profile") as string;

  if (!profileVersionId || !rawProfile) {
    return { error: "Faltan datos para confirmar la oferta." };
  }

  // El perfil llega editado desde el formulario: se revalida siempre.
  // Nunca se persiste un JSON que no valide contra el schema (spec §23).
  let profile: JobProfile;
  try {
    const parsed = jobProfileSchema.safeParse(JSON.parse(rawProfile));
    if (!parsed.success) {
      return { error: "El perfil editado no es válido. Revisa los campos." };
    }
    profile = parsed.data;
  } catch {
    return { error: "El perfil editado no se pudo leer." };
  }

  const { data: version } = await supabase
    .from("job_profile_versions")
    .select("id, source_document_id, job_id, ai_profile")
    .eq("id", profileVersionId)
    .maybeSingle();

  if (!version) return { error: "El perfil extraído ya no existe." };
  if (version.job_id) return { error: "Esta oferta ya fue creada." };

  // Campos que el admin elige en el formulario, no la IA
  const areaId = Number(formData.get("area_id"));
  const vacancies = Number(formData.get("vacancies")) || 1;
  const status = (formData.get("status") as string) || "draft";
  const companyId = (formData.get("company_id") as string) || null;
  const city = (formData.get("city") as string) || profile.location.city || "";

  if (!city.trim()) return { error: "La ciudad es obligatoria." };
  if (!Number.isFinite(areaId) || areaId <= 0) return { error: "Selecciona un área válida." };

  const salary = mapSalary(profile);
  const slug = await generateUniqueSlug(supabase, profile.title);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      title: profile.title,
      slug,
      description: buildDescription(profile),
      requirements: buildRequirements(profile),
      benefits: buildBenefits(profile),
      area_id: areaId,
      modality: mapWorkMode(profile),
      contract_type: mapEmploymentType(profile),
      salary_min: salary.min,
      salary_max: salary.max,
      salary_visible: formData.get("salary_visible") === "true",
      city: city.trim(),
      department: profile.location.region,
      vacancies,
      status,
      company_id: companyId,
      created_by: user.id,
      ai_generated: true,
      published_at: status === "active" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: "No se pudo crear la oferta." };
  }

  // Enlaza el perfil canónico con la oferta y lo marca confirmado.
  // `profile` guarda lo aprobado por el humano; `ai_profile` conserva intacto
  // lo que extrajo la IA, para poder medir cuánto corrige el revisor (spec §37).
  await supabase
    .from("job_profile_versions")
    .update({
      job_id: job.id,
      profile,
      profile_hash: sha256(JSON.stringify(profile)),
      status: "confirmed",
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", profileVersionId);

  await supabase
    .from("jobs")
    .update({ current_profile_version_id: profileVersionId })
    .eq("id", job.id);

  if (version.source_document_id) {
    await supabase
      .from("job_documents")
      .update({ status: "ready", job_id: job.id })
      .eq("id", version.source_document_id);
  }

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  redirect(`/admin/jobs/${job.id}/perfil`);
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

async function generateUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string
): Promise<string> {
  const base = generateSlug(title) || "oferta";
  let slug = base;
  let attempt = 1;

  while (attempt < 100) {
    const { data } = await supabase.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${attempt}`;
    attempt++;
  }

  return `${base}-${Date.now()}`;
}

// ─── URL firmada del documento original ───────────────────────────────────────

/** El documento fuente nunca se expone con URL pública permanente (spec §28). */
export async function getJobDocumentUrlAction(documentId: string) {
  const { supabase } = await requireAdmin();

  const { data: doc } = await supabase
    .from("job_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return null;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path as string, 60 * 60);

  return data?.signedUrl ?? null;
}

// ─── Disparo manual del worker (desarrollo y rescate) ─────────────────────────

/**
 * Procesa la cola ahora mismo sin esperar al cron.
 * Útil en local, donde pg_cron no puede alcanzar a localhost.
 */
export async function runWorkerNowAction() {
  await requireAdmin();

  const { dispatchPendingRuns } = await import("@/lib/queue/dispatch");
  const summary = await dispatchPendingRuns(createAdminClient());

  return { success: true, summary };
}
