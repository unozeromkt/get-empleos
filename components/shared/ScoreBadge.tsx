/**
 * Banda visual del match — spec §12.3.
 *
 * `insufficient_data` (gris) NO significa "mal candidato": significa que no hay
 * información suficiente para juzgarlo. Se distingue del rojo a propósito;
 * confundirlos sería el error más caro del sistema.
 */
const BAND_STYLE: Record<string, string> = {
  high: "bg-brand-green/10 text-brand-green border-brand-green/30",
  potential: "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30",
  low: "bg-red-50 text-red-600 border-red-200",
  insufficient_data: "bg-gray-100 text-gray-500 border-gray-300",
};

export const BAND_LABEL: Record<string, string> = {
  high: "Alta",
  potential: "Parcial",
  low: "Baja",
  insufficient_data: "Datos insuficientes",
};

export function ScoreBadge({ score, band }: { score: number; band: string }) {
  const style = BAND_STYLE[band] ?? BAND_STYLE.insufficient_data;

  // Sin datos suficientes no se muestra número: enseñar "12%" invitaría a
  // leerlo como un juicio sobre la persona
  if (band === "insufficient_data") {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${style}`}>
        Sin datos
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-sm font-semibold ${style}`}>
      {score}%
    </span>
  );
}

export function ConfidenceLabel({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  return (
    <span
      className="text-xs text-gray-500"
      title="Qué tan fiable es este score, según cuánta evidencia se encontró en la hoja de vida. Es independiente del score."
    >
      confianza {percent}%
    </span>
  );
}
