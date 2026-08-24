# Auditoría de alcance — estado real del sistema

Revisión completa contra los criterios de aceptación de la especificación
(`AI_CANDIDATE_SCREENING_CLAUDE_CODE.md`), verificada contra el código, no contra
lo que se supone que se hizo.

---

## §40 — Criterios de aceptación: creación de oferta desde documento

| # | Criterio | Estado |
|---|---|---|
| 1 | Se puede crear una oferta manualmente como antes | ✅ `JobForm` intacto |
| 2 | Existe opción para crearla desde PDF/DOCX | ✅ `/admin/jobs/new-ai` |
| 3 | Archivo se almacena de forma privada | ✅ Bucket `job-documents`, sin acceso público |
| 4 | Se extrae texto correctamente | ✅ `unpdf` + `mammoth`, 7 tests |
| 5 | La IA genera estructura validada | ✅ Structured Outputs + doble validación Zod |
| 6 | Campos no encontrados no se inventan | ✅ Prompt explícito + tests de fixture sin salario |
| 7 | Se muestra evidencia y confianza | ✅ Cita textual por requisito + badge de confianza |
| 8 | Recruiter puede editar antes de publicar | ✅ Pantalla Review & Confirm |
| 9 | Oferta aprobada genera URL pública | ✅ Reutiliza `jobs.slug` existente |
| 10 | Errores de extracción se manejan sin perder el documento | ✅ Estado `failed` + botón reintentar |
| 11 | Existen tests | ✅ 19 tests de extracción y saneado |

---

## §41 — Criterios de aceptación: hoja de vida

| # | Criterio | Estado |
|---|---|---|
| 1 | Candidato puede cargar CV | ✅ PDF y DOCX |
| 2 | Sistema extrae experiencia | ✅ Con fechas, responsabilidades y logros |
| 3 | Sistema extrae educación | ✅ Institución, título, área, estado |
| 4 | Sistema extrae skills | ✅ Con categoría y confianza individual |
| 5 | Sistema extrae certificaciones | ✅ |
| 6 | Sistema extrae idiomas | ✅ |
| 7 | Adjunta evidencia a skills relevantes | ✅ Cita textual por habilidad |
| 8 | Candidato puede revisar y corregir | ✅ `/profile/review` |
| 9 | CV no es público | ✅ Bucket privado + URL firmada |
| 10 | Perfil estructurado es versionado | ✅ `candidate_profile_versions` |
| 11 | Existen tests | ✅ 24 tests del mapeo y precedencia |

---

## §42 — Criterios de aceptación: matching

| # | Criterio | Estado |
|---|---|---|
| 1 | Cada postulación puede tener score 0–100 | ✅ |
| 2 | Score determinístico desde el perfil estructurado | ✅ Motor puro, test de determinismo |
| 3 | Score contiene breakdown | ✅ 6 categorías |
| 4 | Se distinguen match, gap y unknown | ✅ 4 estados, con tests dedicados |
| 5 | Se muestran critical gaps | ✅ Visibles sin expandir la tarjeta |
| 6 | Existe confidence independiente | ✅ Fórmula separada del score |
| 7 | Existe versión de scoring | ✅ Guardada en cada resultado |
| 8 | Se guarda evidencia | ✅ `match_requirement_results` |
| 9 | Se recalcula cuando cambian inputs | ✅ Por hash de entrada |
| 10 | No se elimina candidato por score bajo | ✅ Solo se ordena, nunca se oculta |
| 11 | Unit tests cubren edge cases | ✅ 31 tests, incluidos los 16 casos de §43 |

---

## §47 — Definition of Done del MVP: los 18 pasos

