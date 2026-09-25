# Ingeniería inversa del sistema de scoring del cliente

Reconstrucción del método de puntuación de la herramienta que Get Company ya usa,
a partir de un caso único: vacante **"Operario(a) Call Center"** (Neiva, Huila)
contra la candidata **Danna Yanary Puentes Medina**, con el reporte que esa
herramienta produjo.

El cliente considera idónea a la candidata. Su sistema le dio **89%**. El nuestro,
en su versión v1, daba **71%**.

> **Base de evidencia: un solo par oferta/candidato.** Todo lo que sigue está
> etiquetado según su solidez: lo que la aritmética confirma, lo que el texto del
> reporte respalda, y lo que es hipótesis compatible con un único dato. No
> conviene tratar lo tercero como lo primero.

---

## 1. Cómo se compone su 89% — **confirmado**

El reporte muestra cuatro casillas:

| Requirements | CV | Self-Assessment | Overall |
|---:|---:|---:|---:|
| 100.0% | 78.0% | N/A | **89.0%** |

La aritmética cierra de forma exacta:

```
(100.0 + 78.0) / 2 = 89.0
```

Son **tres componentes promediados a partes iguales**, y el componente ausente
sale del denominador en lugar de contar como cero. Es exactamente la misma regla
de renormalización que ya aplica nuestro motor con las categorías que la oferta
no exige (§12.2 de nuestra spec). En este punto los dos sistemas coinciden.

El tercer componente, **Self-Assessment**, es un cuestionario que responde el
propio candidato. Aquí salió N/A porque ella no lo llenó. Nosotros no tenemos
equivalente.

---

## 2. Componente "Requirements" = 100% — **confirmado**

Seis requisitos, cada uno con veredicto binario **Met / Not Met** y un párrafo de
justificación. Seis de seis cumplidos → 100%.

Cuatro rasgos del método, todos deducibles del propio reporte:

**a) Evalúan los *requisitos*, no las *funciones*.** La oferta trae diez
"Funciones principales" y siete "Requisitos". Su reporte solo puntúa los
requisitos. Nuestro motor convertía las diez funciones en requisitos evaluables y
promediaba su cobertura — cada función mal cubierta arrastraba la nota.

**b) Consolidan.** Siete viñetas de requisitos se convirtieron en cinco
enunciados, fusionando las relacionadas ("excelente comunicación verbal" +
"orientación al servicio" → un solo requisito). Menos requisitos, cada uno más
grueso. Nosotros atomizábamos: en este caso, **26 requisitos evaluados**.

**c) El veredicto es binario.** No hay crédito parcial. Un requisito cumplido "a
medias" no existe: o cuenta entero o no cuenta.

**d) Hay un requisito añadido a mano por el cliente:** *"vivir en Neiva-Huila"*,
que no está en el documento de la oferta. Lo resolvieron leyendo la dirección del
CV. Es la prueba de que el cliente **espera** que la ubicación puntúe.

---

## 3. Componente "CV" = 78% — **hipótesis**

Seis dimensiones con nombre propio y color, cada una con porcentaje y
justificación:

| Dimensión | Color | Puntaje |
|---|---|---:|
| Creative-Innovative | amarillo | 75% |
| Assertive-Directive | rojo | 75% |
| Altruistic-Creator | azul | 85% |
| Analytical-Autonomous | verde | 85% |
| Ethical-Leader | gris | 70% |
| Resilient-Adaptive | morado | 70% |

El promedio simple da **76,67%**, no 78. Luego están ponderadas. Una ponderación
sencilla que reproduce el número exacto es dar peso doble a las cuatro primeras y
peso simple a las dos últimas:

```
(2·75 + 2·75 + 2·85 + 2·85 + 1·70 + 1·70) / 10 = 780 / 10 = 78.0
```

Encaja con el texto del propio reporte, que dice de la dimensión morada que "se
considera menos relevante" para este cargo. Es decir: **cada vacante define qué
dimensiones importan**, y la nota del CV es su promedio ponderado.

Con un solo caso no se puede recuperar el esquema exacto de pesos —cualquier
múltiplo de {2,2,2,2,1,1} da lo mismo—, pero sí se confirma que hay ponderación
por relevancia y no promedio plano.

