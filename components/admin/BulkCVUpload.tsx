"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Check, FileUp, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uploadCandidateCVAction } from "@/lib/actions/ai-screening";

interface Result {
  filename: string;
  ok: boolean;
  error?: string;
}

export function BulkCVUpload({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) => /\.(pdf|docx)$/i.test(f.name));
    setFiles((prev) => [...prev, ...valid]);
    setResults([]);
  }

  function upload() {
    if (files.length === 0) return;

    startTransition(async () => {
      const collected: Result[] = [];

      // Secuencial a propósito: subir 20 CV en paralelo satura la función
      // serverless y dispara los límites de Storage
      for (const file of files) {
        const formData = new FormData();
        formData.set("job_id", jobId);
        formData.set("cv", file);

        const result = await uploadCandidateCVAction(formData);
        collected.push({
          filename: file.name,
          ok: !result?.error,
          error: result?.error,
        });
        setResults([...collected]);
      }

      setFiles([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-900">
          <p className="font-medium">Datos personales de terceros</p>
          <p className="mt-0.5">
            Estas hojas de vida son de personas que no se registraron en la plataforma ni
            aceptaron sus términos. Bajo la Ley 1581 sigue siendo tratamiento de datos
            personales: súbelas solo si cuentas con su autorización.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-blue bg-brand-blue/5" : "border-gray-300 bg-brand-light"
        }`}
      >
        <FileUp className="w-10 h-10 mx-auto text-gray-400 mb-3" />
        <p className="text-brand-navy font-medium mb-1">Arrastra una o varias hojas de vida</p>
        <p className="text-sm text-gray-500 mb-4">PDF o Word (.docx), máximo 10 MB cada una</p>
        <label className="inline-block">
          <input
            type="file"
            accept=".pdf,.docx"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-gray-300 text-sm font-medium text-brand-navy cursor-pointer hover:border-brand-blue">
            Buscar archivos
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-brand-navy truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, index) => index !== i))}
                className="text-xs text-gray-400 hover:text-red-600 shrink-0 ml-3"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={upload} disabled={isPending || files.length === 0}>
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Subiendo {results.length + 1} de {files.length + results.length}…
          </>
        ) : (
          `Subir y evaluar ${files.length > 0 ? `(${files.length})` : ""}`
        )}
      </Button>

      {results.length > 0 && (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {results.map((result, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
              {result.ok ? (
                <Check className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-brand-navy truncate">{result.filename}</p>
                {result.error && <p className="text-xs text-red-600">{result.error}</p>}
              </div>
            </div>
          ))}
          <p className="px-3 py-2 text-xs text-gray-500">
            Las hojas de vida se están procesando. Aparecerán en la pestaña Candidatos con su
            puntuación en cuanto termine.
          </p>
        </div>
      )}
    </div>
  );
}
