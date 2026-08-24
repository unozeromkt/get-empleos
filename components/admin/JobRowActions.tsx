"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Ban,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  archiveJobAction,
  deleteJobAction,
  restoreJobAction,
  updateJobStatusAction,
} from "@/lib/actions/jobs";

interface Props {
  jobId: string;
  status: string;
  title: string;
  /** Postulaciones asociadas: se pierden si la oferta se elimina de verdad. */
  applications: number;
}

export function JobRowActions({ jobId, status, title, applications }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera: el menú vive dentro de una fila de tabla y
  // dejarlo abierto tapa los datos de las filas siguientes.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setConfirming(false);
      router.refresh();
    });
  };

  const archived = status === "archived";

  return (
    <div className="relative inline-block text-left" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-navy hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreHorizontal className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-gray-200 bg-white shadow-md p-1.5 text-left"
        >
          {archived ? (
            <>
              <MenuItem
                icon={<RotateCcw className="w-4 h-4" />}
                label="Restaurar oferta"
                hint="Vuelve a su estado anterior"
                onClick={() => run(() => restoreJobAction(jobId))}
              />

              <div className="my-1 border-t border-gray-100" />

              {confirming ? (
                <div className="px-2.5 py-2 space-y-2">
                  <p className="text-xs text-gray-600 leading-snug">
                    Se eliminará <span className="font-semibold text-brand-navy">{title}</span>
                    {applications > 0 && (
                      <>
                        {" "}y sus{" "}
                        <span className="font-semibold text-red-600">
                          {applications} postulacion{applications === 1 ? "" : "es"}
                        </span>
                      </>
                    )}
                    . No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => run(() => deleteJobAction(jobId))}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <MenuItem
                  icon={<Trash2 className="w-4 h-4" />}
                  label="Eliminar definitivamente"
                  hint={
                    applications > 0
                      ? `Se perderán ${applications} postulaciones`
                      : "No se puede deshacer"
                  }
                  danger
                  onClick={() => setConfirming(true)}
                />
              )}
            </>
          ) : (
            <>
              {status === "active" && (
                <MenuItem
                  icon={<PauseCircle className="w-4 h-4" />}
                  label="Pausar"
                  hint="Deja de aparecer en el portal"
                  onClick={() => run(() => updateJobStatusAction(jobId, "paused"))}
                />
              )}

              {status === "paused" && (
                <MenuItem
                  icon={<PlayCircle className="w-4 h-4" />}
                  label="Reactivar"
                  hint="Vuelve a publicarse"
                  onClick={() => run(() => updateJobStatusAction(jobId, "active"))}
                />
              )}

              {status !== "closed" && (
                <MenuItem
                  icon={<Ban className="w-4 h-4" />}
                  label="Cerrar"
                  hint="La vacante ya no admite postulaciones"
                  onClick={() => run(() => updateJobStatusAction(jobId, "closed"))}
                />
              )}

              <div className="my-1 border-t border-gray-100" />

              <MenuItem
                icon={<Archive className="w-4 h-4" />}
                label="Enviar a la papelera"
                hint="Reversible, no borra nada"
                onClick={() => run(() => archiveJobAction(jobId))}
              />
            </>
          )}

          {error && <p className="px-2.5 pt-1.5 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-brand-navy hover:bg-gray-50"
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${danger ? "text-red-500" : "text-gray-400"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5 leading-tight">{hint}</span>}
      </span>
    </button>
  );
}
