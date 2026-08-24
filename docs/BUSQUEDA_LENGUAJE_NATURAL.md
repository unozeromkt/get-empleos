# Búsqueda por lenguaje natural — módulo 04

Documento de implementación. Complementa `AI_SCREENING_IMPLEMENTATION_PLAN.md`;
las referencias `§n` apuntan a la spec original de screening.

---

## 1. Qué es y qué no es

El reclutador de Get Company escribe en una caja de texto:

> *"vendedora con 3 años en retail que maneje Excel, en Medellín"*

y obtiene una lista ordenada de personas de **toda la base de hojas de vida**,
con puntaje, evidencia citada y explicación de por qué aparece cada una.

**Qué es**: un módulo transversal, independiente de las vacantes, de uso
exclusivo del admin de Get Company.

**Qué NO es**:
- No es un buscador de ofertas para candidatos.
- No sustituye al screening por vacante (módulo 02). Ese sigue siendo la
  fuente de verdad para evaluar postulantes de un cargo concreto.
- No modifica ninguna tabla, ruta ni flujo existente. Es 100% aditivo y vive
  detrás de `FEATURE_AI_TALENT_SEARCH`.

---

## 2. Decisión de arquitectura: dónde entra la IA

**La IA interpreta la pregunta. El motor determinístico responde.**

```
frase libre  ──①LLM──▶  TalentQuery  ──②SQL──▶  candidatos plausibles
                         (estructura)              (recall)
                              │                       │
                              └────③ lib/matching/engine.ts ◀──┘
                                     (determinístico, sin LLM)
                                          │
                                          ▼
                                    ranking + evidencia
```

| Capa | Tecnología | Por qué |
|---|---|---|
| ① Parseo | LLM, 1 llamada, Structured Outputs | Un buscador de keywords no resuelve `>3 años` (aritmética), negaciones ("sin necesidad de inglés"), ni sinónimos de dominio ("retail" ≈ "almacén de cadena") |
| ② Recall | SQL puro sobre índice materializado | Barato, indexado, sin costo por búsqueda |
| ③ Ranking | `calculateMatch()` existente, sin cambios | Determinístico, explicable, auditado, con la protección anti-sesgo de §29 ya implementada |

El LLM **nunca** puntúa candidatos. Si lo hiciera perderíamos determinismo,
explicabilidad y control de sesgo, y pagaríamos una llamada por candidato en
vez de una por búsqueda.

### La "vacante virtual"

`calculateMatch(job: JobRequirements, candidate: CandidateEvidence)` no sabe de
dónde salen sus requisitos. `lib/search/query-adapter.ts` traduce el
`TalentQuery` a un `JobRequirements`, y el motor funciona igual que con una
oferta real. Cero código nuevo de scoring.

**Matiz de interpretación**: una consulta de tres palabras produce un
`JobRequirements` escueto, así que un `91%` significa *"encaja con lo poco que
pediste"*, no *"es idóneo para el cargo"*. Por eso la UI da protagonismo a la
banda y al orden, y deja el número en segundo plano.

---

## 3. Universo de búsqueda y cobertura

El índice es **toda fila vigente de `candidate_profile_versions`**, lo que une
dos poblaciones que hoy viven separadas:

| Origen | `candidate_id` | Cómo llegó |
|---|---|---|
| Candidato registrado | con valor | Subió su CV en `/profile` |
| CV suelto | `NULL` | Carga masiva del admin (módulo 01) |

Un CV puede estar en tres estados. El módulo los trata distinto y **lo dice en
pantalla**:

| Estado | Qué permite | Costo de llegar ahí |
|---|---|---|
| Perfil canónico extraído | Ranking completo con evidencia y gaps | ~USD 0.004 / CV, una vez |
| Solo `extracted_text` | Coincidencia de texto, sin puntaje | Gratis (`unpdf` / `mammoth`, sin LLM) |
| Solo el PDF en Storage | Invisible | — |

Los dos últimos aparecen en una **sección aparte** del resultado, nunca
mezclados en el ranking: enseñar un hit de texto junto a un score de 87% sería
mentir sobre lo que el sistema sabe.

### Backfill

A ~USD 0.004 por CV, procesar 500 hojas de vida cuesta ~USD 2. No hay decisión
económica: se procesa toda la base.

