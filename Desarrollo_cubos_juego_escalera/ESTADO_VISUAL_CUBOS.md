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
| 4 | Sesión pausada (botón "Pausar") **o pausa automática por jugada inválida** (`correccion`, 2026-10-15) | Sesión | Los 10 cubos | `M=` color Pausar | ya existía |
| 5 | Movimiento inválido | Cubo (pulso) | El cubo implicado | `EF=3` | ya existía |
| 5b | Fuera de lugar (solo antes de iniciar, 2026-10-15) | Cubo | Cada cubo que no está en su casilla | `M=` blanco fijo | sin cambios (es un `M=`) |
| 6 | Señal PPA manual (Pausar/Pensar/Actuar del operador) | Cubo | El cubo seleccionado | `M=` color de fase | ya existía |
| 7 | Color de equipo en reposo | Cubo | Cualquier otro cubo | `M=` color de equipo | ya existía |
| ~~8~~ | ~~Conectado al maestro, sin confirmar (arranque)~~ | — | — | — | **naranja retirado (2026-10-15)**: el cubo arranca directo en su color de equipo |
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

## Identificación por IP, estado real al cargar y pausa automática (2026-10-15)

Tres requisitos del autor tras probar con los cubos:

1. **Color de equipo siempre visible** (1-5 azul, 6-10 rojo, por la IP de
   cada cubo). Se retira el naranja de "esperando confirmación": dejaba
   cubos sin color de equipo cada vez que la confirmación del frontend no
   llegaba. Ahora el cubo se asienta solo en su color al conectar el WiFi, y
   el frontend le reafirma el estado vigente cada vez que lo ve (re)conectar.
2. **Jugada inválida = pausa automática** hasta volver a la posición
   anterior: estado de sesión `correccion` (mismo aspecto que la pausa
   manual, los 10 cubos en Pausar), cronómetro detenido, y en pantalla el
   tablero al que hay que volver con la lista "cubo #X: está en la casilla a
   → va en la casilla b". La jugada inválida no entra al recorrido del grafo
   ni cambia la "posición anterior" de la Regla 2. Solo con un intento en
   curso: sin intento (antes de iniciar, o reordenando tras un bloqueo/
   victoria), mover cubos ya no se evalúa como jugada.
3. **Recargar con los cubos en desorden ya no los da por ordenados.** Causa
   real: el frontend arrancaba con `[1..5,0,6..10]` fijo y nunca le
   preguntaba a nadie cómo estaba el tablero. Ahora (a) el backend guarda el
   último tablero reportado y se lo entrega a cada pestaña que se conecta;
   (b) el frontend pide `solicitarEstado` al montar y el maestro reporta el
   tablero que lleva (`reportarPosiciones`); (c) antes de iniciar, si hay
   cubos fuera de lugar, se ven en blanco en físico y en pantalla, con la
   casilla a la que va cada uno.

**Identificación por IP (canal de posición).** La base solo lee presencia
(1/0) por casilla; qué cubo hay en cada una se infiere siguiendo cada
levantar/apoyar desde un orden supuesto — si el maestro arranca con los
cubos en desorden, esa inferencia nace equivocada. Para saberlo de verdad,
el maestro le manda `ID=0` a un cubo concreto (por su IP), el cubo baja su
pin de presencia (`Pfcaja`) 250 ms y el maestro anota qué casilla pasó a 0.
Si todas las casillas ocupadas quedan identificadas, ese resultado
reemplaza al inferido. Se hace sola al cargar Control y al pulsar "Iniciar
intento" (la cuenta regresiva arranca solo si el orden es correcto), y a
mano con "Identificar cubos". **Supuesto sin verificar**: que el pin de
presencia que lee la base sea el mismo `Pfcaja` que el cubo pone en HIGH
(así lo sugiere el firmware: el cubo lo activa al arrancar y la base lo lee
como entrada). Si no fuera así, la ronda queda "incompleta", no reemplaza
nada y se avisa en pantalla — el resto sigue funcionando con el orden que
lleva el maestro.

**Bug preexistente corregido de paso**: el socket del frontend se conecta
al cargar la app, antes de que Control se monte (tras la pantalla de
perfiles), así que el aviso "base conectada" del backend se perdía y
Control mostraba "Desconectado" con la base activa. El backend ahora lo
reenvía al recibir `solicitarEstado`. También: el cubo levantado y sus
casillas válidas se calculaban sobre el tablero inicial (closure congelada
en el listener del socket); ahora sobre el último tablero asentado.

**Verificado sin hardware** con un maestro simulado (script que hace de
ESP32 contra el backend real y el frontend compilado, manejado con
Playwright): 18 comprobaciones de los tres requisitos, incluidos los
comandos exactos que reciben los cubos. **Pendiente con hardware real**: la
ronda de identificación (supuesto eléctrico de arriba) y todo lo demás
contra los 10 cubos físicos.

## Posiciones que no llegaban, animaciones y Vista del jugador (2026-10-16)

Tras probar con los cubos (PPA, pausa global y cuenta regresiva sí llegan;
las posiciones no aparecían ni en el backend ni en el frontend):

