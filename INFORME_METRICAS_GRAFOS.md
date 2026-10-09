# Informe: ramificación y buclicidad en el grafo del juego La Escalera

**Fecha:** 2026-10-06 · **Para:** Néstor Paipa y su director de tesis
**Objeto:** qué ecuaciones miden hoy la ramificación y la buclicidad, qué problemas tienen, y cómo se definen ambas en teoría de grafos para poder calcularlas por intento y por nivel.

---

## 1. Lo que ya existe (no hay que partir de cero)

Las dos métricas **ya están definidas en dos sitios**, y conviene saberlo antes de proponer nada nuevo:

1. **Libro de Lina y Rafael** (`Trabajo_de_Grado_Lina_Rafael.pdf`, §4.5 "Métricas y Análisis", pp. 43-45). Es la fuente original: ecuaciones 4.1 a 4.4 para la buclicidad, y `C_m`, `R_i`, `R_e` para la ramificación.
2. **`main.tex`**, sección `sec:fundamento_ecuaciones` ("Fundamento matemático de las métricas de análisis", líneas ~1785-2030). Reproduce las seis ecuaciones, las interpreta en clave de control inhibitorio y las resume en la tabla `tab:resumen_metricas`.

Es decir: **la decisión metodológica ya fue tomada** y es herencia del libro. Lo que falta no es elegir métricas desde cero, sino (a) corregir dos problemas matemáticos reales y (b) decidir cómo se **calculan** sobre el recorrido.

### Ecuaciones vigentes

| Métrica | Ecuación | Fuente |
|---|---|---|
| Ruta óptima | D_min = n² + 2n | libro, `main.tex` eq. `eq:optimo` |
| Buclicidad por intento (par) | B_i = n²/2 + 2n | libro eq. 4.1 |
| Buclicidad por intento (impar) | B_i = n²/2 + 2n − 1/2 | libro eq. 4.2 |
| Buclicidad general | B_i = n²/2 + 2n + C | libro eq. 4.3 |
| Buclicidad por experiencia | B_e = (1/m) Σ B_i,j | libro, `main.tex` |
| Calidad del movimiento | C_m = \|1 − D_j/D_min\| | libro, `main.tex` |
| Ramificación por intento | R_i = Σ C_m,k | libro, `main.tex` |
| Ramificación por experiencia | R_e = (1/n) Σ R_i,j | libro, `main.tex` |

En estas ecuaciones, **`n` significa dos cosas distintas** según el contexto: en D_min es el número de fichas *por equipo*; en B_i es el número de fichas *involucradas en el bucle*. Conviene renombrar una de las dos al documentarlas.

---

## 2. El grafo real: datos verificados

Todas las cifras siguientes se calcularon sobre el grafo de estados generado por las reglas oficiales del libro (Fig. 3.3), el mismo que dibuja `Escalera.m` y que usa la aplicación (`src/core/simulation/stateGraph.ts`).

| Pares n | Vértices | Aristas | Número ciclomático μ | Cuello (ciclo más corto) | Grados 1/2/3/4 |
|---|---|---|---|---|---|
| 1 | 6 | 6 | 1 | 6 | 0 / 6 / 0 / 0 |
| 2 | 30 | 36 | 7 | 6 | 4 / 14 / 8 / 4 |
| 3 | 140 | 180 | 41 | 6 | 16 / 52 / 48 / 24 |
| 4 | 630 | 840 | 211 | 6 | 60 / 210 / 240 / 120 |
| 5 | 2772 | 3780 | **1009** | **6** | 224 / 868 / 1120 / 560 |

Tres lecturas inmediatas, todas verificables:

- **El cuello (*girth*) es 6 en los cinco tamaños.** Ningún bucle puede tener menos de 6 movimientos. Esto **confirma literalmente** lo que afirma el libro: "uno de los primeros bucles que consigue un jugador novato es entre dos fichas, 1 pieza por color, tomándole 6 movimientos retornar a una posición anterior" (p. 44).
- **Los "caminos sin retorno" son exactamente los vértices de grado 1.** Con la Regla 2 (no volver a la posición inmediatamente anterior), llegar a un vértice de grado 1 deja sin jugada legal. Son 0, 4, 16, 60 y 224 para n = 1…5.
- **Los "puntos críticos" del libro son los vértices de grado 3 y 4.** Para n = 5: 1120 de grado 3 y 560 de grado 4.

