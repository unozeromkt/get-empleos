"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Building2 } from "lucide-react";
import { uploadEmpresaLogoAction } from "@/lib/actions/empresa";

interface Props {
  currentUrl: string | null;
  companyName: string;
}

export function LogoUpload({ currentUrl, companyName }: Props) {
  const fileInputRef             = useRef<HTMLInputElement>(null);
  const [preview, setPreview]    = useState<string | null>(currentUrl);
  const [isBlobUrl, setIsBlobUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]        = useState("");

  const initials = companyName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("El logo no puede superar 2 MB.");
      return;
    }

    setError("");
    setUploading(true);

    // Preview local inmediato (blob URL — siempre funciona sin Next.js Image)
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setIsBlobUrl(true);

    const formData = new FormData();
    formData.set("logo", file);

    const result = await uploadEmpresaLogoAction(formData);
    if (result?.error) {
      setError(result.error);
      setPreview(currentUrl);
      setIsBlobUrl(false);
    } else if (result?.logo_url) {
      setPreview(result.logo_url);
      setIsBlobUrl(false);
    }

    setUploading(false);
  }

  return (
    <div className="flex items-center gap-5">
      {/* Logo preview */}
      <div
        className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer group hover:border-brand-blue transition-colors shrink-0 relative"
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {preview ? (
          isBlobUrl ? (
            <object
              data={preview}
              type="image/png"
              className="w-full h-full object-contain p-2"
              aria-label="Logo preview"
            />
          ) : (
            <Image
              src={preview}
              alt="Logo"
              width={80}
              height={80}
              unoptimized
              className="w-full h-full object-contain p-2"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Building2 className="w-7 h-7 text-gray-300" />
            <span className="text-[10px] text-gray-300 font-bold">{initials}</span>
          </div>
        )}

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-brand-navy/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
          {uploading ? (
            <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Texto guía */}
      <div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-brand-blue hover:underline disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : preview ? "Cambiar logo" : "Subir logo"}
        </button>
        <p className="text-xs text-gray-400 mt-0.5">PNG, JPG o SVG · Máx. 2 MB</p>
        <p className="text-xs text-gray-400">Recomendado: fondo transparente, 400×400 px</p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
