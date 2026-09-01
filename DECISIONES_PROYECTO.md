# DECISIONES DEL PROYECTO

*Última actualización: 2026-09-01*

Este archivo contiene **únicamente decisiones ya tomadas** por el autor y confirmadas contra la evidencia disponible (código, firmware, artículo primario, o declaración directa del autor). No es un espacio de discusión ni de pendientes — para eso existe `PENDIENTES_TESIS.md`.

---

## Investigación

- La investigación es exploratoria, por diseño, y se mantiene así deliberadamente sin forzar una hipótesis formal.
- Se encuentra actualmente en etapa **preexperimental**: el prototipo tecnológico ya fue construido y depurado; el protocolo experimental está diseñado; las sesiones EEG **todavía no se han realizado**.
- **Muestra (cerrada, confirmada por el autor 2026-09-01): 1 solo estudiante.** La formulación anterior de esta sección ("puede comenzar con 1 o 2 participantes") queda superada — ya no está abierta la posibilidad de 2 casos.
- No deben inventarse resultados, datos demográficos, ni afirmarse que el experimento ya se ejecutó.
- **Encuadre metodológico (2026-09-01):** el alcance es exploratorio, el enfoque es mixto, el diseño es preexperimental y de **caso único** — no hay grupo de contraste ni pretensión causal. Coherente con la muestra de 1 estudiante confirmada arriba.

## Nomenclatura

- El tercer estado oficial es **ACTUAR**. Los tres estados iniciales de esta primera fase son **PAUSAR, PENSAR, ACTUAR**.
- La carpeta de código `src/core/agents/actions/elegir/` ya fue renombrada a `actions/actuar/` (commit `775c7b6`). Es un cambio puramente nominal: cero referencias externas a esa carpeta existían antes del cambio (confirmado por búsqueda exhaustiva), por lo que no hubo riesgo de romper nada.
- Los archivos internos `fe1.ts`, `fe2.ts` y `fe3.ts` conservaron sus nombres — no se renombraron a `fa1.ts`/`fa2.ts`/`fa3.ts`.
- En `main.tex`, la normalización Elegir → Actuar **ya se ejecutó y se verificó** (Fase 9, commit `4dbcfd4`): 8 sustituciones de texto + 5 identificadores TikZ renombrados. Quedan intactas, a la espera de la Fase 12, las 5 ocurrencias dentro de los dos guiones experimentales.

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
- **(2026-09-01)** La autonomía queda descartada como decisión de diseño, no solo como estado actual de la implementación: la herramienta conserva agentividad, pero el sistema no activa ningún estado por sí solo en ningún caso, ni siquiera como respaldo si algo falla. La consola **sugiere**; el operador humano **confirma**.
- **Regla de vocabulario (2026-09-01), vinculante para código e interfaz:** usar exclusivamente "sugerencia" y "confirmación". Quedan prohibidos los verbos "detecta", "decide" y "activa automáticamente" para describir el comportamiento del sistema.

## Criterios de activación de los estados PPA

*Incorporado 2026-09-01.*

- **Pausar** se activa por dos fallas consecutivas.
- **Pensar** se activa por una señal de confusión.
- **Actuar** se activa por latencia sin movimiento, medida desde el inicio del turno; tiene prioridad cuando ocurre después de un Pausar o un Pensar ya confirmados.
- Los tres umbrales viven en configuración; ninguno queda quemado en el código.
- El umbral de Actuar no es un número único: es relativo al nivel (número de cubos en juego, con progresión de 1 a 5) y debe recalibrarse en cada aumento de cubos. Un umbral fijo dispararía siempre con cinco cubos y casi nunca con uno, confundiendo dificultad de la tarea con vacilación del jugador.
- El umbral base se calibra en la sesión de familiarización con la latencia propia del participante, y se fija alto a propósito: una latencia larga puede ser procesamiento y no bloqueo, y un Actuar prematuro interrumpiría justo lo que se quiere medir.
- El criterio se puede ajustar entre sesiones, nunca dentro de una sesión. La configuración debe estar versionada, y el identificador de versión debe quedar escrito en cada sesión registrada.
- El valor numérico del umbral base de Actuar todavía no se ha definido; no debe inventarse.

## Bitácora de sesión

*Incorporado 2026-09-01.*

- Marca de tiempo en formato ISO 8601 con milisegundos. Exportable a CSV y a JSON.
- Registra como mínimo: posición de cada cubo, fallas, desconexiones y, para cada evento de PPA, la secuencia completa: sugerencia emitida, motivo que la disparó, decisión del operador (confirmar o descartar), motivo del descarte cuando aplique, y activación efectiva.
- El descarte de una sugerencia no es una falla del sistema, es dato: la discrepancia entre lo que sugiere la consola y lo que decide el humano es un hallazgo del estudio y no puede perderse ni sobrescribirse.
- Cada evento lleva el identificador del operador que confirmó.
- Cada sesión lleva la versión de configuración vigente (ver criterios de activación PPA arriba).
- La alineación de relojes entre frontend, backend y ESP32 es requisito previo al inicio de las sesiones, porque la bitácora se sincroniza después con el registro EEG y con el video.

