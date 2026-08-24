/**
 * Atributos que NUNCA pueden influir en el score — spec §29.
 *
 * Fuente única de verdad, usada tanto al construir la entrada del motor como
 * al armar el payload que se envía al LLM. Que estén centralizados aquí, y no
 * repartidos por el código, es lo que hace verificable la promesa.
 *
 * El test `excluded-attributes.test.ts` falla si alguno de estos campos
 * aparece en la entrada del motor de matching.
 */

export const EXCLUDED_FROM_SCORING = [
  "name",
  "full_name",
  "photo",
  "avatar_url",
  "date_of_birth",
  "birth_date",
  "age",
  "gender",
  "race",
  "ethnicity",
  "religion",
  "marital_status",
  "pregnancy",
  "disability",
  "national_origin",
  "nationality",
  "home_address",
  "address",
  "political_information",
  // Datos de contacto: sirven para operar la plataforma, no para rankear
  "email",
  "phone",
  // La institución educativa no debe convertirse en medida de prestigio (§29)
  "institution",
  "university",
] as const;

const EXCLUDED_SET = new Set<string>(EXCLUDED_FROM_SCORING);

export function isExcludedFromScoring(field: string): boolean {
  return EXCLUDED_SET.has(field.toLowerCase());
}

/**
 * Recorre un objeto y devuelve las rutas de campos prohibidos que encuentre.
 * Se usa en tests como red de seguridad frente a regresiones: si alguien añade
 * `birth_date` a la entrada del motor, el test lo detecta.
 */
export function findExcludedFields(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findExcludedFields(item, `${path}[${i}]`));
  }

  const found: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (isExcludedFromScoring(key)) found.push(currentPath);
    found.push(...findExcludedFields(nested, currentPath));
  }

  return found;
}