No hacerlo por el worker de Vercel: cada extracción tarda 28–44 s contra un
`maxDuration` de 60 s, así que `AI_WORKER_BATCH_SIZE` no se puede subir de 1, y
con el cron cada minuto son ~8 horas para 500 CVs. El botón *"Procesar las N
restantes"* encola todo y deja que el worker avance solo; para un backfill
grande conviene un script local con `service_role` y concurrencia 4 (~1 h para
500 CVs), idempotente por `sha256`.

---

## 4. TalentQuery — el contrato del parseo

`lib/ai/schemas/talent-query.ts`. Mismas restricciones de Structured Outputs
que los otros schemas: todo obligatorio con `.nullable()`, nunca `.optional()`,
sin `.min()` / `.max()` / refinamientos.

```
interpreted_role       string | null
skills[]               { raw_name, canonical_name, category, importance }
experience             { minimum_years, relevant_roles[], industries[] }
education[]            { level, field, importance }
certifications[]       { name, importance }
languages[]            { language, minimum_level, importance }
location               { city, work_mode }
rejected_criteria[]    { criterion, reason }   ← atributos protegidos
unsupported_criteria[] string                  ← lo que no sabemos filtrar
interpretation_notes[] string
confidence             number
```

### Reglas del prompt (`lib/ai/prompts/talent-query.ts`)

1. **No inventar.** Lo que la frase no dice → `null` / `[]`. Nada de completar
   con lo que "normalmente" pide ese cargo.
2. **Importancia según el lenguaje**: `must_have` solo con "indispensable",
   "obligatorio", "excluyente"; `preferred` con "deseable", "ojalá", "plus";
   el resto `required`.
3. **Negaciones**: "sin necesidad de inglés" NO produce un requisito de inglés.
4. **Atributos protegidos**: género, edad, estado civil, embarazo,
   nacionalidad, religión, raza, discapacidad y apariencia van a
   `rejected_criteria` con su motivo — nunca a `skills`. La UI lo muestra como
   aviso explícito. Fuente única de verdad: `lib/matching/excluded-attributes.ts`.
5. **Ciudad ≠ requisito puntuable**: va a `location`, que es filtro de recall,
   no criterio de scoring.

### Caché de parseo

`talent_searches.query_hash = sha256(query normalizada)`. Repetir una búsqueda
idéntica reutiliza el `parsed_query` guardado y no paga la llamada (§34).
Editar chips tampoco llama al LLM: re-ejecuta solo las capas ② y ③.

---

## 5. Recall — `candidate_search_index`

Desempaquetar el `jsonb` de miles de perfiles en cada búsqueda no escala. La
migración `019` crea una proyección delgada, una fila por perfil vigente,
mantenida por trigger:

```
profile_version_id  PK    skills text[]        total_years numeric
candidate_id              job_titles text[]    city text
document_id               languages text[]     source text
display_name/email/phone  certifications[]     searchable tsvector
headline                  education_fields[]   overall_confidence
```

Índices: GIN sobre `skills` y sobre `searchable`, B-tree sobre `city` y
`total_years`.

`display_name`, `email` y `phone` viven aquí **solo para mostrar y contactar**.
Nunca entran al motor: `toCandidateEvidence()` no los copia (§29).

### Función `talent_search_recall(p_terms, p_city, p_min_years, p_limit)`

Devuelve `profile_version_id` + `lexical_score`, ordenado y limitado.

Dos decisiones deliberadas:

- **Los años desconocidos NO excluyen.** Si el CV no permite calcular
  `total_years`, el candidato entra igual al recall y el motor lo puntúa como
  `unknown`. Es el mismo principio de §8: la ausencia de evidencia no es
  evidencia de ausencia.
- **Recall generoso.** Con `p_limit = 400` y una base de pocos cientos de CVs,
  se puntúa a todo el mundo. El límite existe para el día que la base crezca,
  no para filtrar hoy.

`SECURITY INVOKER`, así que la RLS de admin sigue aplicando dentro de la función.

### Normalización

`search_normalize(text)` — `IMMUTABLE`, quita tildes y baja a minúsculas. Se
aplica al construir el índice y se replica en TS (`normalizeTerm`) para los
términos de la consulta. Sin `unaccent`: no es `IMMUTABLE` y no serviría en un
índice.

---

## 6. Ranking y presentación

`lib/search/talent-search.ts`:

1. Recall → hasta 400 `profile_version_id`.
2. Cargar esos perfiles + sus filas de índice.
3. Por cada uno: `candidateProfileSchema.safeParse` → `toCandidateEvidence` →
   `calculateMatch`. Precedencia `confirmed_profile ?? ai_profile` (§33).
