// Ecuaciones, lecturas en lenguaje llano y referencias de los informes.
//
// Un informe de esta investigación lo leen tres personas distintas: quien
// acompaña la sesión (y no tiene por qué saber qué es un número ciclomático),
// el autor de la tesis y el director o el jurado, que sí va a preguntar de
// dónde sale cada fórmula. Por eso cada métrica se describe dos veces, en
// paralelo y sin que una desplace a la otra:
//
//   · `queMide` y `ejemplo` — la lectura divulgativa: qué significa y cómo se
//     interpreta un valor concreto, sin apoyarse en ningún concepto previo.
//   · `ecuacion` y `fuente` — el soporte académico: la fórmula tal como está
//     en el documento de la tesis (sección «Fundamento matemático de las
//     métricas de análisis») y de dónde procede.
//
// Las referencias son las mismas de bibliografia.bib: si cambian allá, deben
// cambiar aquí, porque el informe descargado viaja solo y el tutor no tiene
// el documento al lado.

export type MetricaDocumentada = {
  simbolo: string
  nombre: string
  // Divulgativo
  queMide: string
  ejemplo: string
  // Académico
  ecuacion: string
  numero?: string // número de ecuación en el documento de la tesis
  fuente: string
}

export const METRICAS: MetricaDocumentada[] = [
  {
    simbolo: 'L',
    nombre: 'Movimientos',
    queMide: 'Cuántas jugadas válidas hizo en el intento.',
    ejemplo: 'L = 12 significa que movió una ficha doce veces hasta terminar o quedarse bloqueado.',
    ecuacion: 'L = número de pasos del paseo W = (s₀, s₁, …, s_L) sobre el grafo de estados',
    fuente: 'Hinz (2012): el recorrido de quien juega se proyecta sobre el grafo de estados de la tarea.',
  },
  {
    simbolo: 'D*',
    nombre: 'Mínimo posible del nivel',
    queMide: 'La menor cantidad de movimientos con que ese nivel se puede ganar. Es la vara con la que se compara todo lo demás.',
    ejemplo: 'Con 2 pares de fichas, D* = 8; con 5 pares, D* = 35.',
    ecuacion: 'D*(n) = n² + 2n',
    numero: 'ec. 3.1',
    fuente: 'Liévano y Molina (2022); verificado sobre el grafo con el algoritmo de Dijkstra (1959).',
  },
  {
    simbolo: 'Q',
    nombre: 'Circuidad (eficiencia de la ruta)',
    queMide: 'Cuántas veces el mínimo necesitó para ganar. Es un cociente: 1 es la ruta más corta posible y no se puede bajar de ahí.',
    ejemplo: 'Q = 1,00 → ganó por el camino más corto. Q = 1,50 → usó un 50 % más de movimientos. Solo se calcula si llegó a la meta.',
    ecuacion: 'Q = L / D*(n)',
    numero: 'ec. 3.5',
    fuente: 'Barthélemy (2011): índice de circuidad o factor de rodeo en redes espaciales.',
  },
  {
    simbolo: 'δ',
    nombre: 'Grados de libertad',
    queMide: 'Cuántas jugadas distintas tenía disponibles en ese momento. Si solo había una, no eligió: ejecutó.',
    ejemplo: 'δ = 1 es una jugada forzada; δ = 3 significa que tenía tres fichas que podía mover.',
    ecuacion: 'δ_k = |A_k|, con A_k las jugadas legales antes del movimiento k',
    numero: 'ec. 3.2',
    fuente: 'Hinz (2012): el grado del vértice como cantidad pertinente para analizar el desempeño.',
  },
  {
    simbolo: 'C',
    nombre: 'Calidad de un movimiento',
    queMide: 'En una jugada donde sí había que elegir, qué tan buena fue la elección frente a las que tenía disponibles.',
    ejemplo: 'C = 0 → eligió la mejor jugada posible; C = 1 → eligió la peor de las que tenía; C = 0,5 → quedó a mitad de camino.',
    ecuacion: 'C_k = (d(s_k) − d_mín) / (d_máx − d_mín), definida solo si δ_k ≥ 2 y d_máx > d_mín',
    numero: 'ec. 3.4 y 3.6',
    fuente: 'Construida sobre las dos cantidades de Hinz (2012) —grado del vértice y distancia—; propiedades métricas en Hinz et al. (2005).',
  },
  {
    simbolo: 'R',
    nombre: 'Ramificación',
    queMide: 'El promedio de la calidad de todas las decisiones reales del intento. Resume si, cuando tuvo que elegir, eligió bien.',
    ejemplo: 'R = 0,00 → acertó siempre. R = 0,20 → en promedio se desvió un 20 % de la mejor opción. Cuanto más bajo, mejor.',
    ecuacion: 'R_i = (1/|K|) · Σ_{k∈K} C_k, con K el conjunto de puntos de decisión',
    numero: 'ec. 3.7',
    fuente: 'Promedio (y no suma) para que no crezca con la duración del intento y sea comparable entre niveles.',
  },
  {
    simbolo: 'α',
    nombre: 'Tasa de acierto',
    queMide: 'De todas las veces que tuvo que elegir, en qué proporción eligió la mejor jugada.',
    ejemplo: 'α = 100 % → acertó en todas. α = 60 % → acertó en 3 de cada 5 decisiones.',
    ecuacion: 'α_i = |{k ∈ K : C_k = 0}| / |K|',
    numero: 'ec. 3.8',
    fuente: 'Complemento de R: R mide cuánto se desvió; α, cuántas veces no se desvió nada.',
  },
  {
    simbolo: 'δ media',
    nombre: 'Grado de libertad medio',
    queMide: 'En promedio, cuántas jugadas podía hacer en cada turno. Indica cuánto margen de elección ofrecía el nivel.',
    ejemplo: 'δ̄ = 2,4 → en promedio tenía algo más de dos jugadas posibles por turno.',
    ecuacion: 'δ̄_i = (1/L_i) · Σ_k δ_k',
    numero: 'ec. 3.9',
    fuente: 'Factor de ramificación del trayecto, en el sentido de la búsqueda en espacios de estados: Russell y Norvig (2021).',
  },
  {
    simbolo: 'ν',
    nombre: 'Retornos',
    queMide: 'Cuántas veces volvió a una posición del tablero en la que ya había estado antes dentro del mismo intento.',
    ejemplo: 'ν = 0 → nunca repitió posición. ν = 3 → tres veces se encontró donde ya había estado.',
    ecuacion: 'ν_i = (L_i + 1) − |V(W_i)|',
    numero: 'ec. 3.10',
    fuente: 'Se mide sobre el paseo, no sobre el grafo: es conducta, no una propiedad del tablero.',
  },
  {
    simbolo: 'β',
    nombre: 'Buclicidad',
    queMide: 'Qué proporción de sus jugadas terminó en una posición repetida. Permite comparar intentos de distinta duración.',
    ejemplo: 'β = 0,00 → avanzó sin repetir. β = 0,20 → una de cada cinco jugadas lo devolvió a una posición conocida.',
    ecuacion: 'β_i = ν_i / L_i',
    numero: 'ec. 3.10',
    fuente: 'Versión normalizada de ν, para que un intento largo no parezca peor solo por ser largo.',
  },
  {
    simbolo: 'μ',
    nombre: 'Bucles independientes',
    queMide: 'Cuántos bucles distintos describió, que no es lo mismo que cuántas veces los repitió: distingue el estancamiento de la exploración.',
    ejemplo: 'ν = 10 con μ = 1 → repitió diez veces el mismo bucle. ν = 10 con μ = 5 → exploró cinco bucles distintos.',
    ecuacion: 'μ_i = |E(W_i)| − |V(W_i)| + 1 (número ciclomático del subgrafo recorrido)',
    numero: 'ec. 3.11',
    fuente: 'Kirchhoff (1847) en el análisis de redes eléctricas; reintroducido por McCabe (1976) como medida de complejidad.',
  },
  {
    simbolo: 'g',
    nombre: 'Cuello del grafo',
    queMide: 'El bucle más corto que el juego permite: por debajo de eso es imposible volver a una posición anterior.',
    ejemplo: 'g = 6 en los cinco niveles: ningún bucle puede medir menos de seis movimientos.',
    ecuacion: 'g(G) = longitud del ciclo más corto del grafo de estados = 6 para n = 1…5',
    fuente: 'Propiedad estructural del grafo, verificada exhaustivamente; para esta familia de tareas, Hinz et al. (2018).',
  },
]