1. **El maestro ahora informa lo que la base VE** (`presencia`, 1/0 por
   casilla) en cada mensaje, y también cuando solo cambia la presencia
   (`origen: "presencia"`). Antes solo informaba la identidad inferida: si la
   base no detectaba un cubo no salía nada y era imposible saber si fallaba
   el cableado, la lectura o el seguimiento. Control muestra una barra bajo
   cada casilla (azul = la base detecta un cubo) y avisa cuando la lectura
   no cuadra con el seguimiento. En el Monitor Serial del maestro salen las
   dos líneas, `Estado` y `Presencia`, lado a lado.
2. **Seguimiento con varios cubos en la mano**: se reemplazó la máquina de
   "un solo cubo levantado" (`eventoPendiente`), que perdía el hilo si se
   levantaba un segundo cubo antes de apoyar el primero.
3. **Identificación sin bloquear**: si los 3 primeros cubos no bajan ninguna
   casilla con `ID=0`, la ronda se aborta (~1,5 s en vez de ~7 s bloqueando
   la red del maestro — causa probable del "PPA algo lento").
4. **Conexión del frontend** (`client-socket/sockets.ts`, `App.tsx`), tres
   fallas reales: (a) tras 5 reintentos fallidos el socket se rendía para
   siempre (ahora reintenta sin límite en local, a los 300 ms); (b) el
   arranque por long-polling HTTP daba 400 al pasar a websocket (ahora solo
   websocket); (c) `socket.connect()` en cada render mandaba un segundo
   "connect" y el servidor cerraba la conexión (cierre limpio 1005 a los
   ~120 ms, visto al recargar). Las tres hacían perder posiciones en silencio.
5. **Animaciones** (`components/control/TableroFisico.tsx`): el cubo
   levantado sube y flota sobre su casilla; al apoyarlo se desliza a la
   casilla nueva (~250 ms, Web Animations API, sin retrasar el estado real).
6. **Vista del jugador** (`components/jugador/VistaJugador.tsx`): pestaña y
   ventana aparte (`?vista=jugador`, para un segundo monitor), solo con
   cubos, tiempo (opcional, lo decide el operador), conexión y qué hacer
   tras una jugada inválida. Sin señales PPA, medidores, bitácoras, grafo
   ni casillas válidas resaltadas: en un Mago de Oz el participante no debe
   ver la consola del operador. Recibe el estado de Control por
   `BroadcastChannel`, sin otra conexión al backend.

**Reglas**: auditado — Control, Tutorial, Simulación libre y Control
simulado usan el mismo motor (`laEscaleraRules`, `classifyAttempt`).

**Verificado sin hardware** con maestro simulado + Playwright: 26
comprobaciones, 4 corridas seguidas sin fallas ni caídas de conexión.

## Batería, latencia, EEG y bitácora en disco (2026-10-16, 2ª parte)

Lo que faltaba para una sesión real (detalle operativo en
`GUIA_ENSAYO_SESION.md`):

1. **Telemetría de cada cubo** (`Cubo_Esclavo_v3.ino`): cada 5 s manda
   `EST=mv,rssi,reinicio,segundos` por su socket. El maestro la lee sin
   bloquear (`leerEsclavos`) y la agrega a su reporte de esclavos; el
   backend la reenvía. Control muestra un panel "Cubos · conexión y señal"
   (`components/control/PanelCubos.tsx`) y anota en la bitácora
   `reinicio_cubo` (con el motivo: una caída de tensión apunta a la
   batería). **La medición de batería quedó desactivada en esta versión**
   (`BATERIA_PIN = -1`, decisión del autor: no modificar los cubos). Todo lo
   demás ya la soporta — pila bajo cada cubo, aviso < 20 %, `bateria_baja` —
   y aparece sola al soldar un divisor 100k/100k a GPIO1 y poner
   `BATERIA_PIN = 1` (próxima versión, ver `GUIA_ENSAYO_SESION.md` §2). No
   se muestra en la vista del jugador.
2. **Latencia medida**: el maestro sella cada evento (`edadMs`: lo que
   esperó en el maestro; `rttMs`: lo que tardó el POST anterior), el backend
   pone la hora de llegada (`tsBackend`) y Control calcula cubo → pantalla
   (antirrebote incluido): última, mediana y p95 en el panel lateral.
3. **Marcadores EEG** (`core/control/marcadoresEeg.ts`): inicio, "¡YA!",
   cubo levantado, jugada válida/inválida, pausas, señales PPA, fin. Las
   jugadas llevan la hora física estimada, no la de llegada. Se descargan
   en CSV y se alinean con el archivo del OpenBCI GUI con
   `herramientas/sincronizar_eeg.py` (salida importable en EEGLAB).
4. **Bitácora continua en disco**: cada evento, decisión y marcador se
   agrega al instante a `Backend-Cubos-Inteligentes-main/bitacoras/<sesión>.jsonl`
   (en `.gitignore`: datos de participantes).
5. **Ventana minimizada**: los temporizadores de la sesión (cuenta
   regresiva, apagado automático PPA, pulso de inválido, identificación,
   cronómetro) corren en un Web Worker y no se frenan en segundo plano;
   Control y la vista del jugador piden mantener la pantalla encendida.
6. **Base**: pulldown interno en las 8 casillas que lo permiten; las
   casillas 1-3 (GPIO 39/34/35) no lo tienen y dependen de la base. Botón
   **Probar base** en Control: levantar y apoyar cada casilla hasta 11/11.

**Verificado sin hardware** (maestro simulado + Playwright): 34
comprobaciones, 2 corridas seguidas sin fallas. El script de
sincronización se probó con `Sesión 1.txt` real (125,09 Hz medidos).

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