### Verificación de B_i contra los ciclos reales

Enumerando **todos** los ciclos simples del grafo de n = 2 y clasificándolos por cuántas fichas distintas se mueven dentro del ciclo:

| Fichas en el bucle | Largos reales encontrados (nº de ciclos) | Mínimo real | B_i del libro |
|---|---|---|---|
| 2 (1 azul + 1 roja) | 6 (6 ciclos) | 6 | **6** — exacto |
| 3 (1+2 y 2+1) | 10 (4 ciclos) | 10 | **10** — exacto |
| 4 (2 azules + 2 rojas) | 12 (16), 14 (10), **16 (17)**, 18 (4), 20 (4) | 12 | **16** — el más frecuente |

**Conclusión:** la fórmula del libro es correcta y notablemente precisa. Para 2 y 3 fichas da el valor exacto; para 4 fichas da 16, que es el largo **más frecuente** (17 ciclos), y la tolerancia de ±2 que el propio libro declara cubre los largos 14, 16 y 18. Los ciclos de largo 12 existen, pero son "atajos" que no recorren la ruta óptima, precisamente el caso que el libro excluye al decir que sus ecuaciones "contemplan únicamente bucles completos que siguen la ruta óptima".

---

## 3. Dos problemas que hay que resolver

### Problema 1 — C_m es idénticamente cero tal como está redactada

`main.tex` define los dos términos del cociente así (dos veces, líneas ~1742 y ~1930):

> "D_j es la distancia —en número de movimientos válidos restantes— desde el estado actual del jugador hasta el estado meta, y D_min es la distancia mínima posible desde ese mismo estado hasta la meta".

En un grafo, **la distancia de un vértice a otro ya es, por definición, la mínima**. Si D_j y D_min se miden ambas desde el mismo estado, entonces D_j = D_min siempre, el cociente vale 1 y **C_m = 0 para todo movimiento**, lo que haría R_i = 0 y R_e = 0 en todos los casos. La métrica, como está escrita, no mide nada.

Además hay una **contradicción interna**: la subsección "Movimientos óptimos" presenta D_min = n²+2n (una constante global, 35 para n = 5) y dice que "actúa como denominador de referencia en la métrica de ramificación"; la subsección de ramificación lo redefine como distancia local desde el nodo actual. Son dos cosas distintas y el texto usa el mismo símbolo para ambas.

### Problema 2 — B_i no cuenta bucles: predice su tamaño

Esta es la diferencia de fondo con lo que se busca medir. La pregunta "**¿cuántas vueltas di volviendo al mismo punto?**" pide un **recuento**; B_i = n²/2 + 2n + C devuelve el **tamaño esperado** de un bucle canónico de n fichas. Son dos magnitudes distintas:

- B_i es un **valor de referencia**, del mismo tipo que D_min: dice cuánto *debería* medir un bucle completo, no cuántos bucles hizo el estudiante.
- B_e = (1/m) Σ B_i,j promedia ese valor de referencia entre intentos. Queda **indefinido** si un intento no tuvo bucles, y **ambiguo** si tuvo varios de tamaños distintos: no dice cuál B_i entra en el promedio.

Dicho de otro modo: con las ecuaciones actuales **no se puede responder "cuántos bucles hubo en este intento"**. Hace falta añadir una métrica de recuento.

*(Nota menor: el libro escribe la ec. 4.3 como n²/2 + 2n + C y la 4.4 como n²/2 + 2(n+C), que no son equivalentes. `main.tex` adoptó la forma de la 4.3, que es la que concuerda con los ciclos reales.)*

---

## 4. Definiciones en teoría de grafos

Sea G = (V, E) el grafo de estados y sea el recorrido de un intento el **paseo** (*walk*) W = (s₀, s₁, …, s_L), con s₀ el estado inicial, cada par consecutivo unido por una arista, y sujeto a la Regla 2 (s_k ≠ s_{k−2}). Sean V(W) los estados distintos visitados y E(W) las aristas distintas recorridas.

