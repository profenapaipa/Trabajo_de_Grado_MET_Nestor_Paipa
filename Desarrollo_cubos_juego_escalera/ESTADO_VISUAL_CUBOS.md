# Estado visual de los cubos — resolutor único y tabla de prioridad

*Creado 2026-09-18, a partir de la Fase 2 (control de partida y código de
colores, ver `ESTADO_PROYECTO.md`/`PENDIENTES_TESIS.md`) y de los dos bugs ya
encontrados y corregidos en la primera prueba con hardware real de esa misma
fecha (señal de conexión EF=1/EF=2 retirada; `"restaurar"` corregido para no
apagar a negro). Ambos bugs tenían la misma causa raíz: distintos comandos
imperativos decidiendo, cada uno por su cuenta y sin saber del resto, qué
mandarle a un cubo. Este documento es la referencia única de la que dependen
tanto el frontend (`core/ppa/cubeVisualState.ts`) como el firmware del cubo
(`Cubo_Esclavo_v3.ino`) — cualquier cambio de prioridad debe actualizarse
aquí primero, y luego en ambos.

**Estado: diseñado, implementado en el frontend y compilado sin errores
(`npm run build`, `arduino-cli compile`), pero SIN verificar contra hardware
real todavía** — ver la sección de estado al final de este documento.

---

## Por qué dos niveles, no una lista plana

Las condiciones de color/vibración de un cubo tienen alcance distinto:
algunas son iguales para los 10 cubos a la vez (bloqueo, victoria, cuenta
regresiva, sesión pausada); otras son propias de un cubo individual (señal
PPA manual de Pausar/Pensar/Actuar, color de equipo en reposo). Por eso el
modelo tiene dos niveles, no una tabla plana de 7 filas independientes:

- **Nivel SESIÓN**: igual para los 10 cubos, con prioridad absoluta sobre
  cualquier estado individual. Un cambio de nivel sesión se manda como un
  solo mensaje de difusión (`id:"all"`).
- **Nivel CUBO**: solo se evalúa cuando la sesión está en juego normal
  (`inactivo`/`jugando`, es decir, ningún nivel sesión especial en curso).
  Cada cubo resuelve su propio estado de forma independiente.

Dos de las condiciones (movimiento inválido, cuenta regresiva) son
**pulsos transitorios**: secuencias de un solo mensaje (`EF=<n>`) que corren
enteras dentro del cubo y se superponen un instante sobre el nivel que
corresponda, sin ser parte del estado "sostenido" — al terminar, devuelven
el control al nivel que estuviera vigente antes.

## Tabla de prioridad (máxima a mínima)

| # | Condición | Nivel | Alcance | Comando físico | Firmware |
|---|---|---|---|---|---|
| 1 | Bloqueo (sin movimientos válidos) | Sesión | Los 10 cubos | `EF=4` | ya existía |
| 2 | Victoria | Sesión | Los 10 cubos | `EF=5` | ya existía |
| 3 | Cuenta regresiva (tick 3,2,1 / ¡Inicia!) | Sesión (pulso) | Los 10 cubos | `EF=6` / `EF=7` | ya existía |
| 4 | Sesión pausada (botón "Pausar", control de partida) | Sesión | Los 10 cubos | `M=` color Pausar | ya existía |
| 5 | Movimiento inválido | Cubo (pulso) | El cubo implicado | `EF=3` | ya existía |
| 6 | Señal PPA manual (Pausar/Pensar/Actuar del operador) | Cubo | El cubo seleccionado | `M=` color de fase | ya existía |
| 7 | Color de equipo en reposo | Cubo | Cualquier otro cubo | `M=` color de equipo | ya existía |

**No hace falta ningún código `EF=` nuevo en el firmware** — las 5
condiciones pedidas por el autor (color de equipo en reposo, movimiento
inválido, bloqueo, victoria, cuenta regresiva/sesión activa), más las 2 que
ya existían sin estar nombradas explícitamente (señal PPA manual, sesión
pausada), caben todas en primitivas que el motor de efectos de
`Cubo_Esclavo_v3.ino` ya tenía antes de este cambio. El cambio es de
arquitectura del frontend, no de protocolo — el transporte (TCP, sockets
persistentes maestro-cubo, cola de comandos del backend) queda exactamente
igual que en la Fase 1.

## Decisiones validadas con el autor (2026-09-18)

