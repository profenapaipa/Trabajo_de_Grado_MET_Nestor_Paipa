# Informe de avance — Reunión con el director/tutor

*Preparado: 2026-08-14. Estado de la investigación: PREEXPERIMENTAL.*

Este informe resume el estado real del proyecto de tesis "Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio durante la resolución del juego La Escalera en niños con Trastorno del espectro Autista - TEA nivel 1" para la reunión con el director/tutor. Todo el contenido proviene de `ESTADO_PROYECTO.md`, `DECISIONES_PROYECTO.md` y `PENDIENTES_TESIS.md`, verificados contra `main.tex`, el firmware y el código del prototipo. No contiene resultados experimentales, muestra definitiva, ni decisiones metodológicas todavía no aprobadas.

---

## 1. Contexto

Maestría en Educación en Tecnología, Universidad Distrital Francisco José de Caldas. La investigación es exploratoria por diseño, sin forzar una hipótesis formal, y busca explorar la influencia de herramientas con agentividad en el control inhibitorio de niños con TEA nivel 1 durante la resolución del juego La Escalera, mediante el análisis de la actividad EEG.

## 2. Estado de la investigación

La investigación se encuentra en etapa **preexperimental**:

- El prototipo tecnológico (sistema de 10 cubos inteligentes) ya está construido y depurado.
- El protocolo experimental está diseñado (dos guiones: uno verbal/gestual y uno técnico de configuración de cubos), pero **la relación metodológica exacta entre ambos todavía no está cerrada** (Fase 12).
- Las sesiones EEG de esta investigación **todavía no se han realizado**. No existen resultados, ni datos demográficos, ni muestra definitiva.
- La muestra puede comenzar con 1 o 2 participantes, sin definirse todavía de forma cerrada.

## 3. Avances académicos

- Diagnóstico integral de la tesis y del prototipo (coherencia entre lo escrito y lo implementado).
- Revisión estructural completa del documento (`main.tex`, 79 páginas).
- Corrección de contradicciones entre la tesis y el código real del prototipo (arquitectura de red, protocolo de comunicación, hardware).
- Normalización terminológica: el tercer estado del sistema pasó de llamarse "Elegir" a su nombre oficial, **Actuar**, tanto en el código (`actions/actuar/`) como en el texto de la tesis (13 puntos de edición ejecutados y verificados, Fase 9).
- Actualización de la sección de Materiales con el protocolo de comunicación real (WiFi, no Bluetooth como se describía antes).

## 4. Avances tecnológicos

- Prototipo físico de 10 cubos inteligentes sobre una base con acoplamiento magnético, operado mediante la técnica de **Mago de Oz** (el docente/investigador activa manualmente cada estado desde una interfaz).
- Arquitectura híbrida de dos canales, verificada directamente contra el firmware instalado:
  - **Canal de posición**: ESP32 maestro → cableado de las bases/casillas → pines GPIO → detección de la posición de cada cubo (`pinesBase[11]`, `digitalRead`).
  - **Canal de actuación**: ESP32 maestro → WiFi → TCP puerto 3333 → ESP32-C3 de cada cubo → LED, motor de vibración (el sonido se incorporará a este canal en una fase posterior de desarrollo).
- Software verificado de extremo a extremo: Frontend (React + TypeScript + Vite) ↔ Backend (Node.js + Express + Socket.IO) ↔ Maestro (HTTP puerto 3000, descubrimiento automático por UDP puerto 4210) ↔ Cubos (TCP puerto 3333).
- Verificación directa en el código (`App.tsx`) de que **no existe ningún disparador automático** (temporizador o sensor) para las transiciones Pausar/Pensar/Actuar: la activación depende exclusivamente del clic del docente/investigador en 3 botones.

## 5. Arquitectura

