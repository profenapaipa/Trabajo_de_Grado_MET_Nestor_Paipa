# Auditoría y rediseño de la interfaz — Consola de sesión

*Versión 2 (2026-09-18). Reemplaza por completo la versión anterior de este documento (2026-09-02, nunca aprobada ni commiteada): esa versión proponía una base "instrumento de laboratorio" genérica con paleta navy+mostaza; tras confirmar con el autor, se descarta entera y se reconstruye desde cero sobre una referencia distinta y más concreta — ver §0. Documento de planeación. No implica ningún cambio de código.*

---

## 0. Qué cambió desde la versión 1, y por qué este documento es nuevo, no un parche

Entre el 2026-09-02 y hoy hubo 2 commits de trabajo real contra hardware (`fc1233c`, `1400a7e`): se corrigió la latencia maestro↔cubos, se probó por primera vez contra hardware físico, y se agregó **control de partida completo** (botones Iniciar / Pausar-Reanudar / Reiniciar, cuenta regresiva sincronizada de 3-2-1, cronómetro de sesión, código de colores físico del estado del juego) implementado con un **resolutor único de estado visual** (`core/ppa/cubeVisualState.ts`, documentado en `Desarrollo_cubos_juego_escalera/ESTADO_VISUAL_CUBOS.md`). `App.tsx` pasó de 698 a 1058 líneas; `Cube.tsx` de 156 a 173. La versión 1 de este documento cita líneas que ya no existen donde decía — por eso esta versión se reaudita contra el código de hoy en vez de parchear la anterior.

Se confirmaron 4 decisiones con el autor antes de escribir esto:

1. **Referencia visual**: **monitor clínico** (monitor de signos vitales de UCI) — no "instrumento de laboratorio" genérico. Números grandes tipo LCD para las lecturas críticas, fondo grafito, franjas horizontales bien delimitadas, identidad por color de canal más que por severidad.
2. **Base técnica**: se descarta entera la de la versión 1 (tokens navy+mostaza, contraste ya calculado) — todo se recalcula desde cero para la nueva referencia (§5).
3. **Alcance**: reauditar primero el código actual (esta sección + §3-4) antes de proponer el lenguaje visual nuevo.
4. **Pestañas**: las 3 a la vez (Control Mago de Oz, Simulación, Vista de observador).

Nota de alcance real: de los 13 archivos de vista, **solo `App.tsx` y `Cube.tsx` cambiaron** desde la versión 1 (confirmado con `wc -l`: los otros 11 archivos tienen exactamente el mismo número de líneas que hace 16 días). El diagnóstico de Simulación/Observador de la versión 1 (inventario, patrones de UI) sigue siendo válido tal cual y se reincorpora aquí sin reauditar dos veces; lo que sigue en §1-4 es evidencia **fresca**, releída hoy, para `App.tsx`/`Cube.tsx` y para el estado de cumplimiento de las reglas duras.

---

## 1. Contexto verificado (actualizado)

Todo lo de la versión 1 sigue siendo cierto y verificado — stack React+TS+Vite, sin Next.js, Tailwind v4 instalado pero sin usar en ningún componente real (`components.json` sigue siendo el boilerplate de shadcn/ui sin tocar), sin vista dirigida al niño, `index.html` sigue cargando Manrope desde Google Fonts en runtime. No se repite la tabla completa aquí; ver versión archivada en el historial de git de esta conversación si hace falta el detalle. Lo nuevo:

