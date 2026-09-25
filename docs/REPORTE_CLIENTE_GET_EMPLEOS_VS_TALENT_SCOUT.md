# Comparativo del sistema de perfilamiento de candidatos

## Get Empleos vs. Talent Scout

**Documento de trabajo para Get Company**

**Fecha:** 24 de septiembre de 2026

**Carácter:** Confidencial — uso interno y presentación al cliente

---

## 1. Resumen ejecutivo

Get Company está evaluando la sustitución de Talent Scout por la solución de
perfilamiento integrada en Get Empleos. Para apoyar esa decisión revisamos
casos reales conocidos por el equipo, perfiles de cargo generados por ambos
sistemas y 61 evaluaciones visibles en Talent Scout.

La conclusión principal es la siguiente:

> **Get Empleos ofrece, a priori, una base más fiable, verificable y segura para
> apoyar decisiones de selección.** No porque produzca siempre un porcentaje
> más alto, sino porque diferencia hechos, inferencias y datos faltantes;
> conserva la evidencia que explica cada resultado; y evita convertir rasgos
> personales o frases genéricas del CV en supuestas mediciones psicológicas.

El análisis también encontró defectos en la versión anterior de Get Empleos.
Esos defectos explican resultados excesivamente bajos, como el 34% del caso de
Daniel Hidalgo. Fueron corregidos en la versión v4 del motor. La simulación
reproducible del mismo caso pasa de **34/100 a 65/100**, sin inventar funciones
que no están documentadas en la hoja de vida.

Talent Scout presenta resultados más altos en varios casos porque combina:

1. una lista binaria de requisitos, donde todos parecen valer lo mismo; y
2. una puntuación de seis dimensiones conductuales inferidas desde el texto del
   CV.

Cuando no existe autoevaluación, el resultado visible de Talent Scout es, en
términos prácticos, el promedio de esas dos columnas. Esto puede elevar el
porcentaje, pero un porcentaje mayor no equivale automáticamente a una mejor
predicción del desempeño laboral.

---

## 2. Qué debe significar un porcentaje de compatibilidad

Un porcentaje de compatibilidad debería responder una pregunta concreta:

> ¿Qué tan bien demuestra esta persona, con la información disponible, que
> cumple los criterios relevantes para este cargo?

Para que el porcentaje sea útil, debe cumplir cuatro condiciones:

- **Relacionado con el trabajo:** medir conocimientos, experiencia, formación
  y condiciones realmente necesarias para el cargo.
- **Trazable:** mostrar qué fragmento de la oferta y qué fragmento del CV
  sustentan cada conclusión.
- **Honesto frente a la incertidumbre:** distinguir entre “no cumple” y “no hay
  información suficiente”.
- **Reproducible:** las mismas entradas y la misma versión deben producir el
  mismo resultado.

El objetivo no debe ser conseguir el porcentaje más alto. Debe ser reducir
falsos descartes, identificar brechas reales y facilitar una revisión humana
consistente.

---

## 3. Cómo funciona cada sistema

### Talent Scout

Según los perfiles y resultados visibles analizados, Talent Scout separa la
evaluación en tres columnas:

- **Puntuación de requisitos:** cumplimiento binario de una lista de requisitos.
- **Puntuación de CV:** evaluación de seis dimensiones conductuales.
- **Autoevaluación:** aparece como una tercera fuente cuando el candidato la
  completa.

En los casos sin autoevaluación, el total observado sigue esta lógica:

```text
Total ≈ (Puntuación de requisitos + Puntuación de CV) / 2
```

Las seis dimensiones utilizadas en todos los cargos revisados son:

1. Ethical-Leader
2. Altruistic-Creator
3. Assertive-Directive
4. Analytical-Autonomous
5. Resilient-Adaptive
6. Creative-Innovative

El sistema cambia la importancia de esas dimensiones según el cargo. Esa
adaptación por rol es positiva. La debilidad está en que las puntúa desde el CV
usando, entre otras señales, frases como “responsable”, “honesto”, “trabajo en
equipo”, “aprendo rápido” o “buena actitud”.

Estas frases pueden ser información útil para una entrevista, pero no son por
sí solas una medición validada de ética, altruismo, liderazgo o resiliencia.

### Get Empleos

Get Empleos separa dos procesos:

