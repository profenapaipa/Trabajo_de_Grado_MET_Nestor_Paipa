# Fuente única para la presentación — Reunión con el director/tutor

*Este archivo es la fuente completa y autocontenida para generar el PowerPoint de la reunión. Reemplaza a `ACTA_DECISIONES_REUNION_TESIS.md` (retirado, su contenido quedó integrado aquí como las diapositivas 13 y 14) y complementa a `INFORME_AVANCE_REUNION_TESIS.md` (que sigue existiendo como respaldo escrito detallado, pero ya no es necesario para generar la presentación). Ningún dato de este archivo es inventado: todo proviene de `ESTADO_PROYECTO.md`, `DECISIONES_PROYECTO.md`, `PENDIENTES_TESIS.md` y de verificaciones directas contra el código/firmware ya hechas en sesiones anteriores.*

**Instrucción para quien genere el PowerPoint**: cada bloque `## Diapositiva N` es una diapositiva. Los bloques marcados `TABLA:` deben convertirse en una tabla nativa de PowerPoint (no texto plano ni viñetas) con exactamente esas columnas. Las diapositivas 13 y 14 tienen la columna "Decisión tomada" vacía a propósito — debe quedar como una celda vacía y editable en el PowerPoint final, no rellenarse con contenido inventado.

---

## Diapositiva 1 — Portada

- Título: "Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio durante la resolución del juego La Escalera en niños con TEA nivel 1"
- Autor: Néstor Andrés Paipa Castro
- Programa: Maestría en Educación en Tecnología — Universidad Distrital Francisco José de Caldas
- Línea: "Reunión con el director/tutor de tesis — [fecha por confirmar]"
- Etiqueta destacada: "ETAPA PREEXPERIMENTAL"

## Diapositiva 2 — Punto de partida

Objetivo general (cita textual de `main.tex`): *"Explorar la influencia de herramientas con agentividad en el control inhibitorio, evidenciado mediante el análisis de la actividad EEG, durante la resolución del juego La Escalera en estudiantes con Trastorno del Espectro Autista nivel 1."*

Tres columnas/tarjetas:
- **TEA nivel 1** — comunicación verbal preservada; dificultades específicas en flexibilidad y regulación del comportamiento.
- **Control inhibitorio** — capacidad de suprimir la respuesta impulsiva y sostener una estrategia deliberada.
- **Herramientas con agentividad** — el cubo como agente físico que traduce el juicio del docente en estímulos calibrados.

## Diapositiva 3 — Estado actual de la investigación

Etiqueta grande: "PREEXPERIMENTAL"

Tres pasos en línea:
1. Prototipo construido y depurado ✅
2. Protocolo experimental diseñado ✅
3. Sesiones EEG: sin ejecutar ⏳

Nota al pie: no existen resultados, datos demográficos ni muestra definitiva todavía.

## Diapositiva 4 — HRS-EDU → adaptación → propuesta propia

Tres cajas conectadas con flechas:
1. **HRS-EDU** (Páez y González, 2022) — modelo BDI, robot Baxter, percepción automática del estado del aprendiz.
2. **Adaptación** — se conserva la mediación con agentividad; se descarta la percepción y la decisión autónoma.
3. **Propuesta propia** — docente/investigador + cubo, activación mediante Mago de Oz.

Nota al pie: HRS-EDU es un referente conceptual, no una implementación directa — no hay módulos BDI ni percepción automática en el prototipo propio.

## Diapositiva 5 — Pausar / Pensar / Actuar + Mago de Oz

Tres estados en fila (usar color distintivo por estado: Pausar=azul, Pensar=ámbar, Actuar=verde):
- **Pausar** — inhibición motora inicial, estabilización atencional antes de planificar.
- **Pensar** — sostén de la planificación secuencial y la memoria de trabajo.
- **Actuar** — ejecución deliberada y confirmación de la decisión tomada.

Recuadro destacado: *"El docente/investigador decide y activa cada estado manualmente. El sistema no detecta ni decide por sí mismo."* — Verificado directamente contra el código (`App.tsx`, función `sendAction`, 3 botones `onClick`).

## Diapositiva 6 — Prototipo desarrollado

Imagen: usar el archivo `Trabajo_de_Grado_MET_Nestor_Paipa\Juego Inteligente.png` (foto real del tablero ensamblado, ya rotulada "Cubos"/"Base").

Lista de especificaciones (al lado de la imagen):
- Microcontrolador cubos: ESP32-C3 SuperMini
- Microcontrolador maestro: ESP32 DevKit V1
- Alimentación maestro: Power Bank
- Batería del cubo: 3.7 V / 180 mAh
- Acoplamiento cubo–base: magnético
- Actuadores por cubo: LED RGB · motor de vibración · buzzer

## Diapositiva 7 — Arquitectura tecnológica