### Dos rasgos que sí son inequívocos en el texto

**Es un ajuste de doble sentido, no una escala de "más es mejor".** Sobrepasar lo
que el cargo necesita también baja la nota:

> *Ethical-Leader 70%: "...su perfil enfatiza liderazgo, proactividad e
> innovación, lo que puede indicar un grado de protagonismo mayor al deseado para
> un rol operativo subordinado."*

> *Analytical-Autonomous 85%: "...se alinea con el requisito de baja necesidad de
> análisis profundo o autonomía técnica. Sin embargo, el candidato también
> demuestra educación avanzada (8º semestre de Contaduría Pública) [...], lo que
> puede indicar una mayor capacidad de análisis de la estrictamente requerida."*

Nuestro motor hace lo contrario por diseño explícito: superar el mínimo cuenta
como cumplirlo, nunca penaliza.

**El rango está comprimido.** Ninguna dimensión baja de 70, ni siquiera las que la
justificación describe como flojas o poco respaldadas. El componente "CV"
difícilmente puede caer por debajo de ~70 para cualquier persona con un CV
completo.

---

## 4. Por qué su número es más alto — y por qué no es comparable

Su escala útil va aproximadamente **de 65 a 100**. La nuestra va de 0 a 100. Un
89 suyo y un 89 nuestro no significan lo mismo, y **perseguir su número
inflando el nuestro sería el error**: destruiría la capacidad de ordenar, que es
para lo que sirve el puntaje.

Lo que sí había que corregir son los **falsos negativos**: casos donde la
candidata demostrablemente cumple y nuestro motor decía "no cumple". De eso había
mucho, y no por los pesos, sino por el método de comparación.

---

## 5. Los fallos reales que destapó el caso

Ejecutando la vacante y el CV contra el motor v1 (reproducible en
`tests/calibracion/`):

| Requisito de la oferta | Qué dice el CV | v1 |
|---|---|---:|
| Manejo de herramientas ofimáticas | Word, Excel y PowerPoint, nivel avanzado | **0,0** |
| Experiencia en cargos similares a "Call Center" | "Agente de Servicio al Cliente" | **0,0** |
| Realizar llamadas telefónicas a clientes | "Efectuar y atender llamadas, escuchar y orientar al Cliente" | 0,40 |
| Cumplir metas comerciales | "estrategias de cumplimiento", "alto nivel en ventas" | **0,0** |
| Persuadir, negociar y cerrar ventas | "cumplimiento y venta de productos", "alto nivel en ventas" | **0,0** |
| Organización y seguimiento | "seguimiento permanente", "organización de información" | **0,0** |

Cuatro causas, todas de método y ninguna de pesos:

1. **Comparaba cadenas de texto, no competencias.** Sin morfología del español,
   "cliente" y "clientes" eran palabras distintas. Sin taxonomía de oficio,
   "Excel" no tenía nada que ver con "herramientas ofimáticas" y un agente de
   servicio al cliente no tenía nada que ver con un call center.
2. **Usaba la similitud como nota.** Un candidato que cubre un requisito a la
   perfección rara vez pasa de 0,6 de solapamiento léxico, porque lo describe con
   sus palabras. El techo real de la categoría era ~60% **para el candidato
   ideal**.
3. **Las competencias blandas no podían leer la experiencia laboral.** El código
   contradecía su propia especificación: §17 exige evidencia laboral concreta, y
   la función solo miraba la lista declarada de habilidades blandas. Premiaba a
   quien escribe "liderazgo" en una lista y no veía a quien describe haber
   liderado.
4. **Pesos fijos de perfil técnico.** Un requisito ofimático decidía el 33% de la
   nota; trece competencias comportamentales, el 10%.

---

## 6. Qué se adoptó de su enfoque y qué no

**Adoptado** (v2, ver `docs/ALGORITMO_DE_MATCHING.md`):

- La ubicación como criterio puntuable en cargos presenciales.
- Reconocer competencia por concepto y no por coincidencia literal.
- Que las competencias comportamentales pesen según lo que el cargo realmente
  pide, no según una tabla fija.
