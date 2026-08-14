# DECISIONES DEL PROYECTO

*Última actualización: 2026-08-14*

Este archivo contiene **únicamente decisiones ya tomadas** por el autor y confirmadas contra la evidencia disponible (código, firmware, artículo primario, o declaración directa del autor). No es un espacio de discusión ni de pendientes — para eso existe `PENDIENTES_TESIS.md`.

---

## Investigación

- La investigación es exploratoria, por diseño, y se mantiene así deliberadamente sin forzar una hipótesis formal.
- Se encuentra actualmente en etapa **preexperimental**: el prototipo tecnológico ya fue construido y depurado; el protocolo experimental está diseñado; las sesiones EEG **todavía no se han realizado**.
- La muestra todavía no está definida de forma definitiva. Puede comenzar con 1 o 2 participantes.
- No deben inventarse resultados, datos demográficos, ni afirmarse que el experimento ya se ejecutó.

## Nomenclatura

- El tercer estado oficial es **ACTUAR**. Los tres estados iniciales de esta primera fase son **PAUSAR, PENSAR, ACTUAR**.
- La carpeta de código `src/core/agents/actions/elegir/` ya fue renombrada a `actions/actuar/` (commit `775c7b6`). Es un cambio puramente nominal: cero referencias externas a esa carpeta existían antes del cambio (confirmado por búsqueda exhaustiva), por lo que no hubo riesgo de romper nada.
- Los archivos internos `fe1.ts`, `fe2.ts` y `fe3.ts` conservaron sus nombres — no se renombraron a `fa1.ts`/`fa2.ts`/`fa3.ts`.
- En `main.tex`, la normalización Elegir → Actuar **todavía no se ha ejecutado** (ver Fase 9 en `PENDIENTES_TESIS.md`). El texto de la tesis sigue usando mayoritariamente "Elegir" fuera de las subsecciones ya corregidas de la Fase 7.

## Prototipo — hardware confirmado

- Los cubos utilizan **ESP32-C3 SuperMini** (identificación proporcionada directamente por el desarrollador; el chip no es visible en su totalidad en las fotografías disponibles).
- El maestro utiliza **ESP32 DevKit V1** — **no** el mismo tipo de microcontrolador que los cubos.
- El maestro está alimentado mediante **Power Bank** (capacidad no determinada, no debe inventarse).
- Cada cubo tiene: LED RGB, motor de vibración, buzzer, batería recargable, y un sistema de acoplamiento magnético con la casilla/base.
- La batería visible del cubo está confirmada como **3.7 V / 180 mAh** (dato leído directamente de la etiqueta fotografiada).

## Arquitectura física — híbrida, dos canales (CERRADA)

- El acoplamiento del cubo con la casilla de la base **no debe representarse como una conexión WiFi directa**. Existe un canal físico independiente: acoplamiento magnético → conector de la casilla → cableado de la base → pines GPIO del ESP32 maestro.
- **Canal 1 — Posición/presencia**: confirmado en el firmware (`Maestro___Wifi_copy_20260813194508.ino`, líneas 38-40 y 88-152): 11 pines GPIO del propio maestro (`pinesBase[11]`), leídos con `digitalRead()`, detectan la posición/presencia de cada cubo. No hay evidencia de que ese cableado llegue hasta el ESP32-C3 del propio cubo — el sensor lo lee el maestro, no el cubo (sigue abierto, ver `PENDIENTES_TESIS.md`).
- **Canal 2 — Actuación**: WiFi (el maestro opera simultáneamente como punto de acceso hacia los cubos y como estación hacia la red del laboratorio) con una conexión TCP en el puerto 3333 hacia el ESP32-C3 de cada cubo, por la que se transmiten los parámetros de color y vibración.
- Ambos canales están verificados en el mismo archivo de firmware, **coexisten** y no son contradictorios entre sí — el canal de posición no sustituye al canal de actuación.
- **El autor confirmó que `Maestro___Wifi_copy_20260813194508.ino` es el firmware actualmente instalado en el ESP32 maestro físico.** Por tanto, TCP 3333 queda documentado de forma definitiva como el canal de actuación maestro→cubos — deja de ser una incertidumbre histórica.
- Esta arquitectura híbrida (canal de posición + canal de actuación) y el hardware confirmado (ESP32-C3 SuperMini, ESP32 DevKit V1, Power Bank, batería 3.7V/180mAh) ya están redactados en `main.tex` y quedaron registrados en el commit `d4202a8` (cierre de la Fase 7, 2026-08-14).