1. **Pausa global vs. señal PPA manual**: la pausa global (nivel sesión) SÍ
   cancela cualquier señal PPA manual en curso en cualquier cubo — mientras
   la sesión esté pausada, ningún cubo puede mostrar una señal individual.
   Al reanudar (`reanudarJuego`), la señal PPA manual **no se restaura
   sola** — se parte de cero (`setCubeActions({})` explícito).
2. **Comando `"restaurar"`**: se retira su disparo automático (antes en
   `handleStateChange`, en cada evento de posición del tablero — causa del
   bug del 2026-09-18). El resolutor manda siempre el color de equipo
   explícito (`M=...`) cuando ese es el estado resuelto. `"restaurar"` sigue
   existiendo en el firmware, solo para uso manual/depuración por Monitor
   Serial.
3. **Movimiento inválido vs. señal PPA manual en el mismo cubo**: el
   destello de inválido (`EF=3`, ~1s) interrumpe la señal PPA manual y, al
   terminar, la restaura si su propio temporizador de 5s no había expirado
   — no se pierde información, solo se pospone un segundo.

## Simplificación deliberada: reinicio manual reutiliza el mismo `EF=4` que el bloqueo real

`reiniciarJuego()` (botón "Reiniciar") pone la sesión en el mismo estado
`bloqueado` que la detección real de bloqueo, en vez de mandar un blanco
plano aparte como hacía antes de este cambio. Efecto práctico: un reinicio
manual ahora también reproduce la breve animación de alarma (rojo
descendente) de `EF=4` antes de quedar en blanco, en vez de quedar en blanco
al instante. Se decidió así para no bifurcar el criterio de prioridad en dos
variantes distintas de "blanco, pide reordenar" — si el autor prueba esto
contra hardware real y prefiere el blanco instantáneo del reinicio manual,
es un ajuste de una sola línea (un tier de sesión nuevo, p. ej. `'reinicio'`,
con su propio comando en `sustainedVisualToCommand`).

## Implementación

- **Frontend**: `front-juego-acacia/src/core/ppa/cubeVisualState.ts` — única
  implementación de esta tabla. `App.tsx` ya no manda comandos imperativos
  sueltos: todos los manejadores (`handleStateChange`, `sendAction`,
  `pausarJuego`, `reanudarJuego`, `reiniciarJuego`, `apagarSenal`, el efecto
  de victoria/derrota, el efecto de reorden) solo cambian estado de React
  (`sessionState`, `cubeActions`, `flashCubeId`, `countdownTick`); dos
  efectos de despacho (nivel sesión, nivel cubo) y dos efectos de pulso
  (inválido, cuenta regresiva) son los ÚNICOS puntos que hablan con el
  socket. `Cube.tsx` recibe un único prop `visual` (mismo resultado que se
  usó para el comando físico) en vez de tres props independientes
  (`color`/`action`/`flashColor`) que él mismo reconciliaba por su cuenta.
- **Firmware**: sin cambios funcionales en `Cubo_Esclavo_v3.ino` ni en
  `Maestro_v3.ino` — ambos ya sabían ejecutar cualquier `EF=<n>`/`M=...`
  como reemplazo atómico y completo del estado anterior, que es exactamente
  el contrato que este diseño necesita de ellos. Se agregó solo un
  comentario en `Cubo_Esclavo_v3.ino` señalando esta tabla como referencia.

## Estado de verificación

- ✅ `npm run build` (`tsc -b && vite build`) del frontend, limpio.
- ✅ `arduino-cli compile` de `Cubo_Esclavo_v3.ino` contra
  `esp32:esp32:esp32c3`, sin cambios funcionales por verificar (solo un
  comentario nuevo).
- ⏳ **Sin verificar contra hardware real.** Ninguna de las 7 condiciones de
  la tabla se ha probado todavía con los cubos físicos bajo este resolutor
  — la prueba pendiente es la misma que ya estaba registrada en
  `PENDIENTES_TESIS.md` ("Verificar el motor de efectos del cubo... contra
  hardware real"), ahora bajo la arquitectura nueva. Antes de dar esto por
  cerrado hace falta, con los cubos conectados: (1) un movimiento inválido
  con una señal PPA manual activa en el mismo cubo (confirmar que la señal
  se restaura tras el destello); (2) pausar la partida con una señal PPA
  manual activa (confirmar que la pausa la tapa y que no vuelve sola al
  reanudar); (3) un reinicio manual (confirmar si la animación de `EF=4` es
  aceptable o se prefiere blanco instantáneo, ver sección de arriba); (4)
  un cubo que se desconecta y reconecta en medio de un bloqueo/victoria/
  pausa (confirmar que al reconectar refleja el estado de sesión vigente,
  no el color de equipo).
