"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { aiConfig, TALENT_SEARCH_LIMITS } from "@/lib/ai/config";
import { getTalentQueryProvider } from "@/lib/ai/providers";
import { AIExtractionError } from "@/lib/ai/provider";
import { talentQuerySchema, isEmptyQuery, type TalentQuery } from "@/lib/ai/schemas/talent-query";
import { sha256 } from "@/lib/documents/hash";
import { enqueueRun } from "@/lib/queue/enqueue";
import { normalizeTerm, sanitizeQuery, wrapQuery } from "@/lib/search/normalize";
import { runTalentSearch, type TalentSearchOutcome } from "@/lib/search/talent-search";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions de la búsqueda de talento — módulo 04.
 *
 * Solo admin de Get Company. Ni empresas ni candidatos tienen acceso a nada de
 * este módulo, ni por ruta ni por RLS.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  return { supabase, user };
}

export interface TalentSearchResponse {
  query: TalentQuery | null;
  outcome: TalentSearchOutcome | null;
  searchId: string | null;
  /** true si el parseo se reutilizó de una búsqueda idéntica anterior. */
  cached: boolean;
  error: string | null;
}

// ─── Buscar desde lenguaje natural ────────────────────────────────────────────

export async function searchTalentAction(rawQuery: string): Promise<TalentSearchResponse> {
  const { supabase, user } = await requireAdmin();

  const empty: TalentSearchResponse = {
    query: null,
    outcome: null,
    searchId: null,
    cached: false,
    error: null,
  };

  if (!aiConfig.enabled || !aiConfig.features.talentSearch) {
    return { ...empty, error: "La búsqueda por lenguaje natural está deshabilitada." };
  }

  const clean = sanitizeQuery(rawQuery, TALENT_SEARCH_LIMITS.maxQueryChars);

  if (clean.length < 3) {
    return { ...empty, error: "Escribe qué perfil estás buscando." };
  }

  const queryHash = sha256(normalizeTerm(clean));

  // Caché de parseo (spec §34): la misma frase no se paga dos veces
  const { data: previous } = await supabase
    .from("talent_searches")
    .select("parsed_query")
    .eq("query_hash", queryHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query: TalentQuery;
  let cached = false;
  let cost: {
    provider: string | null;
    model: string | null;
    promptVersion: string | null;
    tokensIn: number | null;
    tokensOut: number | null;
    costUsd: number | null;
  } = { provider: null, model: null, promptVersion: null, tokensIn: null, tokensOut: null, costUsd: null };

  const reused = previous ? talentQuerySchema.safeParse(previous.parsed_query) : null;

  if (reused?.success) {
    query = reused.data;
    cached = true;
  } else {
    try {
      const parsed = await getTalentQueryProvider().parseTalentQuery(wrapQuery(clean));
      query = parsed.data;
      cost = {
        provider: parsed.metadata.provider,
        model: parsed.metadata.model,
        promptVersion: parsed.metadata.promptVersion,
        tokensIn: parsed.metadata.tokensIn,
        tokensOut: parsed.metadata.tokensOut,
        costUsd: parsed.metadata.costUsd,
      };
    } catch (err) {
      const code = err instanceof AIExtractionError ? err.code : "PROVIDER_ERROR";
      return { ...empty, error: messageForCode(code) };
    }
  }

  if (isEmptyQuery(query)) {
    return {
      ...empty,
      query,
      error:
        "No identifiqué ningún criterio evaluable en esa frase. Prueba nombrando un cargo, una habilidad o los años de experiencia.",
    };
  }

  const outcome = await runTalentSearch(supabase, query);

  const { data: inserted } = await supabase
    .from("talent_searches")
    .insert({
      created_by: user.id,
      raw_query: clean,
      query_hash: queryHash,
      parsed_query: query,
      results_count: outcome.results.length,
      evaluated_count: outcome.evaluated,
      model_provider: cost.provider,
      model_name: cost.model,
      prompt_version: cost.promptVersion,
      tokens_in: cost.tokensIn,
      tokens_out: cost.tokensOut,
      cost_usd: cost.costUsd,
    })
    .select("id")
    .maybeSingle();

  return { query, outcome, searchId: inserted?.id ?? null, cached, error: null };
}

// ─── Re-ejecutar con los criterios editados ───────────────────────────────────

/**
 * Editar un chip NO llama al LLM: la consulta ya está estructurada, así que
 * solo se rehacen el recall y el scoring. Coste cero y respuesta inmediata.
 */
export async function refineSearchAction(query: TalentQuery): Promise<TalentSearchResponse> {
  const { supabase } = await requireAdmin();

  const parsed = talentQuerySchema.safeParse(query);

  if (!parsed.success) {
    return { query: null, outcome: null, searchId: null, cached: true, error: "Criterios inválidos." };
  }

  if (isEmptyQuery(parsed.data)) {
    return {
      query: parsed.data,
      outcome: null,
      searchId: null,
      cached: true,
      error: "No queda ningún criterio de búsqueda.",
    };
  }

  const outcome = await runTalentSearch(supabase, parsed.data);

  return { query: parsed.data, outcome, searchId: null, cached: true, error: null };
}

// ─── Procesar las hojas de vida que faltan ────────────────────────────────────

/**
 * Encola la extracción de los CV vigentes que todavía no tienen perfil canónico.
 * `extract_document_text` encadena solo con la extracción de perfil, así que
 * basta con encolar el primer paso.
 */
export async function processPendingCvsAction(): Promise<{ queued: number; error?: string }> {
  const { supabase } = await requireAdmin();

  if (!aiConfig.enabled) return { queued: 0, error: "El módulo de IA está deshabilitado." };

  const [{ data: documents }, { data: indexed }] = await Promise.all([
    // El criterio es "no está en el índice de búsqueda", no el estado del
    // documento: un CV puede figurar como 'ready' y aun así no ser buscable
    // si su perfil canónico nunca llegó a indexarse.
    supabase.from("candidate_documents").select("id, sha256").eq("is_current", true),
    supabase.from("candidate_search_index").select("document_id"),
  ]);

  const alreadyIndexed = new Set((indexed ?? []).map((r) => r.document_id as string));
  const pending = (documents ?? []).filter((d) => !alreadyIndexed.has(d.id as string));

  if (pending.length === 0) return { queued: 0 };

  const admin = createAdminClient();
  let queued = 0;

  for (const doc of pending) {
    const result = await enqueueRun(admin, {
      runType: "extract_document_text",
      entityType: "candidate_document",
      entityId: doc.id as string,
      inputHash: (doc.sha256 as string | null) ?? null,
    });

    if ("id" in result) queued++;
  }

  revalidatePath("/admin/talento");
  return { queued };
}

// ─── Ver el CV ────────────────────────────────────────────────────────────────

export async function getCvUrlAction(documentId: string): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireAdmin();

  const { data: doc } = await supabase
    .from("candidate_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc?.storage_path) return { error: "Esta persona no tiene hoja de vida asociada." };

  // URL firmada de vida corta: el bucket es privado y debe seguir siéndolo
  const { data: signed, error } = await createAdminClient()
    .storage.from("cvs")
    .createSignedUrl(doc.storage_path as string, 300);

  if (error || !signed) return { error: "No se pudo generar el enlace a la hoja de vida." };

  return { url: signed.signedUrl };
}

// ─── Añadir un resultado a una vacante ────────────────────────────────────────

/**
 * Lleva a la persona del buscador al pipeline de una oferta concreta.
 *
 * Es la única escritura del módulo fuera de sus propias tablas, y usa el mismo
 * camino que la carga masiva: crea un `job_candidates` y encola el match real
 * contra el perfil de esa oferta. El score de la búsqueda NO se copia: mide
 * encaje con una frase, no con la vacante.
 */
export async function addToJobAction(
  profileVersionId: string,
  jobId: string
): Promise<{ success?: true; error?: string }> {
  const { supabase, user } = await requireAdmin();

  const { data: row } = await supabase
    .from("candidate_search_index")
    .select("profile_version_id, candidate_id, document_id, display_name")
    .eq("profile_version_id", profileVersionId)
    .maybeSingle();

  if (!row) return { error: "Ese perfil ya no está disponible." };

  // Evita duplicar a la misma persona en la misma oferta
  const { data: existing } = await supabase
    .from("job_candidates")
    .select("id, candidate_id, document_id")
    .eq("job_id", jobId);

  const duplicate = (existing ?? []).some(
    (jc) =>
      (row.candidate_id && jc.candidate_id === row.candidate_id) ||
      (row.document_id && jc.document_id === row.document_id)
  );

  if (duplicate) return { error: "Esta persona ya está en esa oferta." };

  const { data: inserted, error } = await supabase
    .from("job_candidates")
    .insert({
      job_id: jobId,
      source: "admin_upload",
      application_id: null,
      candidate_id: row.candidate_id,
      document_id: row.document_id,
      profile_version_id: row.profile_version_id,
      display_name: (row.display_name as string | null)?.slice(0, 200) ?? null,
      status: "pending",
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) return { error: "No se pudo añadir a la oferta." };

  await enqueueRun(createAdminClient(), {
    runType: "calculate_match",
    entityType: "job_candidate",
    entityId: inserted.id as string,
  });

  revalidatePath(`/admin/jobs/${jobId}/candidatos`);
  return { success: true };
}

// ─── Búsquedas guardadas ──────────────────────────────────────────────────────

export async function saveSearchAction(
  searchId: string,
  label: string
): Promise<{ success?: true; error?: string }> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("talent_searches")
    .update({ is_saved: true, label: label.trim().slice(0, 120) })
    .eq("id", searchId);

  if (error) return { error: "No se pudo guardar la búsqueda." };

  revalidatePath("/admin/talento");
  return { success: true };
}

function messageForCode(code: string): string {
  switch (code) {
    case "AI_DISABLED":
      return "El módulo de IA está deshabilitado.";
    case "TIMEOUT":
    case "CONNECTION_ERROR":
      return "El proveedor de IA no respondió. Inténtalo de nuevo.";
    case "RATE_LIMITED":
      return "Demasiadas búsquedas seguidas. Espera unos segundos.";
    case "REFUSAL":
      return "No pude interpretar esa búsqueda. Reformúlala en otros términos.";
    default:
      return "No se pudo interpretar la búsqueda. Inténtalo de nuevo.";
  }
}
