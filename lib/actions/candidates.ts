"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { candidateProfileSchema } from "@/lib/validations/candidate";

// ─── Actualizar perfil del candidato ─────────────────────────────────────────

export async function updateCandidateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Parsear skills e idiomas desde string separado por comas
  const skillsRaw  = (formData.get("skills")    as string) || "";
  const langsRaw   = (formData.get("languages")  as string) || "";
  const skills     = skillsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const languages  = langsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const raw = {
    full_name:        formData.get("full_name") as string,
    phone:            (formData.get("phone") as string) || "",
    city:             (formData.get("city") as string) || "",
    birth_date:       (formData.get("birth_date") as string) || null,
    gender:           (formData.get("gender") as string) || null,
    education_level:  (formData.get("education_level") as string) || null,
    career:           (formData.get("career") as string) || "",
    years_experience: formData.get("years_experience")
      ? Number(formData.get("years_experience"))
      : null,
    skills,
    languages,
    linkedin_url:     (formData.get("linkedin_url") as string) || "",
    availability:     (formData.get("availability") as string) || null,
    expected_salary:  formData.get("expected_salary")
      ? Number(formData.get("expected_salary"))
      : null,
    summary: (formData.get("summary") as string) || "",
  };

  const parsed = candidateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Actualizar tabla profiles
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name:  parsed.data.full_name,
      phone:      parsed.data.phone || null,
      city:       parsed.data.city || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: { _form: ["Error al guardar los datos personales."] } };
  }

  // Calcular si el perfil está completo (campos mínimos rellenos)
  const profile_complete = !!(
    parsed.data.full_name &&
    parsed.data.city &&
    parsed.data.education_level &&
    parsed.data.career &&
    parsed.data.years_experience !== null &&
    parsed.data.availability
  );

  // Upsert tabla candidates
  const { error: candidateError } = await supabase
    .from("candidates")
    .upsert(
      {
        id:               user.id,
        birth_date:       parsed.data.birth_date || null,
        gender:           parsed.data.gender || null,
        education_level:  parsed.data.education_level || null,
        career:           parsed.data.career || null,
        years_experience: parsed.data.years_experience ?? 0,
        skills:           parsed.data.skills ?? [],
        languages:        parsed.data.languages ?? [],
        linkedin_url:     parsed.data.linkedin_url || null,
        availability:     parsed.data.availability || null,
        expected_salary:  parsed.data.expected_salary || null,
        summary:          parsed.data.summary || null,
        profile_complete,
      },
      { onConflict: "id" }
    );

  if (candidateError) {
    return { error: { _form: ["Error al guardar el perfil profesional."] } };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true, profile_complete };
}

// ─── Subir CV a Supabase Storage ──────────────────────────────────────────────

export async function uploadCVAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const file = formData.get("cv") as File;
  if (!file || file.size === 0) {
    return { error: "Selecciona un archivo PDF." };
  }

  // Validaciones
  if (file.type !== "application/pdf") {
    return { error: "El archivo debe ser un PDF." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "El archivo no puede superar 5 MB." };
  }

  const filePath = `${user.id}/cv.pdf`;

  // Subir al bucket cvs (sobreescribe si ya existe)
  const { error: uploadError } = await supabase.storage
    .from("cvs")
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return { error: "Error al subir el archivo. Intenta de nuevo." };
  }

  // Guardar la URL en la tabla candidates
  const { error: updateError } = await supabase
    .from("candidates")
    .update({
      cv_url:       filePath,
      cv_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: "CV subido pero error al registrar la ruta." };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true, cv_url: filePath };
}

// ─── Subir foto de perfil (avatar) ───────────────────────────────────────────

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) return { error: "Selecciona una imagen." };
  if (!file.type.startsWith("image/")) return { error: "El archivo debe ser una imagen." };
  if (file.size > 2 * 1024 * 1024) return { error: "La imagen no puede superar 2 MB." };

  const filePath = `${user.id}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return { error: "Error al subir la imagen. Verifica que el bucket 'avatars' existe." };

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

  // Versionar la URL para evitar que el caché de Next.js Image sirva
  // la imagen anterior (el archivo se sobreescribe en storage con el mismo path)
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: versionedUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) return { error: "Imagen subida pero error al actualizar el perfil." };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { success: true, avatar_url: versionedUrl };
}

// ─── Obtener URL firmada del CV (para descarga) ───────────────────────────────

export async function getCVDownloadUrl(cvPath: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("cvs")
    .createSignedUrl(cvPath, 60 * 60); // URL válida 1 hora

  if (error || !data) return null;
  return data.signedUrl;
}
