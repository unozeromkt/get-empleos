"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { runWorkerNowAction } from "@/lib/actions/ai-jobs";

/**
 * Empuja la cola de IA mientras un admin tiene la pantalla abierta.
 *
 * En producción pg_cron ya dispara el worker cada minuto, pero con
 * AI_WORKER_BATCH_SIZE=1 eso son 3 minutos por hoja de vida (extraer texto →
 * extraer perfil → calcular match). Demasiado lento para alguien que está
 * mirando. Este hook adelanta ese trabajo; el cron sigue siendo la red de
 * seguridad para cuando nadie mira.
 */

/**
 * Invocaciones simultáneas. `claim_ai_runs` usa FOR UPDATE SKIP LOCKED, así que
 * varias llamadas en paralelo nunca reclaman el mismo run.
 *
 * No subir sin medirlo: cada run tarda 28-44s y consume presupuesto de OpenAI
 * (ver AI_DAILY_COST_LIMIT_USD).
 */
const CONCURRENCY = 3;

/** Pausa entre ciclos cuando el anterior sí reclamó trabajo. */
const ACTIVE_DELAY_MS = 1_500;

/**
 * Pausa larga cuando la cola no entregó nada: lo que queda pendiente está
 * esperando su backoff, así que insistir cada segundo solo genera ruido.
 */
const IDLE_DELAY_MS = 15_000;

export function useQueueDrain(hasPending: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!hasPending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cycle = async () => {
      if (cancelled) return;

      // Un run por invocación: encadenar varios dentro de la misma llamada se
      // pasaría del maxDuration de la función serverless.
      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () => runWorkerNowAction().catch(() => null))
      );

      if (cancelled) return;

      const claimed = results.reduce((acc, r) => acc + (r?.summary.claimed ?? 0), 0);

      router.refresh();
      timer = setTimeout(cycle, claimed > 0 ? ACTIVE_DELAY_MS : IDLE_DELAY_MS);
    };

    void cycle();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasPending, router]);
}