4. Descartar a quien no cumple **ningún** criterio (se cuentan aparte, no se
   ocultan en silencio).
5. Ordenar por score y devolver el top con su detalle por requisito.

### Sugerencias de relajación

Para cada requisito obligatorio se cuentan los candidatos cuyo **único** fallo
es ese. Produce *"Quitando Excel → 41 candidatos"*. Es aritmética sobre el
resultado ya calculado: cero llamadas y cero consultas extra.

### UI

Ruta `/admin/talento`, entrada propia en el sidebar.

```
🔍 [ vendedora con 3 años en retail que maneje Excel, en Medellín ]
340 de 512 hojas de vida procesadas · [Procesar las 172 restantes →]

Entendí:  [Ventas ×] obligatorio  [Excel ×] deseable  [≥3 años ×]
          [Retail ×]  [Medellín ×]
⚠ "vendedora" indica género — ignorado por política de no discriminación

── 23 perfiles evaluados ────────────────────────────────────────────
  Laura Restrepo M.        [91%] Alta   confianza 78%
  Asesora comercial · Medellín · 5 años
  ✓ Ventas  ✓ Excel  ✓ Retail  ✓ ≥3 años
  ▸ Por qué aparece                        [Ver CV] [Añadir a vacante]

💡 Quitando [Excel] → 41 candidatos

── 4 coincidencias en CVs sin procesar ──────────────────────────────
  Sin evaluar — solo coincidencia de texto.   [Evaluar →]
```

Cuatro decisiones de diseño:

| Elemento | Por qué |
|---|---|
| **Chips editables** | La interpretación de la IA es visible y corregible sin reescribir la frase. Convierte una caja negra en un filtro. Editar no llama al LLM |
| **`✓ / ? / ✗`** | Distingue "no lo tiene" de "el CV no lo dice" (§8). Confundirlos sería el error más caro del sistema |
| **Evidencia literal** | La cita del CV que sustenta cada `✓`, igual que en el módulo 02 |
| **Secciones separadas** | Un score real y un hit de texto no se mezclan en una misma lista ordenada |

Se reutilizan `ScoreBadge` y `ConfidenceLabel` para que la gramática visual sea
idéntica a la del screening.

---

## 7. Modelo de datos — migración 019

Solo `CREATE`. Ningún `ALTER` sobre tablas existentes.

| Objeto | Propósito |
|---|---|
| `candidate_search_index` | Proyección de búsqueda (§5) |
| `refresh_candidate_search_index(uuid)` + triggers | Mantenimiento automático |
| `search_normalize(text)` | Normalización `IMMUTABLE` |
| `talent_search_recall(...)` | Recall indexado |
| `talent_searches` | Auditoría, caché de parseo, búsquedas guardadas y costo |
| Índice FTS sobre `candidate_documents.extracted_text` | Tier de CVs sin perfil |

RLS: **una sola política de admin por tabla**. Ni empresas ni candidatos leen
nada de este módulo. El costo de la llamada de parseo se guarda en
`talent_searches`, no en `ai_processing_runs`, para no tocar su `CHECK`.

---

## 8. Costos

| Concepto | Costo |
|---|---|
| Parseo de consulta | ~USD 0.0002 (gpt-4.1-mini, ~300 tokens) |
| Búsqueda repetida (caché) | USD 0 |
| Edición de chips | USD 0 |
| Ranking | USD 0 (JS puro) |
| **1.000 búsquedas/mes** | **≈ USD 0.20** |

---

## 9. Limitaciones conocidas

| # | Limitación | Dónde |
|---|---|---|
| L1 | El recall no reconoce sinónimos fuera de la tabla de alias ("Meta Ads" vs "Facebook Ads"). Es la misma D10 del plan de screening; se resuelve con embeddings + `pgvector` en la capa de recall, sin tocar el ranking | `skill-normalizer.ts` |
| L2 | Los umbrales del motor siguen SIN CALIBRAR (D9). Un score de búsqueda hereda esa advertencia | `lib/matching/` |
| L3 | La ciudad se compara por texto normalizado; no hay jerarquía geográfica ("Medellín" no incluye "Envigado") | `talent_search_recall` |
| L4 | Un CV sin perfil extraído solo se encuentra por texto plano | §3 |
| L5 | `total_years` depende de que el CV traiga fechas. Sin ellas queda `unknown`, nunca 0 | `adapters.ts` |
