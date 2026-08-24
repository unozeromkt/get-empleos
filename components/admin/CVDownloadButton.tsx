"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { getCvUrlAction } from "@/lib/actions/talent-search";

/**
 * Descarga de una hoja de vida.
 *
 * El bucket `cvs` es privado y debe seguir siéndolo, así que nunca se expone
 * una ruta directa: se pide una URL firmada de vida corta en el momento del
 * clic (spec §28).
 */
export function CVDownloadButton({
  documentId,
  label,
  className,
}: {
  documentId: string;
  /** Si se pasa, se renderiza como enlace con texto en vez de solo icono. */
  label?: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setError(null);
    startTransition(async () => {
      const result = await getCvUrlAction(documentId);
      if (result.error || !result.url) {
        setError(result.error ?? "No se pudo abrir la hoja de vida.");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={open}
        disabled={isPending}
        title={error ?? "Descargar hoja de vida"}
        className={
          className ??
          "p-2 rounded-lg text-gray-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
        }
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label && <span className="text-sm font-medium">{label}</span>}
      </button>
      {error && <span className="text-[11px] text-red-600 mt-0.5">{error}</span>}
    </span>
  );
}
