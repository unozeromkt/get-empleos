/**
 * Requisito mínimo para poder postularse: nombre, teléfono y CV cargado.
 *
 * Todo lo demás en el perfil (educación, experiencia, disponibilidad,
 * resumen, habilidades, idiomas...) es opcional — enriquece el matching si
 * está, pero no bloquea la postulación. El email no se evalúa aquí porque ya
 * es obligatorio desde el registro (auth.users.email NOT NULL).
 *
 * Única fuente de verdad para esta regla: usada al guardar el perfil manual,
 * al subir el CV, y al confirmar el perfil extraído por IA — los tres
 * caminos por los que `candidates.profile_complete` puede cambiar.
 */
export interface ProfileCompletionInput {
  fullName: string | null | undefined;
  phone: string | null | undefined;
  cvUrl: string | null | undefined;
}

export function isProfileCompleteForApplying(input: ProfileCompletionInput): boolean {
  return !!(input.fullName?.trim() && input.phone?.trim() && input.cvUrl);
}