## Arquitectura de red

- El sistema mantiene comunicación de red entre: computador del docente (frontend + backend) → red local / router del laboratorio → ESP32 DevKit V1 maestro.
- La implementación verificada utiliza: WiFi, Socket.IO (frontend↔backend), HTTP puerto 3000 (backend↔maestro), UDP puerto 4210 (descubrimiento automático del backend), TCP puerto 3333 (maestro↔cubos, canal de actuación: color y vibración; el sonido se incorporará a este mismo canal en una fase posterior de desarrollo del firmware).
- **No están presentes** ni deben introducirse: Bluetooth, BLE, MQTT, ESP-NOW, ZigBee, Raspberry Pi — verificado por ausencia total en el código/firmware disponible.
- El backend vigente es `Backend-Cubos-Inteligentes-main` (confirmado con 4 pruebas cruzadas: `GUIA_CONEXION.md` solo referencia esta carpeta; el backup carece de los eventos `baseStatus`/`esclavosConectados` que el frontend sí escucha; el backup carece de `/api/esclavosConectados`, `/api/obtenerComandoGlobal` y el evento `comandoGlobal`; `App.tsx` y este `server/index.js` tienen marcas de tiempo de modificación con un minuto de diferencia entre sí). El directorio `Backup funcional - Backend-Cubos-Inteligentes-main` se conserva únicamente como referencia histórica.

## HRS-EDU

- HRS-EDU (Páez y González, 2022, `PaezGonzalez2022` en la bibliografía) es un **referente teórico y conceptual**. No debe presentarse como una implementación directa del sistema propio (no hay módulos BDI, no hay percepción automática del aprendiz, no hay robot Baxter).
- Los 8 roles/estados emocionales que aparecen en "Propuesta estructural integradora" son una adaptación conceptual directa de la Figura 5 de HRS-EDU (círculo de roles Decisive/Authoritative/Encourage/Protective/Indecisive/Intimidating/Discouraging/Exploitative) — confirmado mediante lectura completa del artículo primario. Corresponden a una **posible ampliación futura**, no al repertorio inicial de tres estados (Pausar/Pensar/Actuar).

## Mago de Oz / autonomía

- La activación actual de los estados (Pausar/Pensar/Actuar) se realiza exclusivamente mediante una interfaz operada manualmente por el docente.
- No debe asumirse ni redactarse que el sistema tiene autonomía cognitiva o emocional, detección automática del estado del estudiante, o transición automática entre fases — ninguna de estas capacidades existe en la implementación actual, verificado en el código.

## Regla editorial

- La tesis debe presentarse como un documento académico consolidado de la propuesta y el desarrollo tecnológico, no como un diario de depuración.
- Las limitaciones (p. ej. la integración pendiente del buzzer) deben aparecer de forma puntual y metodológicamente justificada, no repetirse constantemente con expresiones como "estado actual", "brecha" o "no implementado" en cada figura y cada tabla.
- Ninguna figura, tabla, caption o nota al pie del documento debe citar sesiones de trabajo, auditorías, ni herramientas de IA. La trazabilidad hacia el código/firmware se mantiene en el proceso de verificación (estos archivos de control y el historial de commits), nunca en el texto de la tesis.
- No se modifica la plantilla institucional (portada, márgenes, tipografía, numeración) salvo autorización explícita del autor.
