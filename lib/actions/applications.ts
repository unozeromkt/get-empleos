"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applicationSchema, applicationStatusSchema } from "@/lib/validations/application";
import { sendApplicationReceivedEmail, sendStatusChangedEmail } from "@/lib/email";
import { formatDate } from "@/lib/utils/date";

// ─── Postularse a una oferta ──────────────────────────────────────────────────

export async function applyToJobAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const raw = {
    job_id:       formData.get("job_id") as string,
    cover_letter: (formData.get("cover_letter") as string) || "",
  };

  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Verificar que el candidato tiene perfil completo
  const { data: candidate } = await supabase
    .from("candidates")
    .select("profile_complete")
    .eq("id", user.id)
    .single();

  if (!candidate?.profile_complete) {
    return {
      error: {
        _form: [
          "Debes completar tu perfil antes de postularte. Ve a Mi Perfil.",
        ],
      },
    };
  }

  // Verificar que la oferta está activa
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, title")
    .eq("id", parsed.data.job_id)
    .single();

  if (!job || job.status !== "active") {
    return { error: { _form: ["Esta oferta no está disponible."] } };
  }

  // Verificar que no haya postulado antes (UNIQUE constraint en DB también lo protege)
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", parsed.data.job_id)
    .eq("candidate_id", user.id)
    .maybeSingle();

  if (existing) {
    return { error: { _form: ["Ya te postulaste a esta oferta anteriormente."] } };
  }

  const { error } = await supabase.from("applications").insert({
    job_id:       parsed.data.job_id,
    candidate_id: user.id,
    cover_letter: parsed.data.cover_letter || null,
    status:       "pending",
  });

  if (error) {
    return { error: { _form: ["Error al enviar la postulación. Intenta de nuevo."] } };
  }

  // Enviar email de confirmación (sin bloquear la respuesta)
  const { data: candidateProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const { data: jobDetails } = await supabase
    .from("jobs")
    .select("title, city")
    .eq("id", parsed.data.job_id)
    .single();

  if (candidateProfile && jobDetails) {
    sendApplicationReceivedEmail({
      to:            candidateProfile.email,
      candidateName: candidateProfile.full_name,
      jobTitle:      jobDetails.title,
      jobCity:       jobDetails.city,
      appliedAt:     formatDate(new Date().toISOString()),
    }).catch(console.error); // Fire-and-forget
  }

  revalidatePath("/applications");
  revalidatePath(`/jobs/${job.id}`);
  return { success: true, jobTitle: job.title };
}

// ─── Cambiar estado de postulación (admin) ────────────────────────────────────

export async function updateApplicationStatusAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Verificar admin desde app_metadata (no requiere query a profiles)
  if (user.app_metadata?.role !== "admin") {
    return { error: "No tienes permiso para realizar esta acción." };
  }

  const raw = {
    application_id: formData.get("application_id") as string,
    status:         formData.get("status") as string,
    admin_notes:    (formData.get("admin_notes") as string) || "",
  };

  const parsed = applicationStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const { error } = await supabase
    .from("applications")
    .update({
      status:      parsed.data.status,
      admin_notes: parsed.data.admin_notes || null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", parsed.data.application_id);

  if (error) {
    return { error: "Error al actualizar el estado." };
  }

  // Enviar email de notificación al candidato (excepto cuando pasa a "pending")
  if (parsed.data.status !== "pending") {
    const { data: appData } = await supabase
      .from("applications")
      .select("candidate_id, job:jobs(title)")
      .eq("id", parsed.data.application_id)
      .single();

    if (appData) {
      const { data: candidateProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", appData.candidate_id)
        .single();

      // Supabase JOIN puede devolver array o objeto — aplanamos
      const jobRaw = appData.job as { title: string }[] | { title: string } | null;
      const jobTitle = Array.isArray(jobRaw) ? (jobRaw[0]?.title ?? "la oferta") : (jobRaw?.title ?? "la oferta");

      if (candidateProfile) {
        sendStatusChangedEmail({
          to:            candidateProfile.email,
          candidateName: candidateProfile.full_name,
          jobTitle,
          newStatus:     parsed.data.status as "reviewing" | "shortlisted" | "rejected" | "hired",
        }).catch(console.error);
      }
    }
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin/jobs");
  return { success: true };
}

// ─── Verificar si ya se postuló (para UI) ────────────────────────────────────

export async function checkExistingApplication(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_id", user.id)
    .maybeSingle();

  return !!data;
}