- Que "cumplir" no exija que el CV esté redactado con las palabras de la oferta.

**Descartado a propósito:**

- **Penalizar por exceso.** Bajar la nota de alguien por estar "más cualificado
  de lo deseado para un rol subordinado" es una decisión que debe tomar una
  persona y quedar por escrito, no un descuento silencioso dentro de un número.
- **El piso de 70.** Comprime la escala y elimina la capacidad de ordenar.
- **Los seis rasgos de personalidad.** Son inferencias psicométricas sacadas de un
  CV, sin instrumento validado detrás. Nuestro equivalente son las competencias
  transferibles, que exigen citar la frase del CV que las respalda.

---

## 7. El resultado

Mismo caso, mismo par oferta/CV:

| | v1 | v2 |
|---|---:|---:|
| Candidata idónea | 71 (parcial) | **84 (alta)** |
| Asesor de tienda, Neiva, 1 año | — | 43 |
| Operario de planta, Neiva | — | 27 |
| Desarrollador, Bogotá | — | 21 |

La candidata entra en banda alta y la separación entre perfiles se mantiene
amplia. La diferencia que queda contra su 89 es el componente inferencial de la
sección 8: no es aritmética, es criterio.

---

## 8. Lo que su sistema hace y el nuestro estructuralmente no puede

La oferta pide "habilidad para persuadir, negociar y cerrar ventas". Su reporte lo
marca **Met** con este razonamiento:

> *"El candidato tiene experiencia como consultor integral de servicio al cliente
> y en ventas, donde se menciona el cumplimiento y venta de productos [...], lo
> que **implica** habilidades de persuasión y negociación."*

Nuestro motor lo marca "no cumple". Y hace bien dentro de sus reglas: en el CV no
hay una sola línea que respalde esa habilidad. El salto de "vendió productos
durante dos años" a "sabe negociar" es una **inferencia**, y nuestro motor tiene
prohibido inferir.

Ahí está la diferencia principal, y no es de calidad de código: **su puntaje lo
emite un modelo de lenguaje razonando sobre el CV completo; el nuestro lo emite
una fórmula.** Cada opción tiene su precio:

|  | Fórmula (nosotros) | LLM (ellos) |
|---|---|---|
| Mismo CV dos veces | Mismo resultado siempre | Puede variar |
| CV con instrucciones maliciosas | No puede alterar el puntaje | Superficie de ataque real |
| Explicar el puntaje | Aritmética auditable | La explicación la redacta el mismo modelo que puntúa |
| Reconocer lo evidente no escrito | **No puede** | Sí |

### Propuesta: adjudicación acotada

Hay una vía intermedia que cierra el hueco sin renunciar a las tres primeras
filas. **El modelo no puntúa: solo señala evidencia.**

1. El motor determinístico corre primero, igual que hoy.
2. Los requisitos que quedan en "no cumple" o "sin evidencia" —solo esos— se
   envían al modelo con el texto del CV, pidiendo un veredicto acotado
   (`cumple` / `parcial` / `no cumple`) **más una cita textual del CV**.
3. El motor **verifica que la cita exista literalmente** en el documento. Si no
   existe, se descarta el veredicto.
4. La aritmética la sigue haciendo el motor, con los mismos pesos y la misma
   configuración versionada.
5. El resultado se marca en la interfaz como "reconocido por inferencia" con su
   cita, para que el reclutador vea de dónde salió.

Así el modelo aporta comprensión pero nunca escribe un número; el puntaje sigue
siendo reproducible dado un conjunto de adjudicaciones; y un CV con instrucciones
maliciosas sigue sin poder inflar nada, porque lo único que puede hacer el modelo
es apuntar a texto que el motor comprueba.

**Es una decisión de producto, no técnica**, y tiene costo por CV. Queda
propuesta, no implementada.

---

## 9. Segundo caso: Auxiliar de Bodega vs. Daniel Hidalgo (2026-09-24)

Este segundo caso permite separar con más certeza qué parte de la diferencia es
un fallo nuestro y qué parte es una elección metodológica de Talent Scout.

### Resultado observado en Talent Scout

