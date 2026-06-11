"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validations/company";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

export async function createCompanyAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const raw = {
    name:        formData.get("name") as string,
    city:        (formData.get("city") as string) || undefined,
    industry:    (formData.get("industry") as string) || undefined,
    website:     (formData.get("website") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: company, error } = await supabase
    .from("companies")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: { _form: ["Error al crear la empresa."] } };

  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${company.id}/edit`);
}

export async function updateCompanyAction(companyId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const raw = {
    name:        formData.get("name") as string,
    city:        (formData.get("city") as string) || undefined,
    industry:    (formData.get("industry") as string) || undefined,
    website:     (formData.get("website") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { error } = await supabase
    .from("companies")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) return { error: { _form: ["Error al actualizar la empresa."] } };

  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}

export async function deleteCompanyAction(companyId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("companies").delete().eq("id", companyId);
  if (error) return { error: "No se pudo eliminar la empresa." };

  revalidatePath("/admin/companies");
  return { success: true };
}

// ─── Aprobar empresa ─────────────────────────────────────────────────────────

export async function approveCompanyAction(companyId: string) {
  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("companies")
    .update({
      status:           "approved",
      approved_at:      new Date().toISOString(),
      approved_by:      user.id,
      rejection_reason: null,
      updated_at:       new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) return { error: "Error al aprobar la empresa." };

  revalidatePath("/admin/companies");
  return { success: true };
}

// ─── Rechazar empresa ─────────────────────────────────────────────────────────

export async function rejectCompanyAction(companyId: string, reason: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("companies")
    .update({
      status:           "rejected",
      rejection_reason: reason || null,
      approved_at:      null,
      approved_by:      null,
      updated_at:       new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) return { error: "Error al rechazar la empresa." };

  revalidatePath("/admin/companies");
  return { success: true };
}

// ─── Subir logo ───────────────────────────────────────────────────────────────

export async function uploadCompanyLogoAction(companyId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const file = formData.get("logo") as File;
  if (!file || file.size === 0) return { error: "Selecciona una imagen." };
  if (!file.type.startsWith("image/")) return { error: "El archivo debe ser una imagen." };
  if (file.size > 2 * 1024 * 1024) return { error: "La imagen no puede superar 2 MB." };

  const filePath = `companies/${companyId}/logo.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (updateError) return { error: "Logo subido pero error al actualizar." };

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}/edit`);
  return { success: true, logo_url: publicUrl };
}
