"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  mapProfileToFlatFields,
  type FlatCandidateFields,
} from "@/lib/ai/candidate-mapper";
import {
  candidateProfileSchema,
  type CandidateProfile,
} from "@/lib/ai/schemas/candidate-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dispatchPendingRuns } from "@/lib/queue/dispatch";
import { isProfileCompleteForApplying } from "@/lib/utils/profile-complete";

async function requireCandidate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  return { supabase, user };
}

// ─── Estado del procesamiento del CV (polling) ────────────────────────────────

export async function getCVProcessingStatusAction() {
  const { supabase, user } = await requireCandidate();

  const { data: doc } = await supabase
    .from("candidate_documents")
    .select("id, status, error_code, error_message")
    .eq("candidate_id", user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (!doc) return { status: "none" as const };

  const { data: version } = await supabase
    .from("candidate_profile_versions")
    .select("id, status")
    .eq("candidate_id", user.id)
    .eq("is_current", true)
    .maybeSingle();

  return {
    status: doc.status as string,
    errorCode: doc.error_code as string | null,
    errorMessage: doc.error_message as string | null,
    profileVersionId: (version?.id as string) ?? null,
    /** true si el candidato ya revisó y confirmó este perfil */
    alreadyConfirmed: version?.status === "confirmed",
  };
}

// ─── Vista previa: qué rellenaría la IA y qué discrepa ────────────────────────

/**
 * Calcula la propuesta SIN aplicarla.
 *
 * La separación importa: el candidato debe poder ver exactamente qué va a
 * cambiar antes de que nada se toque (spec §33).
 */
export async function getProfileSuggestionsAction() {
  const { supabase, user } = await requireCandidate();

  const { data: version } = await supabase
    .from("candidate_profile_versions")
    .select("id, ai_profile, overall_confidence, status")
    .eq("candidate_id", user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (!version) return { error: "Todavía no hay un perfil extraído de tu hoja de vida." };

  const parsed = candidateProfileSchema.safeParse(version.ai_profile);
  if (!parsed.success) {
    return { error: "El perfil extraído no es válido. Vuelve a subir tu hoja de vida." };
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("career, education_level, years_experience, availability, linkedin_url, summary, skills, languages")
    .eq("id", user.id)
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, phone, city")
    .eq("id", user.id)
    .maybeSingle();

  const current: Partial<FlatCandidateFields> = {
    full_name: (profileRow?.full_name as string) ?? null,
    phone: (profileRow?.phone as string) ?? null,
    city: (profileRow?.city as string) ?? null,
    education_level: (candidate?.education_level as FlatCandidateFields["education_level"]) ?? null,
    career: (candidate?.career as string) ?? null,
    years_experience: (candidate?.years_experience as number) ?? null,
    availability: (candidate?.availability as string) ?? null,
    linkedin_url: (candidate?.linkedin_url as string) ?? null,
    summary: (candidate?.summary as string) ?? null,
    skills: (candidate?.skills as string[]) ?? [],
    languages: (candidate?.languages as string[]) ?? [],
  };

  const { filled, suggestions } = mapProfileToFlatFields(current, parsed.data);

  return {
    profileVersionId: version.id as string,
    profile: parsed.data,
    confidence: Number(version.overall_confidence ?? 0),
    alreadyConfirmed: version.status === "confirmed",
    filled,
    suggestions,
    current,
  };
}

// ─── Confirmar el perfil extraído ─────────────────────────────────────────────

/**
 * Aplica al perfil del candidato lo que él aprobó.
 *
 * `accepted` trae solo las discrepancias que la persona decidió adoptar. Todo
 * lo que no venga ahí conserva su valor original: el dato confirmado por el
 * ser humano gana sobre la inferencia (spec §33).
 */
export async function confirmCandidateProfileAction(formData: FormData) {
  const { supabase, user } = await requireCandidate();

  const profileVersionId = formData.get("profile_version_id") as string;
  if (!profileVersionId) return { error: "Falta el identificador del perfil." };

  const suggestions = await getProfileSuggestionsAction();
  if ("error" in suggestions) return { error: suggestions.error };
  if (suggestions.profileVersionId !== profileVersionId) {
    return { error: "El perfil cambió mientras lo revisabas. Recarga la página." };
  }

  const updates: Record<string, unknown> = { ...suggestions.filled };

  // Discrepancias aceptadas explícitamente por el candidato
  const accepted = formData.getAll("accept") as string[];
  for (const field of accepted) {
    const suggestion = suggestions.suggestions.find((s) => s.field === field);
    if (!suggestion) continue;

    updates[field] =
      field === "years_experience" ? Number(suggestion.suggestedValue) : suggestion.suggestedValue;
  }

  // full_name, phone y city viven en `profiles`; el resto en `candidates`
  const profileUpdates: Record<string, unknown> = {};
  if ("full_name" in updates) profileUpdates.full_name = updates.full_name;
  if ("phone" in updates) profileUpdates.phone = updates.phone;
  if ("city" in updates) profileUpdates.city = updates.city;
  delete updates.full_name;
  delete updates.phone;
  delete updates.city;

  if (Object.keys(profileUpdates).length > 0) {
    profileUpdates.updated_at = new Date().toISOString();
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", user.id);
    if (error) return { error: "No se pudieron guardar tus datos personales." };
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("candidates").update(updates).eq("id", user.id);
    if (error) return { error: "No se pudo guardar tu perfil profesional." };
  }

  // Recalcular profile_complete con los valores ya aplicados, usando la misma
  // regla que updateCandidateProfileAction y uploadCVAction (lib/utils/profile-complete.ts)
  const [{ data: freshProfile }, { data: freshCandidate }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("candidates").select("cv_url").eq("id", user.id).maybeSingle(),
  ]);

  const profileComplete = isProfileCompleteForApplying({
    fullName: freshProfile?.full_name,
    phone: freshProfile?.phone,
    cvUrl: freshCandidate?.cv_url,
  });

  await supabase
    .from("candidates")
    .update({ profile_complete: profileComplete, current_profile_version_id: profileVersionId })
    .eq("id", user.id);

  // Guardar el perfil confirmado junto al extraído, sin pisarlo: la diferencia
  // entre ambos es lo que mide candidate_profile_correction_rate (spec §37)
  const confirmed: CandidateProfile = suggestions.profile;
  await supabase
    .from("candidate_profile_versions")
    .update({
      confirmed_profile: confirmed,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", profileVersionId);

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { success: true, profileComplete };
}

// ─── Disparo manual del worker (desarrollo) ───────────────────────────────────

/** En local pg_cron no alcanza a localhost, así que la cola se empuja a mano. */
export async function runCandidateWorkerNowAction() {
  await requireCandidate();
  const summary = await dispatchPendingRuns(createAdminClient());
  return { success: true, summary };
}
