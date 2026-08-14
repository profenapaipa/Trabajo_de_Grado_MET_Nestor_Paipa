# Acta de decisiones — Sesión de revisión de decisiones metodológicas

*Documento para diligenciar. Cada pregunta viene desarrollada con su contexto y la evidencia ya encontrada en la tesis/código, para que la decisión se tome con el contexto completo a la vista. Ninguna casilla de "Decisión" debe llenarse por inferencia — solo con lo efectivamente resuelto en esta sesión.*

**Fecha:** [PENDIENTE]
**Asistentes:** [PENDIENTE]
**Documentos de referencia:** `INFORME_AVANCE_REUNION_TESIS.md`, `CHECKPOINT_REUNION_DIRECTOR_01.md`, presentación de la reunión.

---

## 1. Diseño de investigación

**Pregunta:** ¿la validación debe estructurarse como comparación sesión sin cubos vs. sesión con cubos, como línea base + intervención, como una única condición exploratoria, u otra estructura?

**Contexto y evidencia encontrada:**
El Capítulo 3 de `main.tex` ("Interpretación trayectorias juego", anterior a la Metodología) menciona explícitamente, tres veces y en dos subsecciones distintas, una comparación entre dos sesiones por participante:
- *"La comparación de los valores de $B_e$ entre la sesión sin mediación y la sesión con activación de los cubos inteligentes permitirá explorar si la herramienta con agentividad reduce la tasa de bucles involuntarios."*
- *"Los patrones de ramificación diferenciales entre la sesión sin cubos y la sesión con cubos inteligentes, correlacionados con los mapas de potencia alfa relativa (Alpha TRP) obtenidos con EEG, constituyen la evidencia integrada central del análisis de resultados de esta tesis."*
- La guía de procesamiento EEG en MATLAB ya opera con archivos `Sesión 1.txt` / `Sesión 2.txt` como flujo de trabajo esperado.

Es decir: el diseño de "dos sesiones comparadas" ya está asumido en la forma en que se calculan y se piensan las métricas de resultados (buclicidad, ramificación, Alpha TRP) — pero **nunca se declaró como tal en la sección de Metodología/Procedimiento**, y no está atado por nombre a ningún guion.

**Decisión tomada:**
[PENDIENTE]

---

## 2. Relación entre los dos guiones

**Pregunta:** ¿el guion experimental TEA nivel 1 (verbal/gestual) y el guión técnico de cubos son un protocolo integrado, dos condiciones, una secuencia, u otra estructura?

**Contexto y evidencia encontrada:**
Análisis comparativo completo (Fase 12):

| | Guion TEA (verbal/gestual) | Guión técnico (cubos) |
|---|---|---|
| Actor que interviene | "El investigador"/"el experimentador" | Ninguno nombrado explícitamente en el propio texto |
| Estímulos | Voz, gesto, señal sonora del investigador | Luz LED, vibración, sonido del cubo |
| Uso de los cubos | Nunca se mencionan | Es el único medio |
| EEG | No se menciona | Ancla cada fase a marcadores esperados (theta, N2, P3) |
| Autodefinición | — | *"A diferencia de intervenciones basadas en mediación verbal... transfiere la **totalidad** de la señal reguladora al entorno físico"* (línea 2794) |

La frase de autodefinición del guion técnico es la evidencia más fuerte: se presenta explícitamente como alternativa a la mediación verbal, no como su complemento. Esto, sumado a que ambos comparten la misma estructura de 3 fases (Pausar/Pensar/Actuar) y a que el actor decisor real es el mismo docente/investigador en ambos (confirmado por el uso intercambiable de esos dos términos en el Manual de usuario, línea 2524-2530), apunta con fuerza a que **el Guion TEA es el protocolo de la sesión "sin cubos" y el Guión técnico el de la sesión "con cubos"** de la pregunta 1 — sin que ninguna frase del documento lo diga de forma literal y única.

Refuerzo adicional (no concluyente): la Figura 4.1 actual ("Diseño metodológico") es una plantilla heredada de un estudio previo con estudiantes con TDAH (geometría, software DGPad), que compara "retroacciones estándar" vs. "retroacciones IA" en dos sesiones — la misma lógica de diseño de dos condiciones, aunque en un dominio distinto y con una diferencia crítica: ahí la segunda condición sí es automatizada (IA real), mientras que en esta tesis debe seguir siendo Mago de Oz.

Lo que el texto **no permite afirmar sin ambigüedad**: ninguna frase nombra a la vez un guion y una sesión; la frase de apertura del Guion TEA ("interrupciones verbales/gestuales **y** bloques inteligentes") tensiona ligeramente esta lectura; no hay descripción del orden/conteo de las dos sesiones.

**Decisión tomada:**
[PENDIENTE]

---

## 3. Mago de Oz explícito

**Pregunta:** ¿debe quedar explícitamente establecido en el documento que el docente/investigador decide cuándo activar Pausar, Pensar y Actuar?

