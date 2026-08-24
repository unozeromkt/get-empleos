import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  /** Hojas de vida que ya llegaron a un estado final (incluye las fallidas). */
  done: number;
  /** Total de hojas de vida que entran en el proceso. */
  total: number;
  /** Cuántas terminaron en error, para no venderlas como éxito. */
  failed: number;
}

/**
 * Progreso del procesamiento automático de hojas de vida.
 *
 * Se muestra solo mientras queda trabajo pendiente: una barra permanente al
 * 100% no aporta nada y compite con el contenido real de la pantalla.
 */
export function QueueProgress({ done, total, failed }: Props) {
  if (total === 0) return null;

  const pct = Math.min(100, Math.round((done / total) * 100));
  const finished = done >= total;
  const remaining = Math.max(0, total - done);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {finished ? (
            <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-brand-blue animate-spin shrink-0" />
          )}
          <p className="text-sm font-medium text-brand-navy truncate">
            {finished
              ? "Procesamiento completado"
              : `Analizando hojas de vida — quedan ${remaining}`}
          </p>
        </div>
        <span className="text-sm font-semibold text-brand-navy tabular-nums shrink-0">{pct}%</span>
      </div>

      <div
        className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del análisis de hojas de vida"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            finished ? "bg-brand-green" : "bg-brand-blue"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {done} de {total} procesadas
        {failed > 0 && <span className="text-red-600"> · {failed} con error</span>}
        {!finished && " · el análisis continúa aunque cierres esta pantalla"}
      </p>
    </div>
  );
}