- **`Cube.tsx` ahora recibe un único prop `visual`** (`{ hex, accion?, pulso? }`) en vez de tres props sueltos — el propio componente ya no reconcilia nada, solo pinta lo que el resolutor decidió (`Cube.tsx:52`). Esto es una mejora real de arquitectura que **facilita** el rediseño: hay un solo punto (`resolveCubeDisplay` en `cubeVisualState.ts`, consumido en `App.tsx:857-859`) donde theming y lógica de color convergen.
- **7 estados de sesión ahora, no un solo flag de "jugando"**: `inactivo`, `cuenta_regresiva`, `jugando`, `pausado`, `bloqueado`, `victoria` (ver `SessionState` en `cubeVisualState.ts`), más el pulso de movimiento inválido — el sistema de estados visuales de la sección 5 tiene que cubrir estos 7, no los 5 genéricos que proponía la versión 1.
- **Colores oficiales del PPA confirmados por su propio código, con los valores exactos que se transmiten al hardware** (visibles en pantalla, `App.tsx:948`): Pausar `rgb(0,191,255)` (celeste), Pensar `rgb(255,255,102)` (amarillo pálido), Actuar `rgb(0,255,0)` (verde puro). Esto sigue sin resolver si el swatch en pantalla puede desviarse del valor físico — pregunta abierta, §8.

---

## 2. Restricciones duras — cumplimiento actual medido (releído hoy)

| Regla | Estado actual | Evidencia fresca |
|---|---|---|
| 1. Cero animaciones decorativas / transiciones ≤150ms | **Sigue incumpliendo, sin cambios**: 7 declaraciones de `transition` en `App.tsx`+`Cube.tsx`, ninguna ≤150ms | `App.tsx:582,590,916,960,1000`; `Cube.tsx:91,137` — valores entre 200ms y 400ms |
| 2. Alto contraste sí, saturación alta no | **Empeoró**: se sumaron 2 colores saturados nuevos (`#00e5a0` verde-agua para casillas de movimiento legal, `#00f0ff` cian para el destello de cuenta regresiva) a los ya existentes `#22c55e`/`#ef4444` — 20 ocurrencias combinadas en `App.tsx`+`Cube.tsx` | `Cube.tsx:63`; `App.tsx:754` (`#00f0ff`); conteo completo por grep |
| 3. Acciones críticas en 1 clic, sin scroll | **Empeoró, medido con Playwright hoy**: los 3 botones Pausar/Pensar/Actuar ahora quedan fuera del pliegue **incluso en 1920×1080** (antes solo fallaba en 1366×768) | Ver §3.2 — medición nueva, no la de la versión 1 |
| 4. No tocar Socket.IO / lógica / tiempos | Cumple — este documento sigue sin proponer ningún cambio de comportamiento | — |
| 5. Tipografías autohospedadas, cero CDN runtime | **Sigue incumpliendo**: `index.html:8-10` sin cambios, Google Fonts en runtime | Releído hoy, idéntico a la versión 1 |
| 6. Diseño congelado tras aprobación | N/A — esta es la versión que se somete a aprobación | — |

### 2.1 Above-the-fold, remedido hoy contra el código actual

La tarjeta nueva "Control de partida" (`App.tsx:693-759`, con sus botones Iniciar/Pausar/Reiniciar, cronómetro y overlay de cuenta regresiva) se insertó *antes* del tablero, empujando todo lo de abajo. Medición real con Playwright, misma metodología que la versión 1:

| | Alto total de contenido | Botones PPA (Pausar/Pensar/Actuar) | ¿Caben sin scroll? |
|---|---:|---|:---:|
| **Versión 1 (2026-09-02)** — 1366×768 | 1395px | y: 820–959 | ❌ |
| **Versión 1 (2026-09-02)** — 1920×1080 | 1395px | y: 820–959 | ✅ (cabían justo) |
| **Hoy (2026-09-18)** — 1366×768 | **1522px** (+127px) | y: **946.5–1085.5** | ❌ |
| **Hoy (2026-09-18)** — 1920×1080 | **1522px** | y: **946.5–1085.5** | ❌ **(antes cabían, ahora no)** |

Captura de pantalla a 1920×1080 tomada hoy: los 4 botones (Pausar/Pensar/Actuar/Estado inicial) aparecen cortados en el borde inferior, con el subtítulo `rgb(...)/%vibr/tono` fuera del área visible. El problema que la versión 1 documentó ya no es solo "pasa en la resolución chica" — pasa en las dos.

---

## 3. Diagnóstico de UX — actualizado