1. **La IA extrae información estructurada** de la oferta y del CV.
2. **Un motor determinístico calcula el match**, usando reglas versionadas y
   evidencias visibles.

La IA no decide libremente el porcentaje final. El resultado se construye a
partir de categorías explícitas:

- experiencia relevante;
- habilidades técnicas y herramientas;
- educación y certificaciones;
- idiomas;
- ubicación, cuando es pertinente;
- requisitos deseables; y
- competencias transferibles únicamente cuando exista evidencia laboral.

Si el CV no permite comprobar algo, Get Empleos puede responder **“dato
desconocido”**. Esa condición reduce la confianza del resultado, pero no se
convierte automáticamente en un cero.

---

## 4. Comparación directa

| Aspecto | Talent Scout | Get Empleos v4 |
|---|---|---|
| Cálculo de requisitos | Aparentemente binario y con pesos iguales | Ponderado por importancia y evidencia |
| Datos faltantes | Pueden terminar reduciendo la puntuación | Se distinguen como `desconocidos` |
| Personalidad desde el CV | Se infieren seis dimensiones | No se infiere personalidad desde el estilo del CV |
| Habilidades blandas | Frases genéricas pueden recibir crédito | Requieren una acción o resultado laboral concreto |
| Explicación | Texto generado por dimensión | Evidencia del CV vinculada a cada requisito |
| Reproducibilidad | El resultado observado cambió en el tiempo | Motor determinístico y versionado |
| Requisitos críticos | Parecen valer lo mismo que otros requisitos | `must_have`, requerido y deseable tienen pesos distintos |
| Datos protegidos | Se encontró género en un perfil ideal | Se excluyen del perfil y se registran como advertencia |
| Integración | Herramienta separada | Parte del portal, postulaciones y perfiles de usuario |
| Revisión humana | Permite ajustar criterios | Conserva versión, confirmación y diferencias frente a la IA |

---

## 5. Caso real: Daniel Hidalgo — Auxiliar de Bodega

Este es el ejemplo más claro porque fue identificado directamente por Get
Company y existe resultado en ambos sistemas.

### Resultados observados

| Medición | Talent Scout — captura | Talent Scout — revisión posterior | Get Empleos anterior | Get Empleos v4 — simulación |
|---|---:|---:|---:|---:|
| Requisitos | 83% | 83% | 22% | 69% evaluable |
| Componente CV | 58% | 55% | 34% | Integrado por evidencia |
| Resultado total | 71% | 69% | 34% | **65%** |
| Confianza | No visible | No visible | 73% | **Datos insuficientes** |

### Qué ocurrió en la versión anterior de Get Empleos

El 34% no reflejaba correctamente la trayectoria del candidato. Se encontraron
tres causas específicas:

1. El CV declara **5 años y 8 meses como Auxiliar Logístico**, pero el extractor
   anterior solo calculaba experiencia cuando encontraba fechas completas.
2. “Auxiliar bachiller” y “Auxiliar logístico” empataban por la palabra
   “auxiliar”, y el sistema seleccionaba el primer cargo.
3. La oferta incluía nueve funciones. Como el CV enumeraba los cargos pero no
   detallaba sus tareas, las nueve funciones se trataban como incumplimientos.

En otras palabras, el sistema estaba confundiendo **ausencia de detalle** con
**falta de experiencia**.

### Qué corrige la versión v4

- Conserva duraciones expresadas como “5 años y 8 meses”.
- Reconoce equivalencias entre Auxiliar Logístico, Auxiliar de Bodega,
  almacenista y cargos relacionados.
- No considera incumplida una función que el CV no permite comprobar.
- Mantiene sin acreditar tareas como empaque, alistamiento o inventarios si no
  existe evidencia textual.

El resultado ajustado es **65/100**. La cobertura de requisitos comprobables es
**69%**, pero el sistema advierte “Datos insuficientes” porque el CV no describe
las funciones realizadas.

Esta respuesta es más útil para el reclutador que cualquiera de los extremos:

- no descarta al candidato con un 34% artificial;
- tampoco presenta un 71% como certeza total;
- recomienda confirmar las funciones de bodega durante la entrevista.

### Qué explica el resultado de Talent Scout

Talent Scout considera cumplidos 5 de 6 requisitos, lo que produce 83%. Luego
calcula entre 55% y 58% en dimensiones conductuales y promedia ambos resultados.

