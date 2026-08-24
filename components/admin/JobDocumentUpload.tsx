"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileUp, Loader2, AlertCircle, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uploadJobDocumentAction } from "@/lib/actions/ai-jobs";
import type { Company } from "@/lib/types/database";

const ACCEPTED = ".pdf,.docx";
const MAX_MB = 10;

export function JobDocumentUpload({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function selectFile(candidate: File | undefined) {
    setError(null);
    if (!candidate) return;

    const name = candidate.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("El archivo debe ser PDF o Word (.docx).");
      return;
    }
    if (candidate.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo no puede superar ${MAX_MB} MB.`);
      return;
    }
    setFile(candidate);
  }

  function handleSubmit(formData: FormData) {
    if (!file) {
      setError("Selecciona un archivo.");
      return;
    }
    formData.set("document", file);

    startTransition(async () => {
      const result = await uploadJobDocumentAction(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.documentId) {
        router.push(`/admin/jobs/new-ai/${result.documentId}/review`);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          selectFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-blue bg-brand-blue/5" : "border-gray-300 bg-brand-light"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-brand-blue shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-medium text-brand-navy truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-gray-500 underline hover:text-brand-blue ml-2"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <FileUp className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-brand-navy font-medium mb-1">
              Arrastra el documento de la oferta aquí
            </p>
            <p className="text-sm text-gray-500 mb-4">PDF o Word (.docx), máximo {MAX_MB} MB</p>
            <label className="inline-block">
              <input
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0])}
              />
              <span className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-gray-300 text-sm font-medium text-brand-navy cursor-pointer hover:border-brand-blue">
                Buscar archivo
              </span>
            </label>
          </>
        )}
      </div>

      <div>
        <label htmlFor="company_id" className="block text-sm font-medium text-brand-navy mb-1.5">
          Empresa
        </label>
        <select
          id="company_id"
          name="company_id"
          defaultValue={companies.find((c) => c.is_platform_owner)?.id ?? ""}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.is_platform_owner ? " (propia)" : ""}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl bg-brand-light border border-gray-200 p-4 text-sm text-gray-600">
        La IA extraerá los datos del documento y te mostrará una pantalla de revisión.
        <strong className="text-brand-navy"> La oferta no se publica hasta que tú la apruebes.</strong>
      </div>

      <Button type="submit" disabled={isPending || !file} className="w-full sm:w-auto">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Subiendo…
          </>
        ) : (
          "Procesar documento"
        )}
      </Button>
    </form>
  );
}
