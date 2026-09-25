import type { CandidateEvidence, JobRequirements } from "@/lib/matching/types";

/**
 * Regresión derivada del caso real que expuso tres fallos del motor v2:
 * duraciones explícitas ignoradas, elección del cargo equivocado por empate y
 * funciones sin detalle tratadas como incumplimientos.
 *
 * Se omiten deliberadamente nombre, contacto y cualquier otro dato personal.
 */
export const warehouseAssistantJob: JobRequirements = {
  title: "Auxiliar de Bodega",
  skills: [
    {
      rawName: "Experiencia en procesos de empaque y desempaque de mercancía",
      canonicalName: "procesos de empaque y desempaque",
      category: "technical",
      importance: "required",
      minimumYears: null,
    },
    {
      rawName: "Conocimiento en alistamiento de pedidos e inventarios",
      canonicalName: "alistamiento de pedidos e inventarios",
      category: "technical",
      importance: "required",
      minimumYears: null,
    },
    {
      rawName: "Deseable conocimiento en manejo de herramientas de bodega",
      canonicalName: "manejo de herramientas de bodega",
      category: "tool",
      importance: "preferred",
      minimumYears: null,
    },
  ],
  responsibilities: [
    "Recibir, verificar y organizar la mercancía que ingresa a la bodega.",
    "Realizar procesos de empaque y desempaque de productos.",
    "Alistar pedidos de acuerdo con las solicitudes de despacho.",
    "Apoyar en el cargue y descargue de mercancía.",
    "Mantener el orden y la limpieza de la bodega.",
    "Realizar inventarios y apoyar en el control de existencias.",
    "Identificar y reportar novedades relacionadas con la mercancía.",
    "Cumplir con las normas de seguridad.",
    "Apoyar las demás funciones relacionadas con el cargo.",
  ],
  experience: {
    minimumYears: 1,
    relevantRoles: [
      "Auxiliar de Bodega",
      "cargos relacionados con bodega, logística o almacenamiento",
    ],
    industries: [],
  },
  education: [{ level: "Bachiller académico", field: null, importance: "required" }],
  certifications: [],
  languages: [],
  knockouts: [],
  location: { city: "Medellín", region: null, workMode: "onsite" },
};

export const warehouseAssistantCandidate: CandidateEvidence = {
  skills: [
    {
      rawName: "Auxiliar logístico",
      canonicalName: "Auxiliar logístico",
      category: "domain",
      yearsEstimate: null,
      evidence: "Cargo: Auxiliar logístico",
      confidence: 0.8,
    },
  ],
  transferableSkills: [],
  experience: [
    {
      title: "Auxiliar bachiller",
      company: "Entidad A",
      durationMonths: 12,
      responsibilities: [],
      achievements: [],
      skills: ["Auxiliar bachiller"],
    },
    {
      title: "Auxiliar logístico",
      company: "Empresa B",
      durationMonths: 68,
      responsibilities: [],
      achievements: [],
      skills: ["Auxiliar logístico"],
    },
  ],
  totalYearsExperience: null,
  education: [{ degree: "Bachiller académico", field: null, level: "Bachiller" }],
  certifications: [],
  languages: [],
  narrative: [
    "Persona responsable, organizada, con disposición para aprender y trabajar en equipo.",
  ],
  city: "Medellín, Antioquia",
  extractionConfidence: 0.6,
  isSparse: false,
};
