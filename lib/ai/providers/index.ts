import { aiConfig } from "@/lib/ai/config";
import type { AIProfileExtractionProvider, AITalentQueryProvider } from "@/lib/ai/provider";
import { openAIProvider } from "@/lib/ai/providers/openai";

/**
 * Factory de proveedores de IA — spec §23.
 *
 * Para añadir un proveedor: implementa `AIProfileExtractionProvider` en un
 * archivo nuevo de esta carpeta, regístralo aquí, y apunta la variable
 * `AI_PROVIDER` a su clave. Nada más cambia en la aplicación.
 */
const PROVIDERS: Record<string, AIProfileExtractionProvider & AITalentQueryProvider> = {
  openai: openAIProvider,
};

export function getExtractionProvider(): AIProfileExtractionProvider {
  const provider = PROVIDERS[aiConfig.provider];
  if (!provider) {
    throw new Error(
      `Proveedor de IA desconocido: "${aiConfig.provider}". Disponibles: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  return provider;
}

/**
 * Proveedor para la interpretación de búsquedas en lenguaje natural.
 * Mismo objeto, otra interfaz: si algún día conviene usar un modelo distinto
 * (más barato y más rápido) para parsear consultas, se cambia solo aquí.
 */
export function getTalentQueryProvider(): AITalentQueryProvider {
  const provider = PROVIDERS[aiConfig.provider];
  if (!provider) {
    throw new Error(
      `Proveedor de IA desconocido: "${aiConfig.provider}". Disponibles: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  return provider;
}