Diagrama de cadena (izquierda a derecha):

Docente/Investigador → Frontend (React + TypeScript + Vite) → Backend (Node.js + Express + Socket.IO) → Maestro (ESP32 DevKit V1) → [se divide en dos ramas] → Canal de posición (GPIO/cableado) **y** Canal de actuación (WiFi/TCP 3333) → Cubos (ESP32-C3 SuperMini)

Etiquetas de protocolo (mostrar como chips o pie de diagrama):
- Socket.IO — frontend ↔ backend
- HTTP puerto 3000 — backend ↔ maestro
- UDP puerto 4210 — descubrimiento automático
- TCP puerto 3333 — maestro → cubos

## Diapositiva 8 — Ruta de fases (0 a 18)

TABLA:

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Preparación | ✅ Completada |
| 1 | Diagnóstico integral | ✅ Completada |
| 2 | Reanálisis metodológico (preexperimental, Mago de Oz) | ✅ Completada |
| 3 | Auditoría HRS-EDU | ✅ Completada |
| 4 | Normalización de código Elegir → Actuar | ✅ Completada |
| 5 | Incorporación del PDF de referencia HRS-EDU | ✅ Completada |
| 6 | Actualización inicial de Materiales | ✅ Completada |
| 7 | Arquitectura tecnológica | ✅ Completada (commit d4202a8) |
| 8 | Nota de alcance preexperimental | ⏳ Pendiente |
| 9 | Elegir → Actuar en el resto de main.tex | ✅ Completada (commit 4dbcfd4) |
| 10 | Corrección del lenguaje de autonomía | 🟡 Parcial |
| 11 | Unificación de valores Pausar/Pensar/Actuar | ⏳ Pendiente |
| 12 | Relación entre los dos guiones experimentales | 🔴 Bloqueada |
| 13 | Metodología (Participantes/Procedimiento) | ⏳ Pendiente |
| 14 | Puente conceptual HRS-EDU | ⏳ Pendiente |
| 15 | Bibliografía | ⏳ Pendiente |
| 16 | Resultados | 🔵 Reservada |
| 17 | Conclusiones / Trabajos futuros | 🔵 Reservada |
| 18 | Auditoría final de LaTeX | 🔵 Reservada |

## Diapositiva 9 — Detalle: Fase 10 y Fase 12

Dos bloques lado a lado:

**Fase 10 — 🟡 Parcial (lenguaje de autonomía)**
- 2 líneas ya corregidas fuera de los guiones.
- 5 líneas pendientes dentro del Guión técnico de cubos ("activación automática", "transición programada", "detección de movimiento del cubo").
- Verificado contra el código: ninguna automatización existe realmente — depende de que se cierre la Fase 12.

**Fase 12 — 🔴 Bloqueada (relación entre los dos guiones)**
- Guion experimental TEA nivel 1 (verbal/gestual) vs. Guión técnico experimental (cubos).
- Evidencia textual (no concluyente) de un diseño de dos sesiones comparadas: "sin cubos" vs. "con cubos".
- Nota: la Figura 4.1 actual del documento es una plantilla heredada de un estudio previo con TDAH (geometría/DGPad) — en evaluación de viabilidad para TEA nivel 1, no una conclusión.

## Diapositiva 10 — Avances

Tres columnas:

**Documentales**
- Diagnóstico integral tesis + prototipo
- Corrección de contradicciones tesis/código
- Normalización terminológica (Elegir → Actuar)
- Materiales actualizados con el protocolo real
- Arquitectura documentada con diagramas y tablas

**Tecnológicos**
- Prototipo físico de 10 cubos + base
- Maestro ESP32 DevKit V1 verificado
- Arquitectura híbrida de dos canales
- Frontend, backend y firmware verificados de extremo a extremo

**Conceptuales**
- Agentividad y scaffolding
- HRS-EDU como referente, no implementación
- Pausar / Pensar / Actuar definidos
- Mago de Oz como decisión de diseño

## Diapositiva 11 — Consolidado vs. abierto

Dos columnas:

**Consolidado**
- Hardware (cubos, maestro, alimentación)
- Arquitectura de dos canales
- Mago de Oz, verificado contra el código
- Nomenclatura Pausar / Pensar / Actuar
- Sistema de control documental por fases

**Abierto**
- Relación entre los dos guiones experimentales
- Muestra exploratoria y ruta ética
- Familiarización previa del niño con el sistema
- Bibliografía: 3 referencias sin verificar
- Papel relativo de EEG, trayectoria del juego e indicadores conductuales

## Diapositiva 12 — Barreras y dependencias

Encabezado: "Decisiones o verificaciones necesarias antes de la ejecución experimental" (nunca llamarlas "fallos")

Tres columnas:

**Técnicas**
- Protocolo eléctrico exacto del cableado cubo–base
- Función exacta del acoplamiento magnético
- Firmware del cubo esclavo, fuera del repositorio
- Integración sonora en el canal de actuación

**Documentales**
- Labels LaTeX duplicados (causa raíz ya identificada)
- 3 referencias bibliográficas sin verificar
- Placeholders residuales
- Auditoría final de LaTeX pendiente

**Metodológicas**
- Diseño exacto de la validación
- Relación entre los dos guiones
- Papel del guion verbal · familiarización
- Muestra · ética · variables de evidencia

## Diapositiva 13 — Decisiones que se requieren para avanzar (1/2)

TABLA (columna "Decisión tomada" debe quedar vacía en el PowerPoint final):

| # | Pregunta | Contexto clave | Decisión tomada |
|---|---|---|---|
| 1 | Diseño de investigación: ¿comparación sin/con cubos, línea base + intervención, condición única, u otra estructura? | 3 pasajes de `main.tex` ya asumen comparar "sesión sin cubos" vs. "sesión con cubos" como la evidencia central de resultados, pero eso nunca se declaró en la Metodología. | |
| 2 | Relación entre los dos guiones: ¿protocolo integrado, dos condiciones, secuencia, u otra estructura? | El Guión técnico se autodefine "a diferencia de la mediación verbal... transfiere la totalidad de la señal al entorno físico". La evidencia apunta a que son las dos sesiones de la pregunta 1, sin decirlo de forma literal. | |
| 3 | Mago de Oz: ¿debe quedar explícitamente establecido que el docente decide y activa cada estado? | Ya verificado en el código que no hay automatización. 5 líneas del Guión técnico usan lenguaje que sugiere lo contrario, y su corrección depende de la respuesta a la pregunta 2. | |
| 4 | Familiarización: ¿debe existir una fase previa de familiarización con las señales del sistema? | Una plantilla de un estudio previo (TDAH, geometría) incluía una etapa explícita de familiarización con la herramienta; esta tesis no la tiene todavía. | |

## Diapositiva 14 — Decisiones que se requieren para avanzar (2/2)

TABLA (columna "Decisión tomada" debe quedar vacía en el PowerPoint final):

| # | Pregunta | Contexto clave | Decisión tomada |
|---|---|---|---|
| 5 | Muestra: ¿cómo formular formalmente una muestra exploratoria de 1–2 participantes? | Puede iniciar con 1 o 2 participantes (ya decidido); sin criterios de inclusión/exclusión redactados todavía en `main.tex`. | |
| 6 | Ética: ¿qué ruta institucional para consentimiento, asentimiento y datos EEG? | Sin proceso documentado todavía. TEA nivel 1 puede requerir asentimiento del propio niño, además del consentimiento parental, dado que puede comunicarse verbalmente. | |
| 7 | Variables/evidencias: ¿qué papel tendrá cada fuente: EEG, trayectoria del juego, indicadores conductuales? | Coexisten 3 tipos de evidencia sin jerarquía declarada. El Guión técnico ancla sus fases a marcadores EEG específicos; el Guion verbal no menciona EEG en ningún punto. | |
| 8 | Entrevista: ¿se incorpora una medida de percepción subjetiva del participante? | El diseño actual no incluye entrevistas. El propio Guion TEA ya contempla un ítem breve de autorreporte emocional que podría ampliarse. | |

## Diapositiva 15 — Próximos pasos

- Si se confirma la relación entre los dos guiones (pregunta 2) → se cierra la Fase 12, y con ella las correcciones pendientes de las Fases 10 y 11.
- Si se define la estructura de validación (pregunta 1) → se redacta la Fase 13 (Metodología, Participantes/Procedimiento) en modo prospectivo.
- Si se define la ruta ética (pregunta 6) → el autor gestiona el trámite institucional correspondiente.
- En paralelo: autorizar la Fase 8 (nota de alcance preexperimental) y continuar la verificación de la bibliografía pendiente.

Pie de página: "Las decisiones acordadas en esta reunión quedan registradas directamente en las diapositivas 13 y 14 de este documento."

---

## Guía de estilo (para quien genere el PowerPoint)

- Tono académico, profesional, tecnológico, limpio, sobrio — nada de plantillas llamativas ni gradientes.
- Paleta: azul marino oscuro (#14375E) para títulos y estructura, fondo blanco/gris muy claro, amarillo mostaza sobrio (#C4881E) solo como acento puntual (nunca como fondo grande).
- Tipografía limpia (Calibri/Segoe UI). Íconos de estado solo los ya indicados (✅🟡🔴⏳🔵).
- Ninguna diapositiva debe ser un bloque de texto plano: usar columnas, tarjetas o tablas según se indica arriba.
- Las diapositivas 13 y 14 son las únicas que llevan una tabla con una columna vacía — deben quedar editables (texto real de tabla de PowerPoint, no una imagen).