### 3.1 Inventario (solo filas que cambiaron; el resto de la tabla de la versión 1 sigue vigente sin cambios)

| Ruta | Responsabilidad | Cambio desde v1 |
|---|---|---|
| `src/App.tsx` | Ahora también: control de partida completo (Iniciar/Pausar/Reanudar/Reiniciar), cuenta regresiva sincronizada, cronómetro de sesión, resaltado en vivo de movimientos legales sobre el tablero físico | +360 líneas — nueva tarjeta completa insertada antes del tablero |
| `src/components/Cube.tsx` | Recibe un único prop `visual` en vez de 3 sueltos; nuevo estado de "casilla vacía = movimiento legal ahora" con anillo verde-agua saturado | Refactor de props, mismo aspecto exterior salvo el nuevo anillo |
| `src/core/ppa/cubeVisualState.ts` (nuevo) | Resolutor de estado visual, tabla de prioridad de 2 niveles (sesión > cubo) | No es UI, pero es la fuente de verdad que el nuevo sistema de estados de §5 debe reflejar 1:1 |

### 3.2 Jerarquía visual — el problema de la v1 persiste y se agrava

La tarjeta "Control de partida" es, junto con el tablero y los botones PPA, uno de los 3 elementos genuinamente críticos de la pantalla (empezar/pausar/reiniciar una sesión grabada con EEG puesto no es un dato secundario). Pero hoy compite por espacio con la misma jerarquía plana que ya señalaba la v1: mismo componente `card` que "Cubos esclavos", que los 4 stat-cards de solo lectura, que "Condición acumulada por fase" — 4 tarjetas de peso visual idéntico antes de llegar al tablero, y ahora una quinta antes de eso. El cronómetro de sesión (`App.tsx:706`, `fontSize: '22px'`) — un dato que el operador necesita leer de un vistazo mientras mira al niño — es más pequeño que el valor de cualquier stat-card de la fila de abajo (`fontSize: '24px'`, `App.tsx:810`) y bastante más chico que el título "Escalera Inteligente" del encabezado (`fontSize: '20px'`, pero con `fontWeight:700` y posición dominante).

### 3.3 Nuevo: la cuenta regresiva es la única animación de la app que SÍ tiene identidad — y por eso vale la pena estudiarla antes de descartarla

El overlay de cuenta regresiva (`App.tsx:749-758`) es, con diferencia, el elemento más "propio" de toda la interfaz: número gigante (56px), *glow* de texto, fondo oscurecido — el único momento donde la pantalla deja de parecer un dashboard genérico y se siente como una cuenta regresiva real. No incumple la regla de 150ms (no es una transición CSS, son 4 timeouts de 1s cada uno con un cambio de contenido discreto, no una animación continua), pero sí usa 2 colores saturados nuevos (`#00f0ff` cian, `#22c55e` verde) fuera del sistema. Es una buena base para la identidad "monitor clínico" de §5 — no hay que quitarle el impacto, hay que resolverlo con la paleta nueva en vez de colores sueltos.

---

## 4. Diagnóstico de UI — patrones nuevos desde la v1

Todo lo de la v1 (tarjeta triplicada, 10 radios de borde sin escala, 3 gradientes decorativos, `maxWidth`+`margin:auto` inconsistente, espaciado sin sistema) sigue exactamente igual en los 11 archivos que no cambiaron, y sigue igual también en las partes de `App.tsx` que no se tocaron. Lo nuevo, releído hoy:

- **2 colores saturados adicionales** que no existían en la v1: `#00e5a0` (verde-agua, anillo de "movimiento legal", `Cube.tsx:63`) y `#00f0ff` (cian, glow de cuenta regresiva, `App.tsx:754`) — se suman a los `#22c55e`/`#ef4444` ya señalados. La app tiene ahora **6 colores saturados de estado distintos** conviviendo sin relación entre sí (verde éxito, rojo error, celeste/amarillo/verde PPA, verde-agua movimiento legal, cian cuenta regresiva) — exactamente el tipo de "ruido cromático sin sistema" que hace que una interfaz se vea generada sin dirección de arte, más allá de si cada card es redondeada o no.
- **El emoji sigue siendo el ícono canónico del cubo** (`Cube.tsx:11,17,23`, sin cambios) — convive con `lucide-react`, que además ahora importa 4 íconos nuevos (`Play`, `RotateCcw`, `PauseCircle`, `PlayCircle`, `App.tsx:11`) para los botones de control de partida, reforzando que el propio código YA reconoce que lucide-react es el sistema de íconos correcto — solo no se aplicó de vuelta a `Cube.tsx`.
- **El overlay de cuenta regresiva es `position:absolute` con `zIndex:5` sobre una tarjeta con `position:relative`** (`App.tsx:694,751`) — es la única superposición modal-like de toda la app; el resto de la interfaz no tiene ningún patrón de overlay, así que este es, sin proponérselo, un precedente de un lenguaje visual "de instrumento" (algo se apodera de la pantalla momentáneamente) que vale la pena generalizar, no aislar.

---

## 5. Propuesta de Design System — monitor clínico

### 5.1 Referencia y argumento

Un monitor de signos vitales (el tipo de pantalla que ya está en la misma sala durante una sesión real — el mismo lenguaje visual que un profesional de salud ya sabe leer en un vistazo) resuelve exactamente el problema de esta consola: **varios canales de datos que hay que leer sin mirar fijo, cada uno con su propio color de identidad, sobre un fondo neutro que no compite por atención**. La convención real de estos monitores (Philips, GE, Draeger, Mindray) no es "todo en rojo si algo importa" — es lo opuesto: cada parámetro tiene un color fijo que lo identifica (la frecuencia cardíaca siempre verde, la saturación de oxígeno siempre cian, etc.), y el color solo escala en urgencia mediante alarmas puntuales (bordes, texto, sonido), nunca como decoración de fondo.

Esto encaja con algo que ya existe en el código y nadie diseñó a propósito: **Pausar/Pensar/Actuar ya tienen 3 colores fijos que son, literalmente, sus 3 canales de señal física** (celeste/amarillo/verde, transmitidos tal cual al LED del cubo). La propuesta central de este Design System es tratar esos 3 colores como los **únicos colores con significado** de toda la interfaz — el resto de la pantalla (fondo, texto, botones de control de partida, tablero, bitácoras) se vuelve **deliberadamente monocromático** (grafito + blanco + grises), para que cuando algo aparece en celeste, amarillo o verde, el operador sepa sin pensar que es una señal PPA real, no un botón cualquiera. Es lo opuesto exacto de la situación actual, con 6 colores saturados sin relación compitiendo entre sí (§4).

### 5.2 Tokens — bloque `@theme` de Tailwind v4

```css
@theme {
  /* ── Base monocromática — grafito, no negro puro ── */
  --color-graphite-900: #0B0F10; /* fondo de la app */
  --color-graphite-800: #161D1F; /* fondo de franja/panel */
  --color-graphite-700: #232C2F; /* división entre franjas, hairlines */
  --color-graphite-600: #3A464A; /* borde de controles en reposo */

  --color-paper-100: #E7EDEE; /* texto primario */
  --color-paper-300: #9FB0B3; /* texto secundario / etiquetas */
  --color-paper-500: #647275; /* texto terciario / metadatos, timestamps */

  /* ── Único acento neutro, para todo lo que NO es una señal PPA
     (Iniciar/Pausar/Reiniciar, foco, selección) ── */
  --color-signal-neutral: #CFE8EC; /* blanco-cian muy pálido, casi acromático */

  /* ── Los 3 colores PPA — protegidos, se usan solo para su propia señal ── */
  --color-ppa-pausar: #00BFFF; /* rgb físico exacto enviado al cubo */
  --color-ppa-pensar: #FFFF66; /* rgb físico exacto enviado al cubo */
  --color-ppa-actuar: #00FF00; /* rgb físico exacto enviado al cubo */

  /* ── Alerta real (desconexión, movimiento inválido, error) — muted,
     nunca el rojo saturado #ef4444 actual ── */
  --color-alert: #D4694A;

  /* ── Tipografía ── */
  --font-sans: 'Public Sans', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace; /* toda cifra: cronómetro, movimientos, timestamps, rgb() */

  --radius-sm: 4px;
  --radius-lg: 8px; /* más cuadrado que la v1 (10px) — el monitor clínico es más recto, menos "app amigable" */

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;

  --shadow-focus: 0 0 0 2px var(--color-signal-neutral);
}
```