// Referencias completas, en el formato del documento de la tesis. El informe
// descargado se envía solo, así que las lleva dentro.
export const REFERENCIAS: string[] = [
  'Barthélemy, M. (2011). Spatial Networks. Physics Reports, 499(1–3), 1–101.',
  'Dijkstra, E. W. (1959). A Note on Two Problems in Connexion with Graphs. Numerische Mathematik, 1, 269–271.',
  'Faber, A. H., Kühnpast, N., Sürer, F., Danek, A. y Hinz, A. M. (2009). The iso-effect: Is there specific learning of Tower of London iso-problems? Thinking & Reasoning, 15(2), 237–249.',
  'Hinz, A. M. (2012). Graph Theory of Tower Tasks. Behavioural Neurology, 25(1), 13–22.',
  'Hinz, A. M., Klavžar, S., Milutinović, U., Parisse, D. y Petr, C. (2005). Metric properties of the Tower of Hanoi graphs and Stern’s diatomic sequence. European Journal of Combinatorics, 26(5), 693–708.',
  'Hinz, A. M., Klavžar, S. y Petr, C. (2018). The Tower of Hanoi – Myths and Maths (2.ª ed.). Springer.',
  'Hinz, A. M., Kostov, A., Kneissl, F., Sürer, F. y Danek, A. (2009). A mathematical model and a computer tool for the Tower of Hanoi and Tower of London puzzles. Information Sciences, 179(17), 2934–2947.',
  'Kirchhoff, G. (1847). Über die Auflösung der Gleichungen, auf welche man bei der Untersuchung der linearen Verteilung galvanischer Ströme geführt wird. Annalen der Physik und Chemie, 72(12), 497–508.',
  'Liévano Chaparro, L. P. y Molina Monguí, R. R. (2022). Análisis de las trayectorias de aprendizaje del juego La Escalera [Trabajo de grado de maestría]. Universidad Distrital Francisco José de Caldas.',
  'McCabe, T. J. (1976). A Complexity Measure. IEEE Transactions on Software Engineering, SE-2(4), 308–320.',
  'Russell, S. y Norvig, P. (2021). Artificial Intelligence: A Modern Approach (4.ª ed.). Pearson.',
]

export const NOTA_ECUACIONES =
  'Las ecuaciones completas, con su desarrollo y su justificación, están en el documento de la tesis, sección '
  + '«Fundamento matemático de las métricas de análisis». Todo lo que aparece en este informe se calcula sobre el grafo '
  + 'de estados del juego La Escalera, con las tres reglas de la Figura 3.3 de Liévano y Molina (2022).'
