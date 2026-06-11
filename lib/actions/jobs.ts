"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { jobSchema } from "@/lib/validations/job";
import { generateSlug } from "@/lib/utils/slug";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  return { supabase, user };
}

// ─── Crear oferta ─────────────────────────────────────────────────────────────

export async function createJobAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const company_id = (formData.get("company_id") as string) || null;

  const raw = {
    title:          formData.get("title") as string,
    area_id:        Number(formData.get("area_id")),
    modality:       formData.get("modality") as string,
    contract_type:  formData.get("contract_type") as string,
    city:           formData.get("city") as string,
    department:     (formData.get("department") as string) || undefined,
    vacancies:      Number(formData.get("vacancies")),
    salary_min:     formData.get("salary_min") ? Number(formData.get("salary_min")) : null,
    salary_max:     formData.get("salary_max") ? Number(formData.get("salary_max")) : null,
    salary_visible: formData.get("salary_visible") === "true",
    description:    formData.get("description") as string,
    requirements:   (formData.get("requirements") as string) || undefined,
    benefits:       (formData.get("benefits") as string) || undefined,
    featured:       formData.get("featured") === "true",
    status:         (formData.get("status") as string) || "active",
    expires_at:     (formData.get("expires_at") as string) || null,
  };

  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const slug = await generateUniqueSlug(supabase, parsed.data.title);

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      ...parsed.data,
      slug,
      company_id,
      created_by: user.id,
      published_at: parsed.data.status === "active" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: { _form: ["Error al crear la oferta. Intenta de nuevo."] } };
  }

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  redirect(`/admin/jobs/${job.id}/applications`);
}

// ─── Actualizar oferta ────────────────────────────────────────────────────────

export async function updateJobAction(jobId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const company_id = (formData.get("company_id") as string) || null;

  const raw = {
    title:          formData.get("title") as string,
    area_id:        Number(formData.get("area_id")),
    modality:       formData.get("modality") as string,
    contract_type:  formData.get("contract_type") as string,
    city:           formData.get("city") as string,
    department:     (formData.get("department") as string) || undefined,
    vacancies:      Number(formData.get("vacancies")),
    salary_min:     formData.get("salary_min") ? Number(formData.get("salary_min")) : null,
    salary_max:     formData.get("salary_max") ? Number(formData.get("salary_max")) : null,
    salary_visible: formData.get("salary_visible") === "true",
    description:    formData.get("description") as string,
    requirements:   (formData.get("requirements") as string) || undefined,
    benefits:       (formData.get("benefits") as string) || undefined,
    featured:       formData.get("featured") === "true",
    status:         (formData.get("status") as string) || "active",
    expires_at:     (formData.get("expires_at") as string) || null,
  };

  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Si se activa una oferta que estaba en borrador, establecer published_at
  const { data: existingJob } = await supabase
    .from("jobs")
    .select("status, published_at")
    .eq("id", jobId)
    .single();

  const published_at =
    parsed.data.status === "active" && !existingJob?.published_at
      ? new Date().toISOString()
      : existingJob?.published_at;

  const { error } = await supabase
    .from("jobs")
    .update({
      ...parsed.data,
      company_id,
      published_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    return { error: { _form: ["Error al actualizar la oferta."] } };
  }

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/jobs");
  redirect("/admin/jobs");
}

// ─── Cambiar estado de oferta ─────────────────────────────────────────────────

export async function updateJobStatusAction(
  jobId: string,
  status: "draft" | "active" | "paused" | "closed" | "pending_review"
) {
  await requireAdmin();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "active") {
    const { data } = await supabase
      .from("jobs")
      .select("published_at")
      .eq("id", jobId)
      .single();
    if (!data?.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) return { error: "No se pudo cambiar el estado." };

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { success: true };
}

// ─── Aprobar oferta de empresa (pending_review → active) ─────────────────────

export async function approveJobAction(jobId: string, reviewNotes?: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("jobs")
    .select("published_at")
    .eq("id", jobId)
    .single();

  const { error } = await supabase
    .from("jobs")
    .update({
      status:       "active",
      published_at: existing?.published_at ?? new Date().toISOString(),
      review_notes: reviewNotes ?? null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending_review");

  if (error) return { error: "No se pudo aprobar la oferta." };

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { success: true };
}

// ─── Rechazar oferta de empresa (pending_review → draft) ─────────────────────

export async function rejectJobAction(jobId: string, reviewNotes: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("jobs")
    .update({
      status:       "draft",
      review_notes: reviewNotes || null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending_review");

  if (error) return { error: "No se pudo rechazar la oferta." };

  revalidatePath("/admin/jobs");
  return { success: true };
}

// ─── Eliminar oferta ──────────────────────────────────────────────────────────

export async function deleteJobAction(jobId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);

  if (error) return { error: "No se pudo eliminar la oferta." };

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { success: true };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

async function generateUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  title: string
): Promise<string> {
  const base = generateSlug(title);
  let slug = base;
  let attempt = 1;

  while (true) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) break;
    slug = `${base}-${attempt}`;
    attempt++;
  }

  return slug;
}
