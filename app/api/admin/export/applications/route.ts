import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── GET /api/admin/export/applications?job_id=xxx ───────────────────────────
// Exporta las postulaciones de una oferta (o todas) como CSV.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");

  // Construir query dinámica
  let query = supabase
    .from("applications")
    .select(`
      id, status, cover_letter, admin_notes, applied_at,
      job:jobs(title, city),
      candidate:candidates(career, years_experience, education_level, expected_salary, availability,
        profile:profiles(full_name, email, phone, city))
    `)
    .order("applied_at", { ascending: false });

  if (jobId) {
    query = query.eq("job_id", jobId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Etiquetas legibles
  const STATUS_LABELS: Record<string, string> = {
    pending:     "Pendiente",
    reviewing:   "En revisión",
    shortlisted: "Preseleccionado",
    rejected:    "No continúa",
    hired:       "Contratado",
  };

  const EDUCATION_LABELS: Record<string, string> = {
    bachiller:    "Bachiller",
    tecnico:      "Técnico",
    tecnologo:    "Tecnólogo",
    profesional:  "Profesional",
    especialista: "Especialista",
    maestria:     "Maestría",
    doctorado:    "Doctorado",
  };

  const AVAILABILITY_LABELS: Record<string, string> = {
    inmediata: "Inmediata",
    "15_dias": "En 15 días",
    "30_dias": "En 30 días",
  };

  // Helper: convierte unknown a string de forma segura
  const str = (v: unknown): string => (v != null ? String(v) : "");

  // Aplanar JOINs (Supabase retorna arrays sin tipos generados)
  const rows: Record<string, string>[] = (data ?? []).map((row: Record<string, unknown>) => {
    const jobRaw      = row.job       as Record<string, unknown>[] | Record<string, unknown> | null;
    const job         = Array.isArray(jobRaw)       ? jobRaw[0]       : jobRaw;
    const candidateRaw = row.candidate as Record<string, unknown>[] | Record<string, unknown> | null;
    const cand        = Array.isArray(candidateRaw) ? candidateRaw[0] : candidateRaw;
    const profileRaw  = cand?.profile  as Record<string, unknown>[] | Record<string, unknown> | undefined;
    const profile     = Array.isArray(profileRaw)   ? profileRaw[0]  : profileRaw;

    const appliedDate = row.applied_at
      ? new Date(str(row.applied_at)).toLocaleDateString("es-CO", {
          year: "numeric", month: "2-digit", day: "2-digit",
        })
      : "";

    const salary = cand?.expected_salary != null
      ? new Intl.NumberFormat("es-CO", {
          style: "currency", currency: "COP", maximumFractionDigits: 0,
        }).format(Number(cand.expected_salary))
      : "";

    return {
      nombre:             str(profile?.full_name),
      email:              str(profile?.email),
      telefono:           str(profile?.phone),
      ciudad:             str(profile?.city),
      carrera:            str(cand?.career),
      experiencia:        cand?.years_experience != null ? `${cand.years_experience} años` : "",
      educacion:          EDUCATION_LABELS[str(cand?.education_level)] ?? str(cand?.education_level),
      disponibilidad:     AVAILABILITY_LABELS[str(cand?.availability)] ?? str(cand?.availability),
      aspiracion:         salary,
      oferta:             str(job?.title),
      ciudad_oferta:      str(job?.city),
      estado:             STATUS_LABELS[str(row.status)] ?? str(row.status),
      fecha_postulacion:  appliedDate,
      carta_presentacion: str(row.cover_letter).replace(/\n/g, " "),
      notas_admin:        str(row.admin_notes).replace(/\n/g, " "),
    };
  });

  // Construir CSV
  const headers = [
    "Nombre", "Email", "Teléfono", "Ciudad candidato",
    "Carrera", "Experiencia", "Educación", "Disponibilidad", "Aspiración salarial",
    "Oferta", "Ciudad oferta", "Estado", "Fecha postulación",
    "Carta de presentación", "Notas admin",
  ];

  const escapeCell = (v: string): string => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const csvLines = [
    headers.join(","),
    ...rows.map((r) => Object.values(r).map(escapeCell).join(",")),
  ];

  const csv = "﻿" + csvLines.join("\r\n"); // BOM para Excel

  const jobTitle = rows[0]?.oferta
    ? rows[0].oferta.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    : "todas";
  const filename = `postulaciones_${jobTitle}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
