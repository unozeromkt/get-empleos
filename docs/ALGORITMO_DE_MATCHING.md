# Cómo funciona el algoritmo de evaluación de candidatos

Este documento explica, en texto plano, el criterio y el flujo de cálculo del motor
de matching de GetEmpleos. Está pensado como base para diagramar el proceso con
otra herramienta.

Referencia técnica en el repositorio: `lib/matching/` (código) y
`docs/AI_SCREENING_IMPLEMENTATION_PLAN.md` (decisiones de diseño).

---

## 1. Principio general

El sistema separa dos trabajos que casi nunca se separan en herramientas similares:

1. **Extracción** (hace la IA): lee la oferta y el CV, y los convierte en datos
   estructurados — requisitos por un lado, experiencia y habilidades por otro.
2. **Cálculo del score** (NO lo hace la IA): un motor de reglas fijas, sin
   inteligencia artificial de por medio, compara ambos conjuntos de datos y
   produce el puntaje.

La IA nunca decide un número. Solo lee documentos. Esto tiene dos consecuencias
importantes:

- El mismo par oferta-candidato siempre da el mismo resultado (es determinístico).
- Un documento con contenido malicioso o inusual no puede alterar la puntuación,
  porque quien puntúa es una fórmula matemática, no un modelo de lenguaje.

---

## 2. El flujo completo, paso a paso

```
1. Se sube el documento de la oferta (Word/PDF)
2. La IA extrae los requisitos → "Perfil de la Oferta"
   (título, habilidades requeridas, experiencia mínima, educación,
    idiomas, certificaciones, responsabilidades del cargo)

3. Se sube el CV del candidato (por postulación o carga manual del admin)
4. La IA extrae su información → "Perfil del Candidato"
   (experiencia laboral, formación, habilidades, idiomas, certificaciones)

5. El motor de cálculo compara ambos perfiles, categoría por categoría

6. Se produce el resultado:
   - Un puntaje de 0 a 100
   - Una banda de color (alta / parcial / baja / datos insuficientes)
   - Un nivel de confianza, independiente del puntaje
   - El detalle de cada requisito, con la evidencia encontrada en el CV
   - Las brechas críticas, si las hay
```

---

## 3. Las 7 categorías que se evalúan

Cada requisito de la oferta cae en una de estas categorías. Cada categoría tiene
un peso dentro del puntaje total:

| Categoría | Peso base | Qué mide |
|---|---:|---|
| Habilidades técnicas | 33% | Herramientas, tecnologías, conocimientos específicos marcados como obligatorios o requeridos |
| Experiencia | 29% | Años de experiencia, similitud de cargos anteriores, cobertura de responsabilidades |
| Educación y certificaciones | 9% | Nivel de formación, área de estudio, certificaciones |
| Habilidades transferibles | 10% | Competencias blandas, con evidencia concreta (declarada o demostrada en un cargo) |
| Idiomas | 4% | Idiomas requeridos y su nivel |
| Requisitos deseables | 10% | Las habilidades marcadas como "plus" o "deseable", no obligatorias |
| Ubicación | 5% | Ciudad del cargo frente a ciudad del candidato, solo en cargos presenciales o híbridos |

**Estos pesos son un punto de partida razonable, todavía sin calibrar con datos
reales.** Son ajustables: se pueden cambiar globalmente, por empresa o incluso por
oferta específica, sin tocar el motor.

### Regla importante: categorías que no aplican

Si una oferta no menciona nada de una categoría (por ejemplo, no exige ningún
idioma), esa categoría **no se calcula como 0**. Simplemente se saca del cálculo y
su peso se reparte entre las categorías que sí aplican. Así, una oferta sin
requisitos de idioma no penaliza a nadie por no tener idiomas.

### Pesos adaptativos: el peso lo pone la oferta, no una tabla fija

Los pesos base de arriba describen una vacante de perfil técnico. La mayoría de
lo que publica Get Company no lo es.