Cadena de comunicación: **Docente/investigador → Frontend → Backend → ESP32 maestro (DevKit V1) → Cubos (ESP32-C3 SuperMini)**. El maestro opera simultáneamente como punto de acceso WiFi para los cubos y como cliente de la red del laboratorio. Hardware confirmado: cubos con batería 3.7V/180mAh; maestro alimentado por Power Bank. Esta arquitectura está documentada con figuras y tablas propias en `main.tex` (sección "Materiales"), ya revisadas visualmente tras la compilación.

## 6. HRS-EDU

El referente teórico es la arquitectura **Human-Robot Scaffolding (HRS-EDU)** de Páez y González (2022), un sistema multiagente fundamentado en el modelo BDI (creencias, deseos e intenciones) que regula el comportamiento de un robot (Baxter) según el estado cognitivo/emocional del aprendiz, con percepción automática de ese estado. La propia investigación de HRS-EDU encontró que sus intervenciones eran **más efectivas cuando no operaban de forma autónoma**. Este proyecto retoma esa idea y la adapta explícitamente: se conserva la mediación con agentividad (el cubo como "agente físico"), pero se descarta la percepción/decisión autónoma — el docente/investigador cumple ese rol mediante Mago de Oz. HRS-EDU es un referente conceptual, no una implementación directa.

## 7. Avances por fases

*(Numeración vigente de `ESTADO_PROYECTO.md` — no renumerada.)*

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Preparación | ✅ |
| 1 | Diagnóstico integral | ✅ |
| 2 | Reanálisis metodológico (preexperimental, Mago de Oz, fuente de verdad = código) | ✅ |
| 3 | Auditoría HRS-EDU | ✅ |
| 4 | Normalización de código Elegir → Actuar | ✅ |
| 5 | Incorporación del PDF de referencia HRS-EDU | ✅ |
| 6 | Actualización inicial de Materiales | ✅ |
| 7 | Arquitectura tecnológica (commit `d4202a8`) | ✅ |
| 8 | Nota de alcance preexperimental | ⏳ |
| 9 | Elegir → Actuar en el resto de `main.tex` (commit `4dbcfd4`) | ✅ |
| 10 | Corrección del lenguaje de autonomía (Mago de Oz) | 🟡 PARCIAL |
| 11 | Unificación de valores PAUSAR/PENSAR/ACTUAR | ⏳ |
| 12 | Relación entre los dos guiones experimentales | 🔴 BLOQUEADA |
| 13 | Metodología (Participantes/Procedimiento, modo prospectivo) | ⏳ |
| 14 | Puente conceptual HRS-EDU | ⏳ |
| 15 | Bibliografía | ⏳ |
| 16 | Resultados | 🔵 RESERVADA |
| 17 | Conclusiones / Trabajos futuros | 🔵 RESERVADA |
| 18 | Auditoría final de LaTeX | 🔵 RESERVADA |

## 8. Barreras

**Técnicas** — protocolo eléctrico exacto del cableado cubo-base sin resolver; función exacta del acoplamiento magnético respecto al ESP32-C3 sin resolver; firmware del cubo esclavo (`Cubo-Esclavo.ino`) no localizado en el proyecto; integración del comando sonoro en el canal de actuación, prevista para una fase posterior de desarrollo.

**Documentales** — 10 labels LaTeX duplicados (`fig:placeholder`), con causa raíz ya identificada (una guía de MATLAB reutiliza el mismo bloque de figura sin actualizar el caption); 3 referencias bibliográficas sin verificar (`Cardenas2017`, `RodriguezLopez2017`, `Natalia2017`); un posible duplicado bibliográfico (`Frith2003`/`Frith1989`); una sección "Participantes" duplicada y vacía; BibTeX nunca ejecutado (las citas aparecen como "undefined" en el log de compilación).

