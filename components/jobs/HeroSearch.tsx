"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLOMBIA_CITIES = [
  "Armenia", "Barranquilla", "Bogotá", "Bucaramanga", "Cali",
  "Cartagena", "Cúcuta", "Ibagué", "Leticia", "Manizales",
  "Medellín", "Montería", "Neiva", "Pasto", "Pereira",
  "Popayán", "Riohacha", "Santa Marta", "Sincelejo", "Tunja",
  "Valledupar", "Villavicencio", "Yopal",
];

const POPULAR_TAGS = ["Ventas", "Logística", "Tecnología", "Administrativo"];

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery]       = useState("");
  const [city, setCity]         = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen]         = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);

  // Filtrar sugerencias al escribir
  useEffect(() => {
    const trimmed = city.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const filtered = COLOMBIA_CITIES.filter((c) =>
      c.toLowerCase().includes(trimmed.toLowerCase())
    );
    setSuggestions(filtered);
    setOpen(filtered.length > 0);
    setHighlighted(-1);
  }, [city]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        cityInputRef.current &&
        !cityInputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCity(name: string) {
    setCity(name);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      selectCity(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city.trim())  params.set("city", city.trim());
    router.push(`/jobs${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2"
      >
        {/* Campo cargo / palabra clave */}
        <div className="flex items-center gap-2 flex-1 bg-white rounded-xl px-4 py-2.5 border border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cargo, área o palabra clave…"
            className="flex-1 text-sm text-brand-navy placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Campo ciudad con autocomplete */}
        <div className="relative sm:w-48" ref={dropdownRef}>
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-gray-100 h-full">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              ref={cityInputRef}
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => city.trim() && suggestions.length > 0 && setOpen(true)}
              placeholder="Ciudad"
              autoComplete="off"
              className="flex-1 text-sm text-brand-navy placeholder-gray-400 outline-none bg-transparent min-w-0"
            />
            {city && (
              <button type="button" onClick={() => { setCity(""); setOpen(false); }} className="text-gray-300 hover:text-gray-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown de sugerencias */}
          {open && (
            <ul className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden max-h-48 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCity(s)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                      i === highlighted
                        ? "bg-brand-blue/10 text-brand-blue font-medium"
                        : "text-brand-navy hover:bg-gray-50"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold rounded-xl shrink-0 px-7"
        >
          Buscar
        </Button>
      </form>

      {/* Quick links */}
      <div className="relative z-0 mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="text-white/60 text-xs">Popular:</span>
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => router.push(`/jobs?q=${tag}`)}
            className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1 rounded-full transition-colors backdrop-blur-sm"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