### 4.1 Buclicidad — tres cantidades complementarias

**(a) Retornos — responde directamente a "cuántas vueltas di"**

> ν_i = (L_i + 1) − |V(W_i)|

Número de veces que el paseo llega a un estado en el que ya había estado. Si el recorrido no repite ningún estado, ν_i = 0.

**(b) Tamaño de cada bucle**

Si s_k repite el estado s_j (con j < k el más reciente), el bucle es el subpaseo cerrado (s_j, …, s_k) y su tamaño es ℓ = k − j. Por el resultado verificado arriba, **ℓ ≥ 6 siempre**. Aquí es donde B_i del libro entra como **referencia** con la que comparar cada ℓ observado.

**(c) Número ciclomático del subgrafo recorrido**

> μ(W_i) = |E(W_i)| − |V(W_i)| + 1

Es el número de **ciclos independientes** del subgrafo que el estudiante recorrió: cuántos bucles *esencialmente distintos* exploró, sin contar dos veces el mismo ciclo recorrido varias veces. Es la medida canónica de "cuán cíclico es" un grafo, introducida por **Kirchhoff (1847)** con el nombre de *número ciclomático* y reintroducida por **McCabe (1976)** como *complejidad ciclomática* para medir la complejidad de un programa a partir de su grafo de flujo.

**Por nivel / por experiencia:** promedio sobre los m intentos del nivel, con la misma forma que el libro usa para B_e: ν̄ = (1/m) Σ ν_i,j, y análogamente μ̄.

### 4.2 Ramificación — dos formulaciones posibles

Sea d(s) la distancia (número mínimo de movimientos) desde el estado s hasta el estado meta, respetando la Regla 2. La aplicación **ya calcula exactamente esta función** (`stateGraph.ts`, `distFinDesde(cur, prev)`), porque con la Regla 2 la distancia depende también del estado anterior.

**Formulación A — conserva la forma del libro**

> C_m(k) = |1 − d(s_k) / (d(s_{k−1}) − 1)|

El denominador es **lo mejor que cualquier movimiento podía lograr** desde s_{k−1} (acercarse un paso). Así:

- movimiento óptimo → d(s_k) = d(s_{k−1}) − 1 → **C_m = 0**
- movimiento lateral → C_m = 1/(d−1)
- movimiento que aleja → C_m = 2/(d−1)

Esto **sí cumple** la interpretación que ya está escrita en `main.tex` ("cuando el aprendiz elige el movimiento óptimo disponible, C_m = 0"). Inconveniente: se indetermina en el último movimiento, cuando d(s_{k−1}) = 1 y el denominador es 0; hay que fijar una convención para ese caso.

**Formulación B — exceso por movimiento (sin singularidades)**

> r_k = d(s_k) − d(s_{k−1}) + 1 ∈ {0, 1, 2, …}

0 si el movimiento fue óptimo, 1 si fue lateral, 2 si alejó de la meta. Su suma tiene una propiedad notable, por telescopaje:

> R_i = Σ r_k = L_i − d(s₀) = **L_i − D_min**

es decir, **la ramificación por intento es exactamente el número de movimientos de más que hizo el estudiante respecto de la ruta óptima**. Es entera, no se indetermina nunca, y coincide con la lectura que `main.tex` ya le da a la métrica ("cualquier trayectoria real que supere D_min refleja decisiones no planificadas; la diferencia entre ambas constituye una medida conductual del control inhibitorio").

**Ramificación propiamente dicha (puntos críticos).** Complementariamente, y más cerca del sentido literal de "ramificar", se puede contar sobre cuántas **decisiones reales** se desvió el estudiante:

> ρ_i = número de k tales que grado(s_{k−1}) ≥ 3 y r_k > 0

esto es, en cuántos puntos críticos (grado ≥ 3, los que el libro llama así) eligió una rama que no acercaba a la meta. El **factor de ramificación** promedio del recorrido, (1/|V(W)|) Σ grado(s), es la noción estándar de *branching factor* en búsqueda en espacios de estados (Newell y Simon; Russell y Norvig).

