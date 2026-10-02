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
| 8 | Conectado al maestro, sin confirmar (arranque) | Cubo | El cubo recién conectado | ninguno hasta la confirmación | **naranja** (nuevo, 2026-09-18) |
| — | Sin WiFi / reconectando | Solo firmware | El cubo afectado | ninguno (lo decide el cubo solo) | **magenta** (antes rojo) |

**Fila 8**: en la práctica no compite con las demás, porque solo existe
*antes* de que el frontend confirme al cubo — una vez confirmado, entra al
mismo criterio que cualquier otro cubo (fila 7 en adelante). No hizo falta
insertarla como prioridad 7.5 formal: el firmware la aplica por su cuenta al
arrancar, y el frontend la reemplaza con un `M=` normal en cuanto puede.

**Fila "Sin WiFi"**: fuera de la tabla de prioridad del frontend, porque un
cubo sin WiFi no puede recibir ningún comando — el propio firmware se pone
magenta mientras reconecta y vuelve solo a su color de equipo al conectar.

**No hace falta ningún código `EF=` nuevo en el firmware** — las 5
condiciones pedidas por el autor (color de equipo en reposo, movimiento
inválido, bloqueo, victoria, cuenta regresiva/sesión activa), más las 2 que
ya existían sin estar nombradas explícitamente (señal PPA manual, sesión
pausada), caben todas en primitivas que el motor de efectos de
`Cubo_Esclavo_v3.ino` ya tenía antes de este cambio. El cambio es de
arquitectura del frontend, no de protocolo — el transporte (TCP, sockets
persistentes maestro-cubo, cola de comandos del backend) queda exactamente
igual que en la Fase 1.

## Naranja de arranque y confirmación de conexión (2026-09-18)

Diagnóstico de la sesión anterior: el PPA sí llegaba bien al backend, pero
el maestro no lo recogía porque el enlace maestro↔backend se había caído
("Base física desconectada" en la consola del backend) — no era un bug del
resolutor. Con eso resuelto (y el maestro reiniciado), el autor pidió un
requisito nuevo, no una corrección: que el color de equipo **no** sea el
valor por defecto del cubo. En su lugar:

- El cubo arranca (y se queda) en **naranja fijo** en cuanto conecta al WiFi
  del maestro — distinto del **magenta** de "sin WiFi" (fila de arriba, sin
  cambios): magenta es "no tengo WiFi todavía/lo perdí"; naranja es "tengo
  WiFi con el maestro, pero el sistema completo (maestro+backend+frontend)
  todavía no me confirmó nada".
- Solo pasa a su color de equipo (azul/rojo) cuando el **frontend** lo
  confirma explícitamente, en cuanto lo ve reportado en `esclavosConectados`
  — no antes, y no por su cuenta.
- Este mecanismo es **autocorregible**: el efecto de despacho de nivel cubo
  ahora itera sobre `esclavos` (los cubos realmente conectados, no los 10
  virtuales) y depende de ese estado — si un cubo se reconecta después de
  un corte del enlace maestro↔backend, sin que nadie reintente nada, recibe
  su confirmación de nuevo en el siguiente ciclo. `sendSustainedAll` marca
  como "ya confirmados" solo a los cubos que estaban conectados en el
  momento de una difusión de sesión (bloqueo/victoria/pausa), para no
  duplicar mensajes con el efecto de nivel cubo.
- **No hizo falta tocar `Maestro_v3.ino`**: es un relevo genérico (reenvía
  `id`/`color`/`vibrationIntensity`/`iluminationFrequency` tal cual), no
  necesita saber qué significa "confirmación".

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

## Ajustes tras la prueba con hardware real (2026-09-18, misma fecha)

Con los cubos conectados, el autor reportó dos fallas: (1) el PPA enviado
desde el frontend no hacía **nada** en el cubo (ni luz ni vibración), cuando
en el commit anterior a este resolutor sí funcionaba; (2) los cubos no se
veían azules/rojos por equipo. Pidió explícitamente quitar condicionales
del momento de conexión y dejar solo lo esencial: 5 azules + 5 rojos
siempre, y Pausar/Pensar/Actuar funcionando. Cambios (sin verificar todavía
contra hardware):

1. **PPA con envío directo**: `sendAction()` y `apagarSenal()` vuelven a
   mandar el comando en el mismo clic (como antes de este resolutor), en
   vez de delegarlo a un efecto posterior condicionado al estado de sesión.
   Se envía **forzado**: un clic del operador siempre sale al cable, aunque
   sea la misma señal repetida.
2. **El color de equipo lo maneja solo el cubo**: el frontend ya no le
   reenvía el color de equipo al conectar ni al cargar la página — el
   firmware ya se lo asigna solo desde su IP (`192.168.4.2`..`.6` = cubos
   1-5 azules, `.7`..`.11` = cubos 6-10 rojos). Única excepción: un cubo que
   se reconecta en medio de un bloqueo/victoria/pausa recibe esa señal de
   sesión. El frontend solo manda eventos extraordinarios.
3. **"Sin WiFi" pasa de rojo a magenta** en el firmware: el rojo era idéntico
   al del equipo B, así que un cubo rojo reconectando se confundía con uno
   rojo conectado y bien — probable causa de "no se ven azules/rojos"
   durante la estabilización.
4. **Bug del motor corregido**: el maestro manda la vibración como `M=0.00`
   y el cubo comparaba contra el texto `"0.0"`; nunca coincidían, así que
   el motor quedaba a PWM 50 (~20%) cada vez que un cubo volvía a reposo.
   Ahora se compara como número (`aplicarVibracion`, ya existente).

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

- ✅ **PPA confirmado en el backend (2026-09-18)**: el comando llega con el
  payload correcto (color/vibración/frecuencia de la fase enviada). El
  bloqueo real era el enlace maestro↔backend ("Base física desconectada"),
  no el resolutor — ver PENDIENTES_TESIS.md.
- ✅ `npm run build` (`tsc -b && vite build`) del frontend, limpio (incluye
  el cambio del 2026-09-18: efecto de nivel cubo por `esclavos`).
- ✅ `arduino-cli compile` de `Cubo_Esclavo_v3.ino` contra
  `esp32:esp32:esp32c3`, sin errores (incluye el naranja de arranque del
  2026-09-18).
- ⏳ **Sin verificar contra hardware real** lo siguiente, todo pendiente de
  reflashear los 10 cubos y probar con el maestro real: (1) que el cubo
  arranque en naranja y pase a su color de equipo solo al confirmarse
  conectado; (2) que el PPA sí llegue al cubo físico ahora que el enlace
  maestro↔backend está sano; (3) un movimiento inválido con una señal PPA
  manual activa en el mismo cubo (debe interrumpir y restaurar); (4) pausar
  la partida con una señal PPA manual activa (debe taparla sin restaurarla
  sola); (5) un cubo que se desconecta y reconecta en medio de un bloqueo/
  victoria/pausa (debe confirmarse con esa señal, no con el color de
  equipo); (6) un corte real del enlace maestro↔backend seguido de
  reconexión, para confirmar que los cubos que quedaron a medio confirmar
  se resuelven solos al volver la conexión.
