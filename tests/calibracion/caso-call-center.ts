import type { CandidateEvidence, JobRequirements } from "@/lib/matching/types";

/**
 * Caso real de calibración — "Operario(a) Call Center" (Neiva, Huila) vs.
 * Danna Yanary Puentes Medina.
 *
 * Referencia externa: el sistema que usa el cliente puntuó a esta candidata
 * con 89% (requisitos 100%, CV 78%) y el cliente confirmó que es una buena
 * candidata. Este fixture reproduce la entrada del motor tal como la
 * produciría la extracción para ese par oferta/CV.
 */

export const callCenterJob: JobRequirements = {
  title: "Operario(a) Call Center",

  skills: [
    {
      rawName: "Manejo básico de herramientas ofimáticas",
      canonicalName: "herramientas ofimaticas",
      category: "tool",
      importance: "required",
      minimumYears: null,
    },
    {
      rawName: "Excelente comunicación verbal y capacidad de escucha",
      canonicalName: "comunicacion verbal",
      category: "transferable",
      importance: "required",
      minimumYears: null,
    },
    {
      rawName: "Orientación al servicio y al cumplimiento de metas",
      canonicalName: "orientacion al servicio",
      category: "transferable",
      importance: "required",
      minimumYears: null,
    },
    {
      rawName: "Habilidad para persuadir, negociar y cerrar ventas",
      canonicalName: "persuasion y negociacion",
      category: "transferable",
      importance: "required",
      minimumYears: null,
    },
    {
      rawName: "Buena actitud comercial, dinamismo y disposición para aprender",
      canonicalName: "actitud comercial",
      category: "transferable",
      importance: "required",
      minimumYears: null,
    },
    // Competencias del cargo
    { rawName: "Comunicación asertiva", canonicalName: "comunicacion asertiva", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Orientación al cliente", canonicalName: "orientacion al cliente", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Orientación al logro", canonicalName: "orientacion al logro", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Persuasión y negociación", canonicalName: "persuasion y negociacion", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Trabajo en equipo", canonicalName: "trabajo en equipo", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Tolerancia a la presión", canonicalName: "tolerancia a la presion", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Proactividad", canonicalName: "proactividad", category: "transferable", importance: "required", minimumYears: null },
    { rawName: "Organización y seguimiento", canonicalName: "organizacion y seguimiento", category: "transferable", importance: "required", minimumYears: null },
  ],

  responsibilities: [
    "Realizar llamadas telefónicas a clientes y prospectos.",
    "Brindar información clara sobre los productos y sus beneficios.",
    "Identificar las necesidades del cliente y ofrecer alternativas acordes con sus requerimientos.",
    "Realizar seguimiento a clientes interesados y oportunidades comerciales.",
    "Gestionar bases de datos y mantener actualizada la información de los clientes.",
    "Registrar correctamente las llamadas, contactos y resultados de la gestión.",
    "Cumplir con las metas comerciales y de productividad establecidas.",
    "Realizar seguimiento a pedidos y apoyar el proceso de cierre de ventas.",
    "Atender inquietudes, solicitudes y requerimientos de los clientes de manera oportuna.",
    "Cumplir los protocolos de servicio y las políticas comerciales de la compañía.",
  ],

  experience: {
    minimumYears: 0.5,
    relevantRoles: [
      "Call Center",
      "ventas telefónicas",
      "telemercadeo",
      "servicio al cliente",
      "cargos comerciales",
    ],
    industries: [],
  },

  education: [{ level: "bachiller", field: null, importance: "required" }],
  certifications: [],
  languages: [],
  knockouts: [],
  location: { city: "Neiva", region: "Huila", workMode: "onsite" },
};

