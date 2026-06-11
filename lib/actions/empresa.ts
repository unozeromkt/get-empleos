"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils/slug";
import type { ApplicationStatus } from "@/lib/types/database";

// ─── Helper: normalizar URL de sitio web ─────────────────────────────────────

function normalizeWebsite(raw: FormData | string | null | undefined): string | null {
  const val = raw instanceof FormData
    ? (raw.get("website") as string | null)
    : raw;
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// ─── Helper: verificar sesión y obtener empresa ──────────────────────────────

async function requireCompany() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "company") redirect("/dashboard");

  const { data: company } = await supabase
    .from("companies")
    .select("id, status")
    .eq("created_by", user.id)
    .maybeSingle();

  return { supabase, user, company };
}

// ─── Crear perfil de empresa (onboarding) ────────────────────────────────────

export async function createEmpresaProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "company") redirect("/dashboard");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: { name: ["El nombre de la empresa es obligatorio."] } };

  // Protección: un usuario solo puede tener un perfil de empresa
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("created_by", user.id)
    .maybeSingle();

  if (existing) redirect("/empresa");

  const { error } = await supabase.from("companies").insert({
    name,
    nit:         (formData.get("nit") as string) || null,
    legal_rep:   (formData.get("legal_rep") as string) || null,
    city:        (formData.get("city") as string) || null,
    industry:    (formData.get("industry") as string) || null,
    website:     normalizeWebsite(formData),
    description: (formData.get("description") as string) || null,
    created_by:  user.id,
    status:      "pending",
  });

  if (error) return { error: { _form: ["Error al crear el perfil. Intenta de nuevo."] } };

  revalidatePath("/empresa");
  redirect("/empresa");
}

// ─── Actualizar perfil de empresa ────────────────────────────────────────────

export async function updateEmpresaProfileAction(
  companyId: string,
  formData: FormData
) {
  const { supabase, company } = await requireCompany();

  if (!company || company.id !== companyId) {
    return { error: { _form: ["No tienes permiso para editar este perfil."] } };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: { name: ["El nombre es obligatorio."] } };

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      nit:         (formData.get("nit") as string) || null,
      legal_rep:   (formData.get("legal_rep") as string) || null,
      city:        (formData.get("city") as string) || null,
      industry:    (formData.get("industry") as string) || null,
      website:     normalizeWebsite(formData),
      description: (formData.get("description") as string) || null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) return { error: { _form: ["Error al actualizar el perfil."] } };

  revalidatePath("/empresa/perfil");
  revalidatePath("/empresa");
  return { success: true };
}

// ─── Crear oferta (siempre en borrador) ──────────────────────────────────────

export async function createEmpresaJobAction(formData: FormData) {
  const { supabase, user, company } = await requireCompany();

  if (!company) {
    return { error: { _form: ["Completa el perfil de tu empresa primero."] } };
  }
  if (company.status !== "approved") {
    return {
      error: {
        _form: [
          "Tu empresa debe ser aprobada por Get Company antes de publicar ofertas.",
        ],
      },
    };
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: { title: ["El título es obligatorio."] } };

  // Generar slug único
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
    slug = `${base}-${attempt++}`;
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      title,
      slug,
      area_id:       Number(formData.get("area_id")) || null,
      modality:      (formData.get("modality") as string) || null,
      contract_type: (formData.get("contract_type") as string) || null,
      city:          (formData.get("city") as string) || "",
      department:    (formData.get("department") as string) || null,
      vacancies:     Number(formData.get("vacancies")) || 1,
      salary_min:    formData.get("salary_min") ? Number(formData.get("salary_min")) : null,
      salary_max:    formData.get("salary_max") ? Number(formData.get("salary_max")) : null,
      salary_visible: formData.get("salary_visible") === "true",
      description:   (formData.get("description") as string) || "",
      requirements:  (formData.get("requirements") as string) || null,
      benefits:      (formData.get("benefits") as string) || null,
      expires_at:    (formData.get("expires_at") as string) || null,
      status:        "draft",
      company_id:    company.id,
      created_by:    user.id,
    })
    .select("id")
    .single();

  if (error) return { error: { _form: ["Error al crear la oferta."] } };

  revalidatePath("/empresa/jobs");
  redirect(`/empresa/jobs/${job.id}/edit`);
}

// ─── Actualizar oferta (vuelve a draft automáticamente) ──────────────────────

export async function updateEmpresaJobAction(
  jobId: string,
  formData: FormData
) {
  const { supabase, company } = await requireCompany();
  if (!company) return { error: { _form: ["Sin perfil de empresa."] } };

  // Verificar propiedad
  const { data: existing } = await supabase
    .from("jobs")
    .select("id, company_id, status")
    .eq("id", jobId)
    .single();

  if (!existing || existing.company_id !== company.id) {
    return { error: { _form: ["No tienes permiso para editar esta oferta."] } };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title:         (formData.get("title") as string)?.trim(),
      area_id:       Number(formData.get("area_id")) || null,
      modality:      (formData.get("modality") as string) || null,
      contract_type: (formData.get("contract_type") as string) || null,
      city:          (formData.get("city") as string) || "",
      department:    (formData.get("department") as string) || null,
      vacancies:     Number(formData.get("vacancies")) || 1,
      salary_min:    formData.get("salary_min") ? Number(formData.get("salary_min")) : null,
      salary_max:    formData.get("salary_max") ? Number(formData.get("salary_max")) : null,
      salary_visible: formData.get("salary_visible") === "true",
      description:   (formData.get("description") as string) || "",
      requirements:  (formData.get("requirements") as string) || null,
      benefits:      (formData.get("benefits") as string) || null,
      expires_at:    (formData.get("expires_at") as string) || null,
      // Si estaba en pending_review y se edita, regresa a draft
      status:        "draft",
      updated_at:    new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) return { error: { _form: ["Error al guardar la oferta."] } };

  revalidatePath("/empresa/jobs");
  revalidatePath(`/empresa/jobs/${jobId}/edit`);
  return { success: true };
}

