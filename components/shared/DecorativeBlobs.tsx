interface DecorativeBlobsProps {
  variant?: "hero" | "subtle" | "cta";
}

export function DecorativeBlobs({ variant = "hero" }: DecorativeBlobsProps) {
  if (variant === "subtle") {
    return (
      <>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-blue/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-brand-purple/8 blur-3xl pointer-events-none" />
      </>
    );
  }

  if (variant === "cta") {
    return (
      <>
        <div className="absolute -top-16 right-1/4 w-64 h-64 rounded-full bg-brand-blue/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-brand-purple/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -translate-y-1/2 left-10 w-48 h-48 rounded-full bg-brand-yellow/10 blur-3xl pointer-events-none" />
      </>
    );
  }

  // hero variant — replicates the blob positions from getcompany.co
  return (
    <>
      {/* Morado — arriba izquierda */}
      <div className="absolute -top-8 -left-8 w-72 h-72 rounded-full bg-brand-purple/35 blur-3xl pointer-events-none" />
      {/* Amarillo — arriba derecha */}
      <div className="absolute top-0 right-16 w-56 h-56 rounded-full bg-brand-yellow/45 blur-3xl pointer-events-none" />
      {/* Cyan — abajo izquierda */}
      <div className="absolute bottom-8 left-24 w-44 h-44 rounded-full bg-brand-cyan/40 blur-3xl pointer-events-none" />
      {/* Navy oscuro — abajo derecha */}
      <div className="absolute -bottom-10 right-0 w-80 h-80 rounded-full bg-brand-navy/25 blur-3xl pointer-events-none" />
      {/* Verde — medio izquierda baja */}
      <div className="absolute bottom-4 left-4 w-36 h-36 rounded-full bg-brand-green/30 blur-2xl pointer-events-none" />
    </>
  );
}