| Momento | Requisitos | CV | Total |
|---|---:|---:|---:|
| Captura entregada por el cliente | 83% | 58% | 71% |
| Revisión directa del 24-09-2026 | 83% | 55% | 69% |

El total vuelve a ser el promedio simple de los componentes disponibles. La
variación de 58 a 55 en el mismo CV demuestra que su componente inferencial no
es estable o fue recalculado con otra versión sin conservarla a la vista.

Talent Scout consolidó la oferta en seis requisitos. `83%` equivale exactamente
a cinco de seis cumplidos. Su componente CV no evalúa el contenido ocupacional:
estima `Ethical-Leader`, `Altruistic-Creator`, `Assertive-Directive`,
`Analytical-Autonomous`, `Resilient-Adaptive` y `Creative-Innovative` a partir
del currículum. No se encontró evidencia visible de que esas seis escalas sean un
instrumento psicométrico validado.

### Diagnóstico del 34% de GetEmpleos v2

El perfil estructurado y el detalle persistido confirmaron tres fallos:

1. El CV dice literalmente `TIEMPO LABORADO: 5 años y 8 meses` como Auxiliar
   logístico. El extractor v1 dejó los años totales en `null` porque solo admitía
   fechas de inicio y fin.
2. Al comparar cargos, `Auxiliar bachiller` y `Auxiliar logístico` empataban por
   la palabra "auxiliar". El motor conservaba el primero y daba 0,5, aunque el
   segundo es el oficio pertinente.
3. La oferta trae nueve funciones. Como el CV enumera cargos pero no describe
   tareas, el motor convirtió esa falta de detalle en nueve incumplimientos. Eso
   contradice la regla central `sin evidencia != no cumple`.

El 22% de "Requisitos" era el promedio de 15 renglones, incluyendo esas nueve
funciones. Talent Scout promediaba seis criterios consolidados. Los porcentajes
no estaban midiendo la misma unidad.

### Corrección v3

- El extractor conserva `duration_months` cuando el CV declara una duración.
- Los cargos logísticos equivalentes se resuelven por taxonomía curada.
- Las funciones sin evidencia de tareas quedan `unknown` y bajan la confianza;
  no bajan artificialmente el match.
- La cobertura visible de requisitos excluye `unknown` del denominador y
  pondera `must_have` por encima de `required`.
- Los prompts exigen habilidades atómicas y prohíben repetir un título de cargo
  como si fuera una habilidad.

Con el fixture reproducible, v3 obtiene **65/100**, cobertura de requisitos
evaluables **69%** y banda **Datos insuficientes** por la escasez de funciones
descritas. Es una lectura más favorable que 34 sin afirmar que el candidato sabe
empacar, alistar o controlar inventarios cuando su CV no lo documenta.

### Estándares de referencia

