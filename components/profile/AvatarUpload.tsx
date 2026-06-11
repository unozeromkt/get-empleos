"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Camera, X, Check, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAvatarAction } from "@/lib/actions/candidates";

interface Props {
  currentUrl: string | null;
  name: string;
}

async function getCroppedImage(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas  = document.createElement("canvas");
  const size    = 400; // output siempre 400x400
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    cropArea.x, cropArea.y, cropArea.width, cropArea.height,
    0, 0, size, size
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Canvas vacío")),
      "image/jpeg",
      0.9
    )
  );
}

export function AvatarUpload({ currentUrl, name }: Props) {
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [srcImage, setSrcImage]   = useState<string | null>(null);
  const [crop, setCrop]           = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom]           = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [preview, setPreview]     = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSrcImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleConfirm() {
    if (!srcImage || !croppedArea) return;
    setUploading(true);
    setError("");

    try {
      const blob = await getCroppedImage(srcImage, croppedArea);
      const formData = new FormData();
      formData.set("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

      const result = await uploadAvatarAction(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.avatar_url) {
        setPreview(result.avatar_url + `?t=${Date.now()}`);
        setSrcImage(null);
      }
    } catch {
      setError("Error al procesar la imagen.");
    } finally {
      setUploading(false);
    }
  }

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Avatar + botón */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative w-20 h-20 rounded-full overflow-hidden bg-brand-navy/10 cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <Image src={preview} alt="Avatar" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display text-xl font-bold text-brand-navy/50">
                {initials}
              </span>
            </div>
          )}
          {/* Overlay hover */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-brand-blue hover:underline"
        >
          {preview ? "Cambiar foto" : "Subir foto"}
        </button>
        {error && <p className="text-xs text-red-500 text-center max-w-[120px]">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Modal de recorte */}
      {srcImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-display font-semibold text-brand-navy">Recortar foto de perfil</h3>
              <button
                type="button"
                onClick={() => setSrcImage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Área del cropper */}
            <div className="relative w-full" style={{ height: 300 }}>
              <Cropper
                image={srcImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-3 flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brand-blue"
              />
              <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
            </div>

            {/* Botones */}
            <div className="px-5 pb-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setSrcImage(null)}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white"
                onClick={handleConfirm}
                disabled={uploading}
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Subiendo...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Guardar foto
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