export const dannaCandidate: CandidateEvidence = {
  skills: [
    { rawName: "word", canonicalName: "microsoft word", category: "tool", yearsEstimate: null, evidence: "Herramienta / Nivel: word / Avanzado", confidence: 0.9 },
    { rawName: "excel", canonicalName: "microsoft excel", category: "tool", yearsEstimate: null, evidence: "Herramienta / Nivel: excel / Avanzado", confidence: 0.9 },
    { rawName: "powerpoint", canonicalName: "microsoft powerpoint", category: "tool", yearsEstimate: null, evidence: "Herramienta / Nivel: powerppoint / Avanzado", confidence: 0.9 },
    { rawName: "servicio al cliente", canonicalName: "servicio al cliente", category: "domain", yearsEstimate: 4, evidence: "AGENTE DE SERVICIO AL CLIENTE", confidence: 0.9 },
    { rawName: "atención telefónica", canonicalName: "atencion telefonica", category: "domain", yearsEstimate: null, evidence: "Efectuar y atender llamadas", confidence: 0.8 },
    { rawName: "ventas", canonicalName: "ventas", category: "domain", yearsEstimate: null, evidence: "cumplimiento y venta de productos de la marca", confidence: 0.8 },
    { rawName: "manejo documental", canonicalName: "manejo documental", category: "domain", yearsEstimate: null, evidence: "manejo documental y apoyo a procesos contables", confidence: 0.8 },
    { rawName: "comunicación asertiva", canonicalName: "comunicacion asertiva", category: "transferable", yearsEstimate: null, evidence: "comunicación asertiva y manejo adecuado de relaciones interpersonales", confidence: 0.7 },
    { rawName: "trabajo en equipo", canonicalName: "trabajo en equipo", category: "transferable", yearsEstimate: null, evidence: "Con habilidades para el trabajo en equipo", confidence: 0.7 },
    { rawName: "liderazgo", canonicalName: "liderazgo", category: "transferable", yearsEstimate: null, evidence: "adaptabilidad al cambio, liderazgo", confidence: 0.7 },
  ],

  transferableSkills: [
    { name: "trabajo en equipo", evidence: "Con habilidades para el trabajo en equipo", confidence: 0.8 },
    { name: "adaptabilidad al cambio", evidence: "adaptabilidad al cambio", confidence: 0.8 },
    { name: "liderazgo", evidence: "liderazgo", confidence: 0.8 },
    { name: "comunicación asertiva", evidence: "comunicación asertiva y manejo adecuado de relaciones interpersonales", confidence: 0.8 },
    { name: "orientación a resultados", evidence: "Persona responsable, comprometida y orientada a resultados", confidence: 0.8 },
    { name: "proactividad", evidence: "con actitud proactiva, espíritu innovador", confidence: 0.8 },
  ],

  experience: [
    {
      title: "APOYO ADMINISTRATIVO FRONT",
      company: "Comercializadora de Servicios Financieros",
      responsibilities: [
        "Brindar atención y bienvenida a clientes, gestionando el envío y recepción de correspondencia diaria",
        "Realizar radicación y seguimiento de documentos, elaboración de reportes diarios",
        "Control y solicitud de papelería e insumos",
        "Apoyar diferentes procesos administrativos y operativos, manteniendo una atención cordial, organizada y orientada al servicio",
      ],
      achievements: [],
      skills: ["atención al cliente", "seguimiento de documentos", "elaboración de reportes"],
    },
    {
      title: "AGENTE DE SERVICIO AL CLIENTE",
      company: "PROFFESINAL CONSULTING SERVICES",
      responsibilities: [
        "Efectuar y atender llamadas, escuchar atentamente y orientar al Cliente sobre las inquietudes o requerimientos que presente",
        "Archivar la información del cliente de acuerdo con los parámetros establecidos por la compañía",
        "Hacer seguimiento permanente y documentar todas las consultas del cliente a través del software estipulado y demás herramientas ofimáticas",
        "Realizar seguimiento a los clientes y recolectar la correspondencia enviada por USCIS al cliente",
        "Contactar a clientes con el segundo idioma (inglés) para brindarles solución e información sobre el proceso respectivo",
      ],
      achievements: [],
      skills: ["atención telefónica", "servicio al cliente", "seguimiento de clientes", "herramientas ofimáticas"],
    },
    {
      title: "CONSULTOR ISC RETAIL",
      company: "Beyond Colombia SAS (apple)",
      responsibilities: [
        "Asesorar y orientar al cliente dando solución a las necesidades del mismo",
        "Cumplimiento y venta de productos de la marca siguiendo con el posicionamiento que ésta tiene",
      ],
      achievements: [],
      skills: ["ventas", "asesoría comercial"],
    },
    {
      title: "ASESOR DEMOWARE",
      company: "hp",
      responsibilities: [
        "Asesorar y orientar al cliente dando solución a las necesidades del mismo",
        "Cumplimiento y venta de productos de la marca",
      ],
      achievements: [],
      skills: ["ventas"],
    },
    {
      title: "CONSULTOR INTEGRAL SERVICIO A CLIENTES",
      company: "Comunicación Celular SA Comcel SA",
      responsibilities: [
        "Consultor integral servicio al cliente, orientación, estrategias de cumplimiento, responsable de brindar un buen servicio",
        "Encargada de analizar las inquietudes, comentarios, preguntas, dudas y asesoramiento en compras al cliente, con alto nivel en ventas",
        "Atender personalmente a los usuarios o potenciales clientes, brindándoles información clara y precisa de los productos y servicios",
        "Verificar y revisar documentos realizando seguimiento permanente para informar a los clientes cualquier inconsistencia",
        "Brindar al cliente conocimiento en el manejo tecnológico para la autogestión por medio de la App Mi Claro",
      ],
      achievements: ["alto nivel en ventas"],
      skills: ["servicio al cliente", "ventas", "asesoría comercial"],
    },
    {
      title: "AUXILIAR ADMINISTRATIVO Y CONTABLE",
      company: "Distribuciones Farmasalud S.A.S",
      responsibilities: [
        "Realizar actividades administrativas de archivo, control y elaboración de correspondencia",
        "Digitar y registrar las transacciones contables de las operaciones de la empresa",
        "Elaborar nómina y liquidación de seguridad social",
      ],
      achievements: [],
      skills: ["contabilidad", "archivo"],
    },
  ],

  totalYearsExperience: 5,

  education: [
    { degree: "CONTADOR PUBLICO", field: "Contaduría Pública", level: "Universitaria" },
    { degree: "INGLÉS GENERAL", field: "Inglés", level: "Técnica Profesional" },
    { degree: "BACHILLER ACADEMICO", field: null, level: "Media(10-13)" },
  ],

  certifications: [
    "ORGANIZACIÓN DOCUMENTAL EN EL ENTORNO LABORAL",
    "ADMINISTRACIÓN DE RECURSOS HUMANOS",
    "ADMINISTRACIÓN DOCUMENTAL EN EL ENTORNO LABORAL",
    "INGLES BASICO EMPRESARIAL - IMPULSAR 2024",
  ],

  languages: [{ language: "Inglés", level: "Avanzado" }],

  narrative: [
    "Estudiante de octavo semestre de Contaduría Pública, con experiencia laboral como asistente administrativa, agente de servicio al cliente, consultora integral y auxiliar contable",
    "Desempeñando funciones en atención y servicio al cliente, gestión de procesos administrativos y operativos, envío y recepción de correspondencia, elaboración y presentación de reportes, manejo documental y apoyo a procesos contables",
    "Con experiencia en seguimiento de actividades, organización de información y atención oportuna de requerimientos, contribuyendo al cumplimiento de los objetivos del área",
    "Con habilidades para el trabajo en equipo, adaptabilidad al cambio, liderazgo, comunicación asertiva y manejo adecuado de relaciones interpersonales",
    "Persona responsable, comprometida y orientada a resultados, con actitud proactiva, espíritu innovador y capacidad para asumir nuevos retos",
  ],

  city: "NEIVA (HUILA)",
  extractionConfidence: 0.9,
  isSparse: false,
};