### 5.3 Contraste (WCAG 2.1, calculado)

| Primer plano | Fondo | Ratio | Nivel |
|---|---|---:|:---:|
| `--color-paper-100` | `--color-graphite-900` | **16.3 : 1** | AAA |
| `--color-paper-100` | `--color-graphite-800` | **14.4 : 1** | AAA |
| `--color-ppa-pausar` (#00BFFF) | `--color-graphite-900` | **9.1 : 1** | AAA |
| `--color-ppa-pensar` (#FFFF66) | `--color-graphite-900` | **18.1 : 1** | AAA (muy brillante — funciona como "casi blanco con matiz", coherente con ser la señal de mayor prioridad cognitiva, Pensar) |
| `--color-ppa-actuar` (#00FF00) | `--color-graphite-900` | **14.0 : 1** | AAA |
| `--color-alert` (#D4694A) | `--color-graphite-900` | **5.4 : 1** | AA |

Los 3 colores PPA, al ser justamente los valores que ya se envían al hardware, rinden un contraste altísimo contra el grafito casi negro — confirma que la base oscura no es solo una preferencia estética, es lo que hace que esos 3 colores lean como una señal real, como un trazo de EKG sobre una pantalla apagada.

### 5.4 Tipografía numérica — pregunta abierta antes de fijarla (ver §8)

Para el cronómetro de sesión y la cuenta regresiva — los dos elementos más "de monitor" de toda la interfaz — hay dos caminos:

- **JetBrains Mono con `font-variant-numeric: tabular-nums`** (el código YA usa esto en `App.tsx:706`): monoespaciada, dígitos alineados, paquete `@fontsource/jetbrains-mono` disponible, cero riesgo de empaquetado. Da un aire "de terminal", no literalmente "de LCD".
- **DSEG7** (fuente de 7 segmentos, la que literalmente imitan los relojes/monitores de LCD reales, OFL de Keshikan): da la identidad más fuerte y menos genérica de las dos opciones, pero **no tiene paquete npm oficial** — hay que descargar los `.woff2` del release de GitHub y auto-hospedarlos a mano en `public/fonts/`, con su propio `@font-face`. Sigue cumpliendo "cero CDN en runtime" (son archivos locales), pero es un paso manual que JetBrains Mono no necesita.

### 5.5 Sustituto de la tarjeta: franjas horizontales, no cajas

En vez de la tarjeta `card` reimplementada 3 veces (v1 §4.1), el layout de monitor clínico se organiza en **franjas horizontales de ancho completo**, cada una con su propio fondo (`--color-graphite-800` o `-900` alternado) y separadas por una regla de 1px (`--color-graphite-700`) — no por gap+borde+radio como hoy. Dentro de cada franja, los datos se alinean a una grilla de columnas fijas (como los canales apilados de un monitor real), no a tarjetas independientes con su propio padding. Radio de borde: solo en controles interactivos pequeños (`--radius-sm`, botones/inputs), nunca en las franjas mismas — una franja de monitor no tiene esquinas redondeadas.

### 5.6 Sistema de estados — 7 estados reales, alineados 1:1 con `cubeVisualState.ts`

A diferencia de la v1 (5 estados genéricos inventados), este sistema se deriva directamente de la tabla de prioridad ya implementada y documentada en `ESTADO_VISUAL_CUBOS.md`, para que el lenguaje visual y el comando físico nunca puedan divergir — el mismo objetivo que ya logró el resolutor en el código.

| Prioridad | Estado (`SessionState`/pulso) | Tratamiento visual | Nunca solo color |
|---:|---|---|---|
| 1 | Bloqueo | Franja superior completa en `--color-alert`, ícono `Ban`, texto "BLOQUEADO — reordena los cubos" | Texto + ícono obligatorios |
| 2 | Victoria | Franja superior completa en `--color-ppa-actuar` (reutiliza el verde ya asociado a "decisión tomada"), ícono `Trophy` | Texto + ícono |
| 3 | Cuenta regresiva | Overlay ya existente (§3.3), recoloreado a `--color-signal-neutral` en vez de cian saturado | Número grande ya es autoexplicativo |
| 4 | Pausado | Franja superior en `--color-graphite-700` con borde discontinuo en `--color-signal-neutral`, ícono `PauseCircle` | Texto + ícono |
| 5 | Movimiento inválido (pulso, cubo individual) | El cubo implicado: anillo en `--color-alert`, no el `#ef4444` actual | Ya tiene texto en el `title` del cubo |
| 6 | Señal PPA manual (cubo individual) | Relleno exacto de `--color-ppa-pausar`/`-pensar`/`-actuar` — sin cambios respecto a hoy, es la señal protegida | Ícono lucide (reemplaza el emoji, §7 Fase 3) |
| 7 | Color de equipo en reposo | Azul/rojo de equipo, sin cambios — es identidad de equipo, no un estado del sistema | — |

---

## 6. Layout propuesto

Objetivo igual al de la v1: **sin scroll para las acciones críticas en 1366×768**, ahora con la tarjeta de control de partida integrada como franja fija superior (coherente con que un monitor real siempre muestra sus signos vitales principales en la banda de arriba, nunca los oculta).

### 1366×768

```
╔════════════════════════════════════════════════════════════════════════╗ ← franja fija, 44px
║ 1.CONTROL  2.SIMULACIÓN  3.OBSERVADOR         ●CONECTADO   N. Paipa     ║
╟────────────────────────────────────────────────────────────────────────╢ ← franja fija, 64px
║  00:47        EN CURSO        [Pausar] [Reiniciar]     PARES ●●●●●     ║   cronómetro grande,
╟────────────────────────────────────────────────────────────────────────╢   tabular-nums
║  col A (5/12)                │  col B (7/12)                            ║ ← flexible
║  TABLERO                     │   ┌──────────┐┌──────────┐               ║
║  1 2 3 4 5  ·  6 7 8 9 10    │   │ PAUSAR   ││ PENSAR   │               ║
║                               │   └──────────┘└──────────┘               ║
║  Movimientos 6 · Vacía 6     │   ┌──────────┐┌──────────┐               ║
║                               │   │ ACTUAR   ││ INICIAL  │               ║
║                               │   └──────────┘└──────────┘               ║
╟────────────────────────────────────────────────────────────────────────╢ ← franja fija, 32px
║ ▸ Histórico (bitácoras, condición acumulada, música ambiental)          ║
╚════════════════════════════════════════════════════════════════════════╝
```

- El cronómetro y el estado de sesión (antes una tarjeta más entre otras 5) pasan a ser la **segunda franja fija**, con el mismo peso que la barra de pestañas — nunca compiten por espacio con el resto, nunca empujan nada hacia abajo.
- Selector de pares + operador (antes una tarjeta completa con texto largo) se comprime a una fila de puntos + nombre dentro de esa misma franja — la configuración de sesión ya no es un bloque propio.
- Cubos esclavos + los 4 stat-cards de solo lectura se integran como una línea de texto compacta dentro de la columna del tablero (`Movimientos 6 · Vacía 6`, etc.), no 5 tarjetas separadas.
- Bitácoras/condición acumulada/música ambiental: al drawer colapsable, igual que proponía la v1.

### 1920×1080

Misma retícula, con una tercera columna delgada para la bitácora en vivo (igual que proponía la v1 §6) — la franja superior de control de partida se mantiene idéntica en altura (no hay motivo para agrandar un cronómetro más allá de lo legible a distancia), el espacio extra se destina a agrandar el tablero y los botones PPA.

---

## 7. Plan de implementación por fases

Mismo compromiso que la v1: rama `rediseno-ui`, un commit por fase, ningún cambio de lógica/Socket.IO/tiempos en ninguna fase.

**Fase 1 — Tokens y tipografía**: `index.css` (nuevo `@theme` de §5.2), `index.html` (quitar Google Fonts), `package.json` (`@fontsource/public-sans`, `@fontsource/jetbrains-mono`, y `DSEG7` si se aprueba en §8 — requiere `npm install`, fuera de esta sesión). Riesgo: ninguno sobre la comunicación con los cubos.

**Fase 2 — Layout**: reestructurar `App.tsx` (JSX de retorno solamente) a franjas horizontales; comprimir selector de pares/operador y stats a líneas compactas; mover bitácoras/condición acumulada/música a drawer. Aplica también a `AppShell.tsx`, `SimulationTab.tsx`, `ObservadorTab.tsx` (alcance completo, 3 pestañas). Riesgo: moderado, mismo cuidado que v1 — cada botón conserva su handler exacto, solo cambia de envoltorio.

**Fase 3 — Componentes y sistema de estados**: aplicar tokens/paleta monocromática + 3 colores PPA protegidos en todos los archivos; reemplazar los 6 colores saturados sin sistema (§4) por `--color-alert`/`--color-signal-neutral`/los 3 PPA; reemplazar emojis de `Cube.tsx:11,17,23` por íconos lucide; implementar el sistema de 7 estados de §5.6 verificando 1:1 contra `resolveCubeDisplay`/`sessionVisualTier` de `cubeVisualState.ts` para no divergir del comando físico real. Riesgo: puntual en `Cube.tsx:151` (mismo cambio que ya señalaba la v1).

**Fase 4 — Limpieza**: huérfanos (`Platform.tsx`, `PlatformConfigPopup.tsx`, `CubeConfigPopup.tsx`) y dependencias de shadcn sin uso — igual que v1, con su propio paso de aprobación para el `npm install`/`prune`.

---

## 8. Lo que necesito de usted

Muchas de las preguntas de la v1 ya se resolvieron en esta conversación (referencia visual, base técnica, alcance de pestañas, orden de trabajo). Quedan estas:

**1. Tipografía numérica del cronómetro/cuenta regresiva (§5.4).**
   - **(a) JetBrains Mono + tabular-nums — recomendado.** Cero riesgo de empaquetado, ya hay un precedente en el propio código (`App.tsx:706`).
   - (b) DSEG7 (siete segmentos, look de LCD real) — más identidad, pero exige auto-hospedar los `.woff2` a mano, sin paquete npm.

**2. Independencia del color en pantalla respecto al color físico del cubo** (pregunta que ya estaba abierta en la v1 y sigue sin resolverse leyendo el código).
   - **(a) Son independientes — puedo ajustar el color en pantalla sin tocar el RGB real enviado al cubo — recomendado si es así**, aunque en este Design System en particular los 3 colores PPA se proponen usar exactamente los valores físicos (§5.1), así que esta pregunta importa menos que en la v1, pero sigue siendo relevante para los estados de alerta/bloqueo si en algún momento quisieran reflejar también el color físico exacto del `EF=4`/`EF=5`.
   - (b) Deben coincidir exactamente con el RGB físico; no los toco bajo ningún concepto.

**3. Huérfanos y dependencias sin uso (Fase 4)** — igual que la v1, sigue pendiente de confirmación.
   - **(a) Eliminar los 3 huérfanos confirmados y las dependencias de shadcn sin uso, con aprobación explícita aparte para el `npm install`/`prune` — recomendado.**
   - (b) Dejar todo intacto, fuera de alcance.

---

*No se ha tocado ningún componente, estilo ni dependencia en este turno. El único archivo escrito es este documento.*