- [ISO 10667-2:2020](https://www.iso.org/obp/ui#iso:std:iso:10667:-2:ed-2:v1:en)
  incluye expresamente CV parsing, screening algorítmico e IA y exige enfoques
  basados en evidencia, validez, confiabilidad, equidad y estandarización.
- [SIOP](https://www.siop.org/wp-content/uploads/2025/12/UniformSelectionStatement_121525.pdf)
  recomienda análisis del cargo, validación respecto al desempeño, monitoreo de
  impacto adverso y documentación de las decisiones de diseño.
- La [Circular Externa 002 de 2024 de la SIC](https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20No.%20002%20del%2021%20de%20agosto%20de%202024.pdf)
  exige gestión de riesgos, responsabilidad demostrada, calidad de datos y una
  evaluación de impacto de privacidad cuando el tratamiento con IA sea de alto
  riesgo.
- La [Ley 2466 de 2025](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676)
  refuerza la prohibición de discriminación laboral por rasgos personales no
  relacionados con el ejercicio del cargo.

Por esos criterios, inferir personalidad desde un CV y puntuarla sin prueba de
validez es la parte menos defendible de Talent Scout. El principio correcto no
es "usar o no IA", sino medir atributos relacionados con el trabajo, conservar
evidencia, validar que predicen decisiones humanas/desempeño y vigilar impacto
adverso.

## 10. Ampliación de la muestra: cómo parece calcular Talent Scout (2026-09-24)

Se inspeccionaron los perfiles generados y las tablas de candidatos de tres
cargos que comparten fuente con Get Empleos:

- Auxiliar de Bodega: 6 requisitos, 32 candidatos.
- Auxiliar de Terminación de Confección: 7 requisitos, 20 candidatos.
- Jefe de Producción: 6 requisitos, 9 candidatos.

La muestra visible suma 61 evaluaciones. No permite conocer su código interno,
pero sí reconstruir con bastante seguridad la aritmética mostrada.

### 10.1 Puntuación de requisitos

Los requisitos parecen tener el mismo peso y evaluarse de forma binaria:

- con 6 requisitos aparecen 100, 83, 67, 50 y 33, que corresponden a fracciones
  `6/6`, `5/6`, `4/6`, `3/6` y `2/6`;
- con 7 requisitos aparecen 71, 57 y 43, equivalentes a `5/7`, `4/7` y `3/7`.

Esto explica parte de sus porcentajes altos, pero también vuelve la métrica muy
sensible a cómo se redacta el perfil. En Terminación de Confección se añadió
manualmente `Hablar Frances`: ese solo requisito pasa a representar 14,3% de la
columna, aunque no guarda proporción con educación, experiencia o dominio del
oficio. Un requisito compuesto también vale exactamente lo mismo que uno
atómico.

### 10.2 Puntuación de CV

Todos los cargos reutilizan seis dimensiones fijas:

1. `Ethical-Leader`
2. `Altruistic-Creator`
3. `Assertive-Directive`
4. `Analytical-Autonomous`
5. `Resilient-Adaptive`
6. `Creative-Innovative`

Lo que cambia por cargo es su deseabilidad o peso. Para bodega prima
`Ethical-Leader`; para terminación, `Altruistic-Creator`; para jefatura,
`Assertive-Directive`. Esta separación entre criterios del oficio y criterios
conductuales es una idea aprovechable, pero la fuente de evidencia no lo es.

Las explicaciones visibles otorgan crédito por frases como `responsable`,
`honestidad`, `trabajo en equipo`, `aprendo rápido` o `buena actitud`. También
usan nivel educativo, duración de pasantías o el nombre del cargo para reducir
dimensiones de personalidad. Esas variables pueden describir un CV, pero no
constituyen por sí mismas una medición validada de altruismo, ética, resiliencia
o liderazgo. Además mezclan constructos: educación y experiencia terminan
influyendo tanto en requisitos como en personalidad.

### 10.3 Total

Cuando no existe autoevaluación, el total mostrado es el promedio entre
requisitos y CV:

```text
total = redondear((requisitos + cv) / 2)
```

Ejemplos visibles: `100 + 68 → 84`, `71 + 64 → 68` y `33 + 21 → 27`.
Algunos empates aparentes redondean distinto, lo que indica que el total usa los
decimales internos de `CV`, no el entero presentado en la tabla.

Este diseño da 50% de la decisión a seis inferencias conductuales aunque el
candidato no haya completado una prueba estructurada. También crea un piso
artificial: las autodescripciones genéricas suelen recibir crédito parcial y
elevan el promedio incluso con poca evidencia del oficio.

### 10.4 Ajuste incorporado en Get Empleos v4

- Los requisitos técnicos, experiencia y formación permanecen en el match de
  CV con evidencia trazable.
- Una competencia conductual ausente queda `unknown`, aunque el CV sí tenga
  otras experiencias; no se convierte en cero.
- Una competencia conductual solo entra al denominador cuando hay una acción o
  resultado laboral concreto que la sustente.
- Los prompts rechazan adjetivos genéricos como evidencia conductual.
- Las alternativas redactadas con `o` / `y/o` se conservan como alternativas y
  no se multiplican en varios `must_have` simultáneos.

La evolución recomendada es mostrar tres resultados separados —elegibilidad
objetiva, afinidad del CV y evaluación estructurada— y combinarlos únicamente
cuando la tercera fuente exista. La autoevaluación o entrevista puede cubrir
conductas mediante preguntas ancladas y rúbricas observables; no debe
retroproyectarse desde el estilo del CV.