**Contexto y evidencia encontrada:**
Ya verificado contra el código (`App.tsx`, función `sendAction`): la activación depende exclusivamente de 3 botones `onClick`; no existe ningún temporizador ni sensor que dispare una transición. Sin embargo, el Guión técnico experimental (líneas 2792, 2842, 2843, 2844, 2848) usa lenguaje que sugiere lo contrario: *"agentes multisensoriales autónomos"*, *"Activación automática del modo Pausar"*, *"Transición programada al modo Pensar"*, *"detección de movimiento del cubo"* como mecanismo de transición. Ya se corrigieron 2 líneas equivalentes fuera de los guiones (2175, 2177); estas 5 quedaron sin corregir porque dependen de la respuesta a la pregunta 2.

Hipótesis sobre el origen del lenguaje incorrecto: la plantilla del estudio con TDAH (pregunta 2) usa el término "retroacciones **IA**" para su segunda condición — genuinamente automatizada en ese estudio. Es posible que ese marco se haya trasladado, sin adaptarse, al redactar el Guión técnico de esta tesis.

**Decisión tomada:**
[PENDIENTE]

---

## 4. Familiarización

**Pregunta:** ¿debe existir una fase de familiarización con las señales del sistema antes de la sesión experimental?

**Contexto y evidencia encontrada:**
Ningún punto de `main.tex` describe una etapa donde el niño aprenda, antes de la sesión, qué significa cada color/vibración/sonido del cubo. La plantilla del estudio con TDAH (pregunta 2) sí incluye una etapa explícita de "Alistamiento" con "familiarización con la herramienta" y entrenamiento previo. Dado que el control inhibitorio del niño se mide en función de su respuesta a una señal, la ausencia de una etapa de familiarización es una laguna metodológica real: sin ella, es difícil distinguir "no inhibió la respuesta" de "no entendió qué significaba la señal".

**Decisión tomada:**
[PENDIENTE]

---

## 5. Muestra

**Pregunta:** ¿cómo debe formularse formalmente una muestra exploratoria inicial de 1-2 participantes?

**Contexto y evidencia encontrada:**
`DECISIONES_PROYECTO.md` ya establece que la investigación puede comenzar con 1 o 2 participantes, sin cerrarse de forma definitiva. No existen todavía criterios de inclusión/exclusión redactados en `main.tex` más allá del diagnóstico TEA nivel 1. La sección `\section{Participantes}` está actualmente duplicada y vacía en dos puntos del documento (líneas 2181 y 2563).

**Decisión tomada:**
[PENDIENTE]

---

## 6. Ética

**Pregunta:** ¿qué ruta institucional debe seguirse para consentimiento informado, asentimiento, tratamiento de datos EEG, participación de menores y aprobación ética?

**Contexto y evidencia encontrada:**
`PENDIENTES_TESIS.md` registra este punto como 🔴 CRÍTICO, sin proceso documentado todavía. La plantilla del estudio con TDAH solo contemplaba consentimiento de padres/tutores. El propio Marco Teórico de esta tesis describe a los niños con TEA nivel 1 como personas que "pueden comunicarse verbalmente" — lo que abre la pregunta de si, además del consentimiento parental, corresponde un asentimiento del propio niño.

**Decisión tomada:**
[PENDIENTE]

---

## 7. Variables / evidencias

**Pregunta:** ¿qué papel tendrá cada fuente de evidencia (EEG, trayectoria del juego, indicadores conductuales, o su combinación)?

**Contexto y evidencia encontrada:**
Actualmente coexisten tres tipos de evidencia sin una jerarquía declarada: (a) EEG/Alpha TRP, comparado explícitamente entre sesiones (pregunta 1); (b) métricas de trayectoria del juego (buclicidad, ramificación), con fundamento matemático propio; (c) los 5 indicadores conductuales del Guion TEA (tiempo de reacción, tiempo de decisión, revisiones, errores, autorreporte), ubicados entre los dos guiones sin que quede claro a cuál aplican. El Guión técnico ancla sus fases a marcadores EEG específicos (theta frontal, N2, P3); el Guion TEA no menciona EEG en ningún punto.

**Decisión tomada:**
[PENDIENTE]

---

## 8. Entrevista

**Pregunta:** ¿debe incorporarse alguna medida de percepción subjetiva del participante, o queda fuera del diseño?

**Contexto y evidencia encontrada:**
El diseño actual no incluye entrevistas. La plantilla del estudio con TDAH sí las incluía (entrevista semiestructurada tras cada condición, explorando categorías como "efectos sobre autonomía y agencia"). El propio Guion TEA ya contempla un ítem de "autorreporte emocional" dentro de sus indicadores conductuales (`¿Cómo te sientes ahora?`), lo que sugiere que una versión breve y estructurada podría ser viable para TEA nivel 1 sin necesitar una entrevista semiestructurada completa.

**Decisión tomada:**
[PENDIENTE]

---

## Modificaciones posteriores

*[PENDIENTE — registrar aquí cualquier cambio a esta acta después de la sesión, con fecha y motivo. No editar las decisiones anteriores retroactivamente sin dejar constancia aquí.]*