## Roles durante la sesión

*Incorporado 2026-09-01.*

- El operador que confirma las sugerencias de PPA es el investigador principal, por consistencia en la aplicación de los criterios y por conocimiento de la configuración del sistema.
- Existe además un rol de observador, que registra y acompaña, y que no confirma.
- El sistema debe soportar ambos roles por separado: identificador de operador en cada evento confirmado, y una vista de observación de solo lectura, sin controles de confirmación. Es un requisito del protocolo, no una preferencia de interfaz — no debe simplificarse a un solo rol aunque el código quede más limpio.
- Los identificadores de las personas que ocuparán estos roles todavía no se han asignado; no deben inventarse.

## Material de referencia (línea base) — NO MODIFICAR

- La carpeta `Versión1ACACIA-Cubos-inteligentes-main/` contiene la entrega original del proyecto ACACIA (firmware del maestro y de los cubos, backend y frontend) tal como fue recibida, más el protocolo EEG en `graficasEEG-AlphaTRP-main_GITHUB/` (incluido `liang2018.pdf`, el artículo de referencia de ese protocolo).
- **Esta carpeta no debe modificarse bajo ninguna circunstancia**: ni el código, ni la estructura de subcarpetas, ni los nombres de archivo. Ninguna sesión debe editar, renombrar, mover ni "limpiar" nada dentro de ella, tampoco para corregir errores de compilación, normalizar nomenclatura o cualquier otro fin.
- Su propósito es servir de evidencia verificable de la línea base real entregada, para poder distinguir con precisión, contra el código, qué es aporte propio de esta investigación y qué no. Confirmado (2026-09-01): el canal de posición (GPIO) y el canal de actuación (WiFi/TCP 3333) ya estaban funcionales de extremo a extremo en esta entrega original, incluida la conexión con la interfaz (`actualizarPosiciones`/`comandoCubo` vía Socket.IO); no son, por tanto, aporte propio. El aporte propio confirmado contra esta línea base es: descubrimiento automático de red, seguimiento de estado de conexión, protocolo de interacción Mago de Oz con sus criterios PPA, y toda la adaptación al estudio EEG/TEA nivel 1. El esquema de tres agentes de sugerencia de movimiento (`pausar`/`pensar`/`elegir`, basado en Dijkstra) también viene de esta entrega original y sigue sin usarse en la aplicación actual.
- Cualquier verificación futura contra el código debe leerse desde esta carpeta, nunca desde memoria de sesiones anteriores.

## Distinción entre cubo levantado y cubo desconectado

*Incorporado 2026-09-02.*

- La distinción se resuelve en dos pasos, no en uno solo. Primero se evalúa si el cambio de estado es compatible con un movimiento legal según las reglas de La Escalera: como máximo un cubo levantado a la vez, y ese cubo debe pertenecer al conjunto de cubos que pueden moverse (avance únicamente en el sentido opuesto al de inicio, sin retroceso, salto de un solo cubo).
- Si el cambio es compatible con un movimiento legal, se interpreta como cubo levantado.
- Si no es compatible, **no se asume automáticamente que el cubo está desconectado**. Antes de descartarlo, se debe revisar una señal o proceso independiente del canal de posición que confirme la desconexión.
- Motivo de la regla: un cambio de estado fuera de las reglas del juego podría deberse a otra causa distinta de la desconexión (por ejemplo, un roce accidental o un rebote de sensor), y tratar todo lo "no legal" como desconexión perdería esa distinción.
- Esto determina directamente cómo se representa cada cubo en el frontend (estados Levantado / Reubicado / No detectado).
- La señal o proceso concreto para confirmar la desconexión todavía no está definida ni evaluada contra hardware real; queda registrada como pendiente en `PENDIENTES_TESIS.md`, junto con el candidato ya disponible en el sistema (el reporte periódico de esclavos conectados que hace el maestro).

## Regla editorial

- La tesis debe presentarse como un documento académico consolidado de la propuesta y el desarrollo tecnológico, no como un diario de depuración.
- Las limitaciones (p. ej. la integración pendiente del buzzer) deben aparecer de forma puntual y metodológicamente justificada, no repetirse constantemente con expresiones como "estado actual", "brecha" o "no implementado" en cada figura y cada tabla.
- Ninguna figura, tabla, caption o nota al pie del documento debe citar sesiones de trabajo, auditorías, ni herramientas de IA. La trazabilidad hacia el código/firmware se mantiene en el proceso de verificación (estos archivos de control y el historial de commits), nunca en el texto de la tesis.
- No se modifica la plantilla institucional (portada, márgenes, tipografía, numeración) salvo autorización explícita del autor.
