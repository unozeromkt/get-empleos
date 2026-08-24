import { NextResponse, type NextRequest } from "next/server";

import { aiConfig } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPendingRuns } from "@/lib/queue/dispatch";

/**
 * Worker de la cola de IA.
 *
 * Lo dispara pg_cron desde Supabase cada minuto vía pg_net (migración 011),
 * porque Vercel Hobby solo permite cron diario. Ver plan §6.1.
 *
 * Runtime Node obligatorio: unpdf y mammoth no funcionan en Edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function runWorker(request: NextRequest) {
  if (!isAuthorized(request)) {
    // 404 en lugar de 401: no confirmamos la existencia del endpoint a quien
    // no tiene el secreto
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!aiConfig.enabled) {
    return NextResponse.json({ skipped: true, reason: "AI_DISABLED" });
  }

  const supabase = createAdminClient();
  const summary = await dispatchPendingRuns(supabase);

  return NextResponse.json(summary);
}

export async function POST(request: NextRequest) {
  return runWorker(request);
}

// GET permitido para poder disparar el worker a mano durante el desarrollo
export async function GET(request: NextRequest) {
  return runWorker(request);
}
