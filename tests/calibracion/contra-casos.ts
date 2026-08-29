import type { CandidateEvidence } from "@/lib/matching/types";

/**
 * Contra-casos de la vacante "Operario(a) Call Center" (Neiva).
 *
 * Existen para lo contrario que el caso principal: comprobar que el motor
 * SIGUE separando. Aflojar los umbrales para no perder a una buena candidata
 * es fácil; el riesgo es acabar con un sistema que puntúa alto a cualquiera y
 * que, por tanto, no ordena nada. Estos perfiles marcan el suelo esperado.
 */

const base = {
  transferableSkills: [],
  certifications: [],
  languages: [],
  narrative: [],
  extractionConfidence: 0.9,
  isSparse: false,
};

/** Sin relación alguna con el cargo y en otra ciudad. Debe quedar muy abajo. */
export const desarrolladorBogota: CandidateEvidence = {
  ...base,
  skills: [
    { rawName: "JavaScript", canonicalName: "javascript", category: "technical", yearsEstimate: 4, evidence: "React y Node", confidence: 0.9 },
    { rawName: "React", canonicalName: "react", category: "technical", yearsEstimate: 3, evidence: "SPA en producción", confidence: 0.9 },
    { rawName: "SQL", canonicalName: "sql", category: "technical", yearsEstimate: 4, evidence: "PostgreSQL", confidence: 0.9 },
  ],
  experience: [
    {
      title: "Desarrollador Frontend",
      company: "Startup de tecnología",
      responsibilities: [
        "Construir interfaces de usuario con React y TypeScript",
        "Integrar APIs REST y optimizar el rendimiento del bundle",
        "Revisar código de otros desarrolladores en pull requests",
      ],
      achievements: ["Reducción del tiempo de carga en 40%"],
      skills: ["react", "typescript", "git"],
    },
  ],
  totalYearsExperience: 4,
  education: [{ degree: "Ingeniería de Sistemas", field: "Sistemas", level: "Universitaria" }],
  city: "Bogotá",
};

/** Buen operario, pero de planta: ni teléfono, ni cliente, ni venta. */
export const operarioProduccionNeiva: CandidateEvidence = {
  ...base,
  skills: [
    { rawName: "manejo de maquinaria", canonicalName: "manejo de maquinaria", category: "technical", yearsEstimate: 3, evidence: "Operación de línea", confidence: 0.9 },
    { rawName: "control de calidad", canonicalName: "control de calidad", category: "technical", yearsEstimate: 3, evidence: "Inspección de producto", confidence: 0.9 },
  ],
  experience: [
    {
      title: "Operario de Producción",
      company: "Planta de alimentos",
      responsibilities: [
        "Operar la línea de empaque cumpliendo los estándares de producción",
        "Verificar el peso y sellado del producto terminado",
        "Diligenciar los formatos de control de calidad del turno",
      ],
      achievements: [],
      skills: ["empaque", "control de calidad"],
    },
  ],
  totalYearsExperience: 3,
  education: [{ degree: "BACHILLER ACADEMICO", field: null, level: "Media(10-13)" }],
  city: "Neiva (Huila)",
};

/** Comercial de mostrador en Neiva: encaje parcial honesto, sin canal telefónico. */
export const asesorTiendaNeiva: CandidateEvidence = {
  ...base,
  skills: [
    { rawName: "ventas", canonicalName: "ventas", category: "domain", yearsEstimate: 1, evidence: "Venta en tienda", confidence: 0.9 },
    { rawName: "manejo de caja", canonicalName: "manejo de caja", category: "domain", yearsEstimate: 1, evidence: "Arqueo diario", confidence: 0.8 },
  ],
  transferableSkills: [
    { name: "trabajo en equipo", evidence: "Trabajo en equipo con el personal de tienda", confidence: 0.8 },
  ],
  experience: [
    {
      title: "Asesor Comercial de Tienda",
      company: "Almacén de ropa",
      responsibilities: [
        "Atender a los clientes en el punto de venta y asesorarlos en la compra",
        "Cumplir la meta de ventas mensual del almacén",
        "Organizar la exhibición y el inventario de la tienda",
      ],
      achievements: [],
      skills: ["ventas", "atención al cliente"],
    },
  ],
  totalYearsExperience: 1,
  education: [{ degree: "BACHILLER ACADEMICO", field: null, level: "Media(10-13)" }],
  city: "Neiva",
};