El cambio de 58% a 55% en el componente CV —y de 71% a 69% en el total— muestra
que el resultado observado no fue completamente estable entre las dos revisiones.

---

## 6. Ejemplo real: efecto de un requisito añadido manualmente

En el perfil **Auxiliar de Terminación de Confección – Medellín** aparecen siete
requisitos, incluido **“Hablar Francés”**.

Los resultados visibles son 71%, 57% y 43%, que corresponden exactamente a:

```text
5 de 7 = 71%
4 de 7 = 57%
3 de 7 = 43%
```

Esto significa que “Hablar Francés” representa aproximadamente **14,3%** de la
puntuación de requisitos, igual que la experiencia práctica o el conocimiento
de control de calidad.

El ejemplo demuestra un riesgo de los promedios binarios: agregar, eliminar o
dividir una frase puede modificar sustancialmente el porcentaje sin que cambie
la capacidad real del candidato.

Get Empleos evita este efecto mediante:

- niveles de importancia;
- separación entre obligatorio y deseable;
- requisitos atómicos;
- evidencia textual; y
- pesos adaptados a la estructura del cargo.

---

## 7. Ejemplo real: alternativas que no deben convertirse en obligaciones

En el perfil **Jefe de Producción – Medellín**, la fuente describe experiencia
en cargos relacionados con:

> producción textil, confección, empaque **o** bodega.

La palabra “o” expresa alternativas válidas. Una persona puede demostrar
experiencia relevante desde cualquiera de esas rutas.

La primera extracción de Get Empleos separó la frase en cuatro requisitos
simultáneos. Ese comportamiento podía castigar injustamente a alguien con cinco
años de experiencia sólida en producción textil por no mencionar también
bodega y empaque.

La versión v4 corrige esta interpretación: una lista con “o” o “y/o” se conserva
como un conjunto de alternativas, no como múltiples obligaciones acumulativas.

Este hallazgo también muestra una ventaja del diseño de Get Empleos: los errores
quedan localizados, se pueden reproducir, corregir y versionar sin ocultar el
historial.

---

## 8. Por qué Get Empleos es más fiable a priori

### 8.1 No confunde un porcentaje alto con una certeza alta

Get Empleos separa:

- el nivel de compatibilidad; y
- la confianza en ese resultado.

Un candidato puede tener buen match con baja confianza si el CV es breve. Esto
le dice al reclutador que debe obtener más información antes de decidir.

### 8.2 Cada conclusión tiene evidencia

El reclutador puede conocer:

- qué requisito se evaluó;
- qué parte del CV lo respalda;
- si la coincidencia fue exacta, parcial o semántica;
- qué información falta; y
- qué versión del motor produjo el resultado.

### 8.3 Evita inferencias psicológicas no demostradas

Declararse “honesto” o “responsable” no es equivalente a superar una evaluación
conductual. Get Empleos reserva esas competencias para evidencia laboral o una
evaluación posterior con preguntas y rúbricas estructuradas.

### 8.4 Protege mejor frente a criterios discriminatorios

En Talent Scout se observó la expresión “el candidato ideal es un hombre” en el
perfil de Auxiliar de Bodega y “la candidata ideal es una mujer” en Terminación
de Confección.

Get Empleos detectó la referencia a “personal masculino”, la excluyó del perfil
de matching y generó una advertencia. Género, edad, estado civil, fotografía,
universidad y otros atributos protegidos no forman parte del motor de scoring.

### 8.5 Permite aprender de las decisiones reales

La arquitectura de Get Empleos conserva versiones de perfiles, resultados y
correcciones humanas. Esto permitirá calibrar el sistema con resultados reales:

- candidatos enviados a entrevista;
- candidatos preseleccionados;
- contrataciones;
- falsos negativos detectados por los reclutadores; y
- desempeño inicial, cuando esté disponible.

Talent Scout puede servir como punto de comparación, pero sus porcentajes no
deben utilizarse como la respuesta correcta que Get Empleos deba imitar.

---

## 9. Propuesta de presentación del resultado al reclutador

En lugar de un único número opaco, se recomienda mostrar tres componentes:

### A. Elegibilidad objetiva

Comprueba requisitos como formación obligatoria, licencia, idioma o experiencia
mínima. Los datos desconocidos generan una pregunta, no un descarte automático.