Tomemos una oferta real de call center. Trae **un** requisito técnico ("manejo
básico de herramientas ofimáticas") y **trece** competencias comportamentales
(comunicación asertiva, orientación al logro, tolerancia a la presión...). Con
pesos fijos, ese único requisito ofimático decide un tercio de la nota, y las
trece competencias juntas deciden una décima parte. El puntaje deja de medir al
candidato y pasa a medir en qué casilla cayó cada requisito.

Por eso el motor reajusta los pesos según **cuánta exigencia real deposita la
oferta en cada categoría**, contando cada requisito por su importancia
(indispensable pesa el triple que deseable). El resultado es una mezcla entre lo
configurado y la forma real de la oferta, graduable con un solo parámetro:

- `0` → manda la tabla de pesos, como antes.
- `0.5` → mitad y mitad. **Es el valor actual.**
- `1` → mandan exclusivamente los requisitos de la oferta.

Para evitar que una oferta simplemente verbosa se lleve el peso, las funciones
del cargo dejan de sumar a partir de la sexta.

## 4. Cómo se compara cada requisito individual

Dentro de cada categoría, cada requisito de la oferta se compara contra las
habilidades y la experiencia del candidato, en este orden de prioridad:

1. **Coincidencia exacta** — el texto es idéntico ("Excel" = "Excel")
2. **Sinónimo conocido** — el sistema reconoce equivalencias del oficio
   ("telemercadeo" = "call center", "atención al cliente" = "servicio al cliente")
3. **Taxonomía** — quien declara Excel cumple un requisito de "herramientas
   ofimáticas"; un "Agente de Servicio al Cliente" cubre un cargo de "Call Center"
4. **Coincidencia parcial** — hay contenido en común por encima de un umbral
5. **Sin coincidencia** — no se encuentra nada parecido

### Se comparan competencias, no cadenas de texto

Tres cosas que el motor hace y que un simple "¿aparece esta palabra?" no haría:

- **Morfología del español.** "Clientes" cubre "cliente", "negociación" cubre
  "negociar", "llamadas" cubre "llamada". Sin esto, una oferta redactada con
  infinitivos ("Realizar llamadas a clientes") y un CV redactado con sustantivos
  ("atención de llamadas al cliente") no coincidían en casi nada.
- **Peso por informatividad.** Las ofertas colombianas comparten un andamiaje
  verbal fijo —"realizar", "garantizar", "de manera oportuna"— que aparece igual
  en la vacante de call center y en la de bodega, así que no distingue a nadie.
  Esas palabras cuentan un tercio que las que sí discriminan.
- **La evidencia se lee por cargo, no por renglón.** Una función como "Gestionar
  bases de datos y mantener actualizada la información de los clientes" se
  sustenta en un CV real con dos o tres frases distintas del mismo puesto.
  Ninguna la cubre por sí sola; juntas la describen exactamente. Se agrupa por
  cargo y no por CV completo: si no, cualquier hoja de vida larga se convertiría
  en un comodín que cubre cualquier requisito.

### Parecerse no es cumplir

El motor **no usa la similitud textual como nota**. Son dos cosas distintas:

> La **similitud** dice cuánto se parecen dos textos.
> El **cumplimiento** dice si la persona hace o no hace lo que pide el requisito.

Un candidato que cubre un requisito a la perfección rara vez pasa de 0,6 de
similitud, porque describe su trabajo con sus propias palabras y añade contexto
propio. Usar ese 0,6 como nota dejaba el techo de la categoría en torno al 60%
**para el candidato ideal**: no medía al candidato, medía la distancia entre dos
estilos de redacción. Por eso la similitud pasa por una curva de conversión: a
partir de cierto punto el requisito se da por cubierto, por debajo de otro se
considera ruido, y en medio se reparte de forma proporcional.

Cada requisito queda marcado con uno de cuatro estados:

| Estado | Significado |
|---|---|
| **Cumple** | Coincidencia exacta, por sinónimo, por taxonomía o evidencia clara en un cargo |
| **Cumple parcialmente** | Hay relación, pero no es una coincidencia completa |
| **Sin evidencia** | El CV no aporta absolutamente nada con qué comparar — no se puede afirmar nada |
| **No cumple** | El candidato describió su trayectoria, y nada en ella corresponde a este requisito |

### La distinción más importante del sistema: "sin evidencia" ≠ "no cumple"

Que un CV no mencione algo **no demuestra que el candidato no lo sepa hacer**. Es
solo un vacío de información. Por eso el sistema separa:

- **"No cumple"**: el candidato listó varias habilidades, y ninguna se parece a lo
  que pide la oferta. Aquí sí hay una carencia real.
- **"Sin evidencia"**: el CV es tan escueto que no aportó ninguna habilidad para
  comparar. Aquí no se puede juzgar — no es lo mismo que decir que le falta.

Esta distinción es la que evita que el sistema castigue a alguien por tener un CV
mal redactado en lugar de por carecer de la habilidad de verdad.

---

## 5. Cómo se evalúa la experiencia (categoría con más matices)

La experiencia NO se mide solo contando años. Se combinan cuatro señales, cada
una con su propio peso dentro de la categoría:

| Señal | Peso interno |
|---:|---|
| Años de experiencia relevantes | 35% |
| Similitud del cargo anterior con el cargo ofertado | 25% |
| Cobertura de las responsabilidades pedidas | 30% |
| Experiencia en el mismo sector/industria | 10% |

Detalles relevantes:

- **Superar los años pedidos no penaliza.** Si piden 3 años y el candidato tiene
  12, cuenta como cumplido al 100%, no como "sobrecalificado" en sentido negativo.
- **El cargo no tiene que llamarse igual.** Se compara el contenido de las
  responsabilidades, no el título. Alguien que fue "Supervisor de Almacén" puede
  cubrir perfectamente un cargo de "Coordinador de Logística" si las tareas que
  hizo coinciden.
- **El cargo se compara por concepto, no por nombre.** "Agente de Servicio al
  Cliente" y "Operario de Call Center" no comparten una sola palabra; el sistema
  reconoce que son el mismo oficio. Antes esto puntuaba cero.
- **No se usa la antigüedad de la experiencia como criterio.** El sistema
  deliberadamente no penaliza experiencia "vieja", porque eso generaría sesgo por
  edad.

---

## 6. Requisitos indispensables vs. deseables

Cada requisito de la oferta trae una etiqueta de importancia:

- **Indispensable** (peso 3x dentro de su categoría)
- **Requerido** (peso 2x)
- **Deseable** (peso 1x)

Un requisito indispensable pesa más en el cálculo del porcentaje de esa categoría,
pero **nunca descarta al candidato automáticamente**. Ver la siguiente sección.

---

## 7. Brechas críticas

Cuando un requisito marcado como **indispensable** queda en estado **"No cumple"**
(con evidencia real de que falta, no solo ausencia de información), se genera una
**brecha crítica**.

Reglas sobre las brechas críticas:

- Se muestran de forma visible junto al puntaje del candidato.
- **Nunca eliminan ni ocultan al candidato de la lista.** La decisión final la
  toma siempre una persona.
- Un requisito indispensable en estado "Sin evidencia" (no "No cumple") **no**
  genera brecha crítica — de nuevo, la falta de información no se trata como una
  carencia confirmada.

---

## 8. El puntaje final: cómo se combinan las categorías

```
Puntaje final =
    Σ (puntaje de cada categoría aplicable × su peso)
    ────────────────────────────────────────────────
    Σ (peso de las categorías aplicables)
```

En palabras simples: se promedian las categorías que sí aplican a la oferta,
ponderadas por su peso relativo. Las categorías que no aplican no cuentan ni en el
numerador ni en el denominador — no bajan el promedio.

---

## 9. Confianza del resultado: un número aparte del puntaje

Además del puntaje (0-100%), cada evaluación tiene un **nivel de confianza**
(0-100%), que es una medida completamente distinta:

> El **puntaje** dice qué tan bien encaja el candidato.
> La **confianza** dice qué tan fiable es ese puntaje, según cuánta información
> real había disponible para calcularlo.

Es perfectamente posible (y ocurre) que un candidato tenga **puntaje alto con
confianza baja**: cumple todo lo poco que se pudo verificar, pero el CV era tan
corto que no hay mucho con qué respaldar la conclusión.

La confianza se calcula combinando tres factores:

| Factor | Peso |
|---|---:|
| Proporción de requisitos con información disponible (no "sin evidencia") | 45% |
| Proporción de requisitos con una cita textual del CV como respaldo | 25% |
| Confianza de la propia extracción de la IA al leer el documento | 30% |

Si el CV es extremadamente escueto (muy pocas habilidades, sin experiencia
registrada, sin educación), la confianza queda limitada a un máximo de 40%, sin
importar qué tan bien haya salido el puntaje.

---

## 10. Las 4 bandas de resultado (código de color)

| Banda | Condición | Significado |
|---|---|---|
| 🟢 **Alta compatibilidad** | Puntaje ≥ 80% y confianza suficiente | El candidato cumple la gran mayoría de lo evaluable |
| 🟡 **Compatibilidad parcial** | Puntaje entre 60% y 79% | Cumple una parte importante, vale la pena revisar |
| 🔴 **Baja compatibilidad** | Puntaje menor a 60% | Encaja poco con lo que pide la oferta |
| ⚪ **Datos insuficientes** | Confianza por debajo del 65%, o CV muy escueto | No hay información suficiente para confiar en el número, sin importar cuál sea |

La banda gris es intencional y va **por encima** de las otras tres: si la
confianza es baja, no importa qué tan alto sea el puntaje — el sistema prioriza
avisar que el dato no es confiable antes que mostrar un número que parezca
definitivo sin serlo.

---

## 11. Qué información NUNCA se usa para calcular el puntaje

Por diseño, el motor excluye explícitamente estos datos, aunque estén disponibles
en el perfil del candidato:

- Nombre, foto, fecha de nacimiento, edad
- Género, estado civil, embarazo
- Nacionalidad, origen étnico, raza
- Religión, afiliación política
- Discapacidad
- Dirección de residencia (la **ciudad** sí se usa, y solo cuando la vacante es
  presencial o híbrida: para un cargo en Neiva, vivir en Neiva es un requisito
  del puesto, no un rasgo de la persona. Nunca descarta a nadie por sí solo:
  genera una brecha crítica visible y decide un humano, porque la gente se
  traslada)
- Institución educativa (universidad/colegio específico) — solo cuenta el
  **nivel** de formación y el **área** de estudio, nunca el prestigio de la
  institución
- Correo y teléfono — se usan para contactar al candidato, nunca para puntuarlo

Esta exclusión está verificada automáticamente: si alguno de estos campos llegara
a colarse en el cálculo, las pruebas automatizadas del sistema fallan.

---

## 12. Qué NO hace el sistema (a propósito)

- **No infiere rasgos de personalidad** a partir del CV (liderazgo, creatividad,
  ética, etc.) sin evidencia concreta de trabajo. Las habilidades blandas solo se
  reconocen si hay una situación laboral específica que las respalde.
- **No rechaza candidatos automáticamente.** El sistema prioriza, no descarta. Toda
  decisión final de avanzar, descartar o contratar la toma una persona.
- **No usa la antigüedad de la experiencia como filtro.**
- **No compara certificaciones de idioma de forma numérica estricta** (por ejemplo,
  no asume que "intermedio" equivale exactamente a B1) — cuando hay ambigüedad,
  se marca para revisión humana en vez de adivinar.

---

## 13. Ejemplo resumido de principio a fin

```
Oferta: "Analista de Logística"
  Requisitos: Excel (indispensable), SAP (requerido), 3 años de experiencia,
              Inglés B1 (deseable)

Candidato: sube su CV
  El CV menciona: "Excel avanzado", "manejo de inventarios", 5 años de experiencia,
                   no menciona SAP ni idiomas

Resultado:
  - Excel → coincidencia parcial (el texto no es idéntico, pero se reconoce)
  - SAP → "No cumple" (el candidato sí listó otras habilidades, pero no esta)
         → como SAP es "requerido" y no "indispensable", NO genera brecha crítica
  - Experiencia → cumple 100% (5 años supera los 3 requeridos)
  - Inglés → "Sin evidencia" (el CV no menciona idiomas en absoluto)

  Puntaje aproximado: se promedian las categorías aplicables según sus pesos
  Banda: depende de si el puntaje supera 80% (alta) o 60% (parcial)
  Confianza: media-alta, porque sí hay bastante información en el CV
  Brechas críticas: ninguna (nada indispensable quedó incumplido con evidencia)
```

---

## 14. Trazabilidad

Cada evaluación queda registrada con:

- La versión exacta del perfil de la oferta usada
- La versión exacta del perfil del candidato usada
- La versión de la configuración de pesos y bandas
- Fecha y hora del cálculo

Si se cambia un requisito de la oferta o el candidato actualiza su CV, el sistema
recalcula — pero **nunca sobrescribe silenciosamente un resultado anterior**: el
resultado viejo queda guardado con su propia versión, para poder explicar una
decisión tomada en el pasado incluso meses después.

---

## 15. Estado de calibración

Los umbrales de coincidencia y los pesos de cada categoría son un punto de
partida basado en criterio, **todavía no ajustado con datos reales de
contrataciones**. La recomendación sigue siendo usar el sistema, acumular casos
reales y calibrar estos números comparándolos contra decisiones humanas.

Lo que sí existe ya es un **caso de referencia**, en `tests/calibracion/`: la
vacante "Operario(a) Call Center" (Neiva) contra una candidata que el cliente
considera idónea, más tres contra-casos que deben quedarse fuera. Fija las dos
mitades del comportamiento esperado:

| Perfil | Puntaje | Banda |
|---|---:|---|
| Candidata idónea (agente de servicio al cliente, Neiva) | 84 | Alta |
| Asesor comercial de tienda, Neiva, 1 año | 43 | Baja |
| Operario de producción, Neiva, sin trato con cliente | 27 | Baja |
| Desarrollador de software, Bogotá | 21 | Baja |

Que la primera suba importa tanto como que las otras tres no suban con ella: un
motor generoso con todo el mundo no ordena a nadie. Al añadir casos nuevos,
añadir siempre las dos clases.

---

## 16. Qué queda fuera del alcance de este motor

El motor compara **lo que el CV dice** contra **lo que la oferta pide**. Lo que
no puede hacer es **inferir**.

Un ejemplo del caso de referencia. La oferta pide "habilidad para persuadir,
negociar y cerrar ventas". La candidata no usa ninguna de esas tres palabras en
su CV, pero fue consultora comercial en Claro y en Apple "con alto nivel en
ventas". Una persona concluye de inmediato que sabe negociar. El motor, no: no
hay ninguna cadena de texto que lo sustente, y **inventarlo sería exactamente lo
que el sistema promete no hacer**.

Ese salto —de "vendió productos durante dos años" a "sabe negociar"— solo lo da
un modelo de lenguaje razonando sobre el CV completo. Es la diferencia principal
con las herramientas del mercado que puntúan más alto: no tienen mejor
aritmética, tienen un LLM emitiendo el juicio.

Adoptarlo aquí es una decisión de producto pendiente, porque tiene un costo
concreto: hoy el puntaje es determinístico y un CV con instrucciones maliciosas
no puede alterarlo (§1). La vía que conserva esa garantía es acotada: que el
modelo **solo pueda señalar evidencia** —"este requisito lo respalda esta frase
literal del CV"—, que el motor **verifique que la frase existe** en el documento,
y que la aritmética siga siendo la de este documento. El modelo aporta
comprensión; nunca escribe un número.
