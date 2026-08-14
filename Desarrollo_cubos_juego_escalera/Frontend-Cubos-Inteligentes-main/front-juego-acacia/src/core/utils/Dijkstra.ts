// export function dijkstra(
//     graph: Map<number, number[]>,
//     start: number
// ): { distancias: Map<number, number>, anteriores: Map<number, number | null> } {
//     const distancias = new Map<number, number>();
//     const anteriores = new Map<number, number | null>();
//     const visitados = new Set<number>();

//     const nodos = Array.from(graph.keys());

//     // Inicialización
//     for (const nodo of nodos) {
//         distancias.set(nodo, Infinity);
//         anteriores.set(nodo, null);
//     }
//     distancias.set(start, 0);

//     while (visitados.size < nodos.length) {
//         // Buscar el nodo no visitado con menor distancia conocida
//         let nodoActual: number | null = null;
//         let distanciaMinima = Infinity;

//         for (const nodo of nodos) {
//             if (!visitados.has(nodo) && distancias.get(nodo)! < distanciaMinima) {
//                 distanciaMinima = distancias.get(nodo)!;
//                 nodoActual = nodo;
//             }
//         }

//         // Si no se encontró ningún nodo alcanzable, se terminó
//         if (nodoActual === null) break;

//         visitados.add(nodoActual);

//         const vecinos = graph.get(nodoActual) || [];
//         for (const vecino of vecinos) {
//             if (visitados.has(vecino)) continue;

//             const nuevaDistancia = distancias.get(nodoActual)! + 1;
//             if (nuevaDistancia < distancias.get(vecino)!) {
//                 distancias.set(vecino, nuevaDistancia);
//                 anteriores.set(vecino, nodoActual);
//             }
//         }
//     }

//     return { distancias, anteriores };
// }



// export function caminoMasCorto(
//     graph: Map<number, number[]>,
//     inicio: number,
//     fin: number
// ): number[] {
//     const { anteriores } = dijkstra(graph, inicio);

//     const camino: number[] = [];
//     let actual: number | null = fin;

//     while (actual !== null) {
//         camino.unshift(actual);
//         if (actual === inicio) break;
//         actual = anteriores.get(actual) ?? null;
//     }

//     // Si no se llegó al nodo de inicio, no hay camino
//     if (camino[0] !== inicio) return [];
//     console.log("Camino encontrado:");
//     console.log(camino);
//     return camino;
// }


/**
 * @param {Graph} graph some graph.
 * @param {Object} source node to search from.
 */


/**
 * @constructor
 */
//import { FibonacciHeap } from '@tyriar/fibonacci-heap';
//import deepEqual from 'deep-equal';

import { Graph } from './graph/graph';

export function Dijkstra(graph: Graph, source: number): Record<number, number | null> {
  const dist: Record<number, number> = {};
  const prev: Record<number, number | null> = {};
  const visited = new Set<number>();

  const vertices = graph.vertices;

  // Inicializar distancias
  for (const v of vertices) {
    dist[v] = v === source ? 0 : Infinity;
    prev[v] = null;
  }

  while (visited.size < vertices.length) {
    // Encontrar nodo no visitado con menor distancia
    let u: number | null = null;
    let minDist = Infinity;

    for (const v of vertices) {
      if (!visited.has(v) && dist[v] < minDist) {
        u = v;
        minDist = dist[v];
      }
    }

    if (u === null) break;

    visited.add(u);

    // Explorar vecinos
    const vecinos = graph.neighbors(u);
    for (const v of vecinos) {
      const alt = dist[u] + graph.distance(u, v);
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  return prev;
}

//Reconstruye el camino de nodos desde uno en específico hasta el final
export function reconstruirCamino(
  prev: Record<number, number | null>,
  origen: number,
  destino: number
): number[] {
  const camino: number[] = [];
  let actual: number | null = destino;

  while (actual !== null) {
    camino.unshift(actual);
    if (actual === origen) break;
    actual = prev[actual];
  }

  if (camino[0] !== origen) return [];

  return camino;
}

export function obtenerTrayectoriaDePosiciones(graph: Graph, camino: number[]): number[][] {
  return camino.map(nodo => graph.getPositions(nodo));
}