### B. Afinidad demostrada por el CV

Evalúa experiencia relacionada, conocimientos técnicos, herramientas,
responsabilidades y logros con evidencia visible.

### C. Evaluación conductual estructurada

Solo aparece cuando existe una autoevaluación, entrevista o prueba diseñada
para medir comportamientos. Debe usar preguntas ancladas a situaciones y una
rúbrica común para todos los candidatos.

La interfaz puede conservar un indicador general, pero siempre acompañado por:

- confianza del resultado;
- fortalezas demostradas;
- brechas confirmadas; y
- preguntas pendientes para entrevista.

---

## 10. Recomendación para Get Company

Se recomienda avanzar con Get Empleos como sistema principal de perfilamiento,
con el siguiente orden:

1. Activar la versión v4 del motor.
2. Reprocesar los perfiles de cargo y CV creados con extractores anteriores.
3. Revisar con Get Company los requisitos obligatorios y deseables antes de
   publicar cada vacante.
4. Mantener las competencias conductuales fuera del score de CV cuando no exista
   evidencia concreta.
5. Crear una evaluación estructurada independiente para los cargos que realmente
   necesiten medir liderazgo, resiliencia o trabajo bajo presión.
6. Calibrar pesos y bandas con una muestra anonimizada de decisiones reales.

Para una primera calibración se recomienda reunir entre 50 y 100 pares
candidato–oferta con una etiqueta humana mínima:

- descartado antes de entrevista;
- enviado a entrevista;
- finalista;
- contratado; y
- motivo principal de la decisión.

Con esos datos se podrá medir si el sistema ordena correctamente a los mejores
candidatos y si está produciendo falsos descartes, en vez de ajustar el algoritmo
para que se parezca a otro porcentaje no validado.

---

## 11. Alcance de las conclusiones

Este informe no afirma que Talent Scout sea incorrecto en todos los casos ni
que Get Empleos ya esté validado estadísticamente. Para demostrar capacidad
predictiva se necesitan resultados históricos suficientes.

La conclusión “más fiable a priori” se refiere a propiedades verificables del
diseño actual de Get Empleos:

- mejor trazabilidad;
- separación entre desconocido e incumplido;
- protección frente a atributos sensibles;
- reglas reproducibles y versionadas;
- evidencia asociada a cada conclusión; y
- posibilidad de calibración con resultados reales.

Estas características hacen que el sistema sea más defendible para apoyar una
decisión humana, incluso cuando su porcentaje sea menor que el de Talent Scout.

---

## 12. Referencias de buenas prácticas

- [ISO 10667-2:2020 — procedimientos y métodos de evaluación de personas en contextos laborales](https://www.iso.org/obp/ui?_escaped_fragment_=iso:std:iso:10667:-2:ed-2:v1:en)
- [ISO 30405:2023 — directrices para reclutamiento](https://www.iso.org/standard/79488.html)
- [SIOP — principios para la validación y uso de procedimientos de selección](https://www.siop.org/wp-content/uploads/2025/12/UniformSelectionStatement_121525.pdf)
- [SIOP — inteligencia artificial en evaluación y selección de talento](https://siop.org/wp-content/uploads/2024/12/Artificial-Intelligence-in-Talent-Assessment-and-Selection.pdf)
- [Circular Externa 002 de 2024 de la Superintendencia de Industria y Comercio](https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20No.%20002%20del%2021%20de%20agosto%20de%202024.pdf)
- [Ley 2466 de 2025 — disposiciones sobre discriminación laboral en Colombia](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676)

---

## Conclusión para presentar al cliente

> Talent Scout entrega porcentajes más altos porque promedia requisitos
> binarios con inferencias conductuales realizadas desde el CV. Get Empleos
> busca entregar un resultado más útil: reconoce la experiencia demostrada,
> identifica qué falta por comprobar y explica cada conclusión con evidencia.
>
> El caso de Daniel demuestra ambas cosas. El 34% anterior era demasiado bajo y
> fue corregido; el nuevo 65% reconoce sus 5 años y 8 meses de experiencia
> relacionada, pero conserva como pendientes las funciones que el CV no
> documenta. Esa combinación de reconocimiento, prudencia y trazabilidad es la
> base para tomar mejores decisiones de selección.