// ─── Publicar oferta directamente (aprobadas no necesitan revisión admin) ────

export async function submitEmpresaJobAction(jobId: string) {
  const { supabase, company } = await requireCompany();
  if (!company) return { error: "Sin perfil de empresa." };
  if (company.status !== "approved") return { error: "Tu empresa no está aprobada." };

  const now = new Date().toISOString();

  // Consultar si ya tiene published_at para no sobreescribirla en re-publicaciones
  const { data: existing } = await supabase
    .from("jobs")
    .select("published_at")
    .eq("id", jobId)
    .single();

  const { error } = await supabase
    .from("jobs")
    .update({
      status:       "active",
      published_at: existing?.published_at ?? now,
      updated_at:   now,
    })
    .eq("id", jobId)
    .eq("company_id", company.id)
    .eq("status", "draft");

  if (error) return { error: "Error al publicar la oferta." };

  revalidatePath("/empresa/jobs");
  revalidatePath(`/empresa/jobs/${jobId}/edit`);
  revalidatePath("/jobs");
  return { success: true };
}

// ─── Retirar oferta de revisión → volver a draft ──────────────────────────────

export async function retractEmpresaJobAction(jobId: string) {
  const { supabase, company } = await requireCompany();
  if (!company) return { error: "Sin perfil de empresa." };

  const { error } = await supabase
    .from("jobs")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("company_id", company.id)
    .eq("status", "pending_review");

  if (error) return { error: "Error al retirar la oferta." };

  revalidatePath("/empresa/jobs");
  return { success: true };
}

// ─── Pausar / reactivar oferta ───────────────────────────────────────────────

export async function toggleEmpresaJobPauseAction(
  jobId: string,
  currentStatus: "active" | "paused"
) {
  const { supabase, company } = await requireCompany();
  if (!company) return { error: "Sin perfil de empresa." };

  const newStatus = currentStatus === "active" ? "paused" : "active";

  const { error } = await supabase
    .from("jobs")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("company_id", company.id);

  if (error) return { error: "No se pudo cambiar el estado." };

  revalidatePath("/empresa/jobs");
  return { success: true };
}

// ─── Eliminar oferta (solo borradores) ───────────────────────────────────────

export async function deleteEmpresaJobAction(jobId: string) {
  const { supabase, company } = await requireCompany();
  if (!company) return { error: "Sin perfil de empresa." };

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("company_id", company.id)
    .eq("status", "draft");

  if (error) return { error: "Solo puedes eliminar borradores." };

  revalidatePath("/empresa/jobs");
  redirect("/empresa/jobs");
}

// ─── Subir logo de empresa ───────────────────────────────────────────────────

export async function uploadEmpresaLogoAction(
  formData: FormData
): Promise<{ logo_url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };
  if (user.app_metadata?.role !== "company") return { error: "Sin permiso." };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "Archivo requerido." };
  if (!file.type.startsWith("image/")) return { error: "Debe ser una imagen." };
  if (file.size > 2 * 1024 * 1024) return { error: "El logo no puede superar 2 MB." };

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("created_by", user.id)
    .maybeSingle();

  if (!company) return { error: "Perfil de empresa no encontrado." };

  // Usar extensión original para preservar transparencia en PNG/SVG
  let ext = "jpg";
  if (file.type.includes("png")) ext = "png";
  else if (file.type.includes("svg")) ext = "svg";
  else if (file.type.includes("webp")) ext = "webp";

  const path = `${company.id}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("Logo upload error:", uploadError);
    return { error: "Error al subir el logo. Verifica que el bucket 'logos' existe en Supabase Storage." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", company.id);

  if (updateError) return { error: "Error al guardar el logo." };

  revalidatePath("/empresa");
  revalidatePath("/empresa/perfil");
  revalidatePath("/", "layout");
  return { logo_url: publicUrl };
}

// ─── Actualizar estado de postulación (empresa no toca admin_notes) ──────────

export async function updateEmpresaApplicationAction(
  applicationId: string,
  status: ApplicationStatus
) {
  const { supabase, company } = await requireCompany();
  if (!company) return { error: "Sin perfil de empresa." };

  // Verificar que la postulación pertenece a una oferta de esta empresa
  const { data: app } = await supabase
    .from("applications")
    .select("id, job:jobs!inner(company_id)")
    .eq("id", applicationId)
    .single();

  const jobData = app?.job as { company_id: string } | { company_id: string }[] | null;
  const jobCompanyId = Array.isArray(jobData)
    ? jobData[0]?.company_id
    : jobData?.company_id;

  if (!app || jobCompanyId !== company.id) {
    return { error: "No tienes permiso para modificar esta postulación." };
  }

  // Actualizar SOLO status — admin_notes nunca se toca desde aquí
  const { error } = await supabase
    .from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (error) return { error: "Error al actualizar el estado." };

  revalidatePath("/empresa/postulaciones");
  return { success: true };
}
