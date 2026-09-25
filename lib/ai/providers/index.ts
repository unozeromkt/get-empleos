import { aiConfig } from "@/lib/ai/config";
import type {
  AIJobImprovementProvider,
  AIProfileExtractionProvider,
  AISemanticMatchProvider,
  AITalentQueryProvider,
} from "@/lib/ai/provider";
import { openAIProvider } from "@/lib/ai/providers/openai";

/**
 * Factory de proveedores de IA — spec §23.
 *
 * Para añadir un proveedor: implementa `AIProfileExtractionProvider` en un
 * archivo nuevo de esta carpeta, regístralo aquí, y apunta la variable
 * `AI_PROVIDER` a su clave. Nada más cambia en la aplicación.
 */
type CompleteAIProvider = AIProfileExtractionProvider &
  AITalentQueryProvider &
  AIJobImprovementProvider &
  AISemanticMatchProvider;

const PROVIDERS: Record<string, CompleteAIProvider> = {
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

export function getJobImprovementProvider(): AIJobImprovementProvider {
  const provider = PROVIDERS[aiConfig.provider];
  if (!provider) throw new Error(`Proveedor de IA desconocido: "${aiConfig.provider}".`);
  return provider;
}

export function getSemanticMatchProvider(): AISemanticMatchProvider {
  const provider = PROVIDERS[aiConfig.provider];
  if (!provider) throw new Error(`Proveedor de IA desconocido: "${aiConfig.provider}".`);
  return provider;
}