**Metodológicas** — relación exacta entre el guion experimental TEA nivel 1 (verbal/gestual) y el guión técnico experimental (configuración de cubos) sin cerrar; la Figura 4.1 ("Diseño metodológico") actualmente en el documento es una plantilla heredada de un estudio previo con estudiantes con TDAH (geometría, software DGPad, comparación de retroacciones estándar vs. IA), pendiente de evaluar su viabilidad para el diseño actual; ausencia de una etapa explícita de familiarización del niño con las señales del sistema antes de la sesión experimental; muestra exploratoria sin formalizar; ruta de consentimiento/asentimiento/aprobación ética sin definir; papel relativo de cada fuente de evidencia (EEG, trayectoria del juego, indicadores conductuales) sin jerarquizar.

Ninguno de estos puntos se presenta como un error: son **decisiones o verificaciones necesarias antes de la ejecución experimental**.

## 9. Decisiones pendientes

- **Fase 8**: redactar la nota de alcance preexperimental (diseño ya definido, sin ejecutar).
- **Fase 10 (parcial)**: 2 de 7 expresiones de lenguaje de autonomía ya corregidas; las 5 restantes dependen de que se resuelva la Fase 12.
- **Fase 11**: unificar los valores numéricos de Pausar/Pensar/Actuar en el documento, tomando el código (`App.tsx`) como fuente de verdad — sin ejecutar todavía.
- **Fase 12**: decisión metodológica central de esta reunión — ver preguntas 1 y 2 más abajo.
- **Fase 13**: no puede redactarse en modo definitivo (Participantes/Procedimiento) hasta resolver las Fases 8-12.

## 10. Preguntas al director

1. **Diseño de investigación**: ¿la validación debe estructurarse como comparación sesión sin cubos vs. sesión con cubos, como línea base + intervención, como una única condición exploratoria, u otra estructura?
2. **Relación entre los dos guiones**: ¿el guion experimental TEA nivel 1 (verbal/gestual) y el guión técnico de cubos son un protocolo integrado, dos condiciones, una secuencia, u otra estructura? (Existe evidencia textual — no concluyente — de que corresponderían a dos sesiones comparadas; existe también una figura de diseño metodológico heredada de un estudio previo con TDAH que sugiere esa misma estructura general, pero para otra población y otro dominio.)
3. **Mago de Oz**: ¿debe quedar explícitamente establecido en el documento que el docente/investigador decide cuándo activar Pausar, Pensar y Actuar?
4. **Familiarización**: ¿debe existir una fase de familiarización del niño con las señales del sistema (color/vibración/sonido) antes de la sesión experimental?
5. **Muestra**: ¿cómo debe formularse formalmente una muestra exploratoria inicial de 1-2 participantes?
6. **Ética**: ¿qué ruta institucional debe seguirse para consentimiento informado, asentimiento, tratamiento de datos EEG, participación de menores y aprobación ética?
7. **Variables/evidencias**: ¿qué papel tendrá cada fuente de evidencia (EEG, trayectoria del juego, indicadores conductuales, o su combinación)?
8. **Entrevista**: ¿debe incorporarse alguna medida de percepción subjetiva del participante, o queda fuera del diseño?

## 11. Próximos pasos

Condicionados a las respuestas de la reunión (sin fechas ni compromisos no expresados por el autor):

- Si se confirma la relación entre los dos guiones (pregunta 2) → se cierra la Fase 12, y con ella las 5 correcciones de lenguaje pendientes de la Fase 10 y la unificación de valores de la Fase 11.
- Si se define la estructura de validación (pregunta 1) → se redacta la Fase 13 (Metodología, Participantes/Procedimiento) en modo prospectivo.
- Si se define la ruta ética (pregunta 6) → el autor gestiona el trámite institucional correspondiente.
- En paralelo, sin depender de las preguntas anteriores: autorizar la Fase 8 (nota de alcance preexperimental) y continuar la verificación de la bibliografía pendiente.

Todas las decisiones que se tomen en la reunión quedarán registradas en `ACTA_DECISIONES_REUNION_TESIS.md`.