| # | Paso | Estado |
|---|---|---|
| 1-5 | Crear oferta → subir documento → IA extrae → revisar → publicar → URL pública | ✅ |
| 6 | Candidato se registra | ✅ |
| 7 | Candidato sube CV | ✅ |
| 8 | IA parsea el CV | ✅ |
| 9 | Candidato confirma su perfil | ✅ |
| 10 | Candidato se postula | ✅ |
| 11 | Sistema calcula el match | ✅ Automático al postularse |
| 12 | Recruiter ve score 0–100 | ✅ |
| 13 | Recruiter ve banda de color | ✅ 4 bandas |
| 14 | Recruiter ve breakdown | ✅ |
| 15 | Recruiter ve skills coincidentes | ✅ |
| 16 | Recruiter ve brechas | ✅ |
| 17 | Recruiter ve evidencia del CV | ✅ En el reporte individual |
| 18 | Recruiter toma la decisión | ✅ Pipeline de estados, sin automatismo |

**El MVP está completo.**

---

## Correcciones aplicadas en esta revisión

### 1. El candidato nuevo no veía la prioridad del CV

**Problema encontrado:** al registrarse, el candidato aterriza en `/dashboard`, no en
`/profile`. El banner CV-first que se había construido vivía solo en `/profile`, así
que el usuario nuevo veía un checklist genérico donde "Hoja de vida" era el paso 5 de
5 — el último.

**Corregido:**
- Tarjeta destacada en `/dashboard` cuando no hay CV: "Empieza aquí — Sube tu hoja de
  vida", con la explicación de que la IA completará el perfil, y botón directo.
  Reemplaza a la alerta genérica de "perfil al X%", que solo aparece ya con CV cargado.
- El checklist de progreso se reordenó: el CV pasó de último a **primero**, porque es
  el paso que dispara el autocompletado de los otros cuatro.

### 2. Vista de candidatos poco legible

**Problema:** tabla de 10 columnas con texto pequeño, contraste bajo (grises sobre
blanco), y el puntaje —el dato que ordena toda la lectura— compitiendo visualmente
con el resto de celdas.

**Corregido:** se sustituyó la tabla por **tarjetas**, con esta jerarquía:

1. **Fila de resumen**: total, alta compatibilidad, con brecha crítica, procesándose.
2. **Puntaje como bloque de color de 64px** a la izquierda de cada tarjeta — el ojo
   lo encuentra primero y la banda se lee por color antes que por texto.
3. Nombre, banda en palabras y confianza; contacto en gris secundario.
4. Las tres puntuaciones (Requisitos / CV / Autoevaluación) agrupadas a la derecha.
5. **Brecha crítica visible sin expandir**, en franja roja.
6. Selector de estado **con color según el estado** del pipeline.
7. Detalle expandible con barras por categoría, fortalezas, brechas y preguntas.

Cambios de contraste concretos: los grises de texto pasaron de `text-gray-400/500` a
`text-gray-600/700` sobre fondo blanco; las bandas usan color sólido sobre el bloque
de puntaje en vez de transparencias al 10%; el filtro activo pasó a fondo navy sólido
con texto blanco.

---

## Deuda pendiente conocida

| # | Asunto | Impacto |
|---|---|---|
| D9 | Umbrales de coincidencia sin calibrar (0.5 parcial, 0.8 match) | El score es un punto de partida razonable, no un modelo validado |
| D10 | Sin embeddings: "Meta Ads" vs "Facebook Ads" no se reconoce | Falsos negativos en sinónimos no listados |
| D11 | Diccionario de alias escrito a mano (~18 entradas) | Cobertura limitada hasta integrar ESCO |
| D13 | Solo se evalúan ofertas creadas con IA | Las ofertas manuales no generan score |
| D15 | La pestaña Candidatos no muestra carta de presentación ni notas internas | Requiere ir a la vista clásica de postulaciones |
| D16 | Sin paginación en el listado de candidatos | Una oferta con cientos de candidatos carga todo de golpe |

Ninguna de estas bloquea el uso del MVP. La más relevante para la calidad percibida
del producto es **D9**: conviene acumular casos reales antes de presentar el puntaje
como definitivo ante el cliente final.