---

## 5. Qué iría en el informe de intento y de sesión

**Al terminar cada intento** (victoria o bloqueo), automáticamente:

- resultado (victoria / camino sin retorno), duración, nº de movimientos L_i
- D_min del nivel y **exceso** L_i − D_min (= R_i en la formulación B)
- **bucles**: ν_i retornos, tamaño de cada uno, y μ_i ciclos independientes
- comparación de cada bucle observado con el B_i de referencia del libro
- errores (jugadas rechazadas) por tipo de regla infringida
- puntos críticos visitados y en cuántos se desvió (ρ_i)
- miniatura del grafo con la ruta del intento

**Informe de sesión**, con un botón que el operador pulsa cuando decide cerrar:

- tabla de todos los intentos con las columnas anteriores
- B_e, R_e, ν̄, μ̄ y su tendencia a lo largo de los intentos (la evidencia de aprendizaje que busca el marco teórico)
- grafo acumulado con los caminos más repetidos resaltados
- exportación a CSV y JSON, con las mismas columnas que la bitácora, para el análisis posterior

---

## 6. Referencias

**Verificadas en esta sesión:**

- **McCabe, T. J. (1976).** "A Complexity Measure". *IEEE Transactions on Software Engineering*, SE-2(4), 308-320. — Complejidad ciclomática v(G) = E − N + 2P sobre el grafo de flujo; es la reintroducción moderna del número ciclomático.
- **Kirchhoff, G. (1847).** *Annalen der Physik und Chemie*, 72(12), 497-508. — Origen del **número ciclomático** (*circuit rank*): el mínimo de aristas que hay que quitar para romper todos los ciclos, μ = |E| − |V| + c.

**Fuentes estándar propuestas** (reales y de uso corriente; conviene verificar los datos exactos de edición antes de citarlas):

- **Diestel, R.** *Graph Theory*. Springer (Graduate Texts in Mathematics 173). — Definiciones canónicas de paseo, ciclo, cuello (*girth*) y espacio de ciclos.
- **Bondy, J. A. y Murty, U. S. R.** *Graph Theory with Applications*. — Alternativa clásica a Diestel para las mismas definiciones.
- **Newell, A. y Simon, H. A. (1972).** *Human Problem Solving*. Prentice-Hall. — Espacio del problema y búsqueda en espacio de estados; es el marco del que proviene toda la lectura cognitiva de estas trayectorias.
- **Russell, S. y Norvig, P.** *Artificial Intelligence: A Modern Approach*. — Factor de ramificación b y factor de ramificación efectivo b*.
- **Dijkstra, E. W. (1959).** "A note on two problems in connexion with graphs". *Numerische Mathematik*, 1, 269-271. — Ya citado en la tesis para la ruta óptima.

**Ya en la bibliografía del proyecto:** `LievanoMolina2022` (fuente de las ecuaciones), `PaezGonzalez2022`, `Johnsonbaugh2005` (teoría de grafos), `Diamond2013`, `Geurts2009`.

---

## 7. Decisiones pendientes

1. **Denominador de C_m** (Problema 1): formulación A, formulación B, o lectura literal del libro con D_min global.
2. **Buclicidad** (Problema 2): conservar B_i como valor de referencia y añadir el recuento ν_i y el número ciclomático μ_i, o sustituirla.
3. **Sección duplicada en `main.tex`:** existe un `\section{Métricas para analizar las trayectorias}` (línea ~1765) que solo contiene C_m y B_i sueltas, sin texto, justo antes de la sección completa. Parece un resto de una versión anterior y habría que eliminarlo.

---

## 8. La solución mínima no es única (auditoría 2026-10-08/09)

El director aportó **Hinz, Klavžar, Milutinović, Parisse y Petr (2005), «Metric properties of the Tower of Hanoi graphs and Stern's diatomic sequence»**, *European Journal of Combinatorics* 26(5), 693–708. Leído íntegro.

### 8.1 Qué prueba ese artículo (y qué no)

