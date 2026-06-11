"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export function JobsSearchBar() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get("company_name") ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza el input si cambia la URL externamente (ej. al pulsar un tab)
  useEffect(() => {
    setValue(searchParams.get("company_name") ?? "");
  }, [searchParams]);

  const push = (newValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set("company_name", newValue);
    } else {
      params.delete("company_name");
    }
    // Resetear a página 1 si hubiera paginación
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => push(newValue), 350);
  };

  const handleClear = () => {
    setValue("");
    push("");
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Buscar por empresa..."
        className="w-full sm:w-64 h-9 pl-9 pr-8 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