- Entre dos estados cualesquiera de un grafo de Hanói hay **a lo sumo dos** caminos mínimos.
- Para un estado *v*, el número de estados unidos a él por dos caminos mínimos es el término **b(d(v))** de la sucesión diatómica de Stern (Teorema 3.5).
- Los **estados perfectos** son los únicos desde los cuales la secuencia mínima de movimientos hacia cualquier otro estado es única (Corolario 3.7).
- **No** establece «las propiedades métricas que habilitan el uso de la distancia como medida de desempeño». Eso es Hinz (2012) y Hinz y Kostov (2009). La cita estaba mal atribuida en dos lugares de `main.tex` y en el campo de procedencia de la métrica C en la aplicación; los tres quedaron corregidos.

### 8.2 Lo que se comprobó sobre el grafo de La Escalera

Cálculo exhaustivo para n = 1…5 (`scripts/verificarCaminos.ts`, se ejecuta en cada compilación):

| Pares | D* | Diámetro | Radio | exc(s₀) | Distancia media | Rutas mínimas | Máx. caminos mínimos entre dos estados |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 3 | 3 | 3 | 1,80 | 2 | 2 |
| 2 | 8 | 10 | 6 | 8 | 4,14 | 2 | 8 |
| 3 | 15 | 19 | 11 | 16 | 7,10 | 2 | 42 |
| 4 | 24 | 30 | 16 | 26 | 10,58 | 2 | 450 |
| 5 | 35 | 43 | 23 | 38 | 14,44 | 2 | 1350 |

Cinco hechos, todos verificados:

1. Del Inicio al Fin hay **exactamente dos** recorridos de longitud mínima, en los cinco niveles.
2. Son **reflejo uno del otro**: invertir el tablero y cambiar de equipo cada ficha es un automorfismo del grafo que deja fijos el Inicio y el Fin e intercambia las dos rutas.
3. El **único punto de decisión** de una partida mínima es el estado inicial: después del primer movimiento, cada jugada mínima está forzada.
4. La **Regla 2 no encarece** la solución: el mínimo sigue siendo n² + 2n con y sin ella.
5. La cota de Hanói **no se hereda**: en el nivel de cinco pares, el 77,6 % de los pares de estados admite más de un camino mínimo, y uno de ellos admite 1350.

### 8.3 Consecuencias técnicas aplicadas

- **Ninguna métrica compara el paseo contra «la» ruta óptima.** El documento definía la desviación como «cada movimiento que el estudiante realiza por fuera de esa ruta óptima», lo cual es falso con dos rutas mínimas: apartarse de una puede ser seguir la otra. Reescrito: la referencia es la distancia *d(s)*, invariante frente a la elección de ruta.
- **Nuevo apartado §3.3 «La solución mínima no es única»** con su tabla de propiedades métricas (Tabla 3.2).
- **Las dos rutas mínimas se dibujan en el grafo** (ocultas mientras se juega, visibles en los informes). El documento describía una «línea verde de referencia» que no existía; ahora existe, y son dos.
- **La ruta mínima atraviesa 32 puntos de decisión**, no 24 como decía el documento. Corregido y fijado con una comprobación automática.
- **Cuatro informes citaban mal el número de ecuación** (D*, δ, β, μ), porque la ecuación de Dijkstra se lleva la 3.1. Corregidos, y `metricas:verificar` ahora recalcula la numeración leyendo `main.tex`.
- **La meta no es el estado más lejano del Inicio**: su excentricidad es 38 y la meta está a 35. Hay posiciones desde las que faltan más movimientos que al empezar, lo que justifica seguir *d(s)* movimiento a movimiento.

### 8.4 Qué más podría usarse de esa línea de trabajo

- La **distancia media** del grafo (14,44 en el nivel de cinco pares) permitiría contextualizar la circuidad: hoy Q se compara solo contra 1, sin decir qué es un valor típico.
- La **excentricidad** daría un indicador de «lo lejos que llegó a estar», hoy no reportado.
- Klahr (1978), citado por Hinz et al. (2005), es literatura psicológica sobre planificación infantil con tareas de torre: línea de lectura pertinente para el marco teórico, **todavía sin leer en el original**.
