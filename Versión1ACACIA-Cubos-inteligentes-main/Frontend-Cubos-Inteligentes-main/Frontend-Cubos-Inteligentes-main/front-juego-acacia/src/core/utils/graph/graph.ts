import { Node } from './Node';
import deepEqual from 'deep-equal';

//Clase grafo
export class Graph {

  //Definición del arreglo de nodos con el tipo record
  //para hacerlo inmutable y que no se pueda modificar
  //ya que no es necesario
  private nodes: Record<number, Node> = {};

  //retorna los ids de los vértices del grafo
  get vertices(): number[] {
    return Object.keys(this.nodes).map(Number);
  }

  //Agrega un vértice con informacón de posiciones
  addVertex(vertex: number, positions: number[]): void {
    //Valida la no existencia de un nodo con el mismo id
    if (!this.nodes[vertex]) {
      this.nodes[vertex] = {
        positions,
        edges: {}
      };
    }
  }

  //Agrega una arista desde un nodo hacia otro usando el id 
  //además de una distancia o peso, que siempre es = 1
  addEdge(source: number, target: number): void {
    if (!this.nodes[source]) {
      throw new Error(`Nodo ${source} no existe. Usa addVertex primero.`);
    }
    if (!this.nodes[target]) {
      throw new Error(`Nodo ${target} no existe. Usa addVertex primero.`);
    }
    //agrega la información de la arista a la matriz de adyacencia
    this.nodes[source].edges[target] = 1;
    this.nodes[target].edges[source] = 1;
  }

  //retorna la distancia desde un nodo source hasta un nodo target
  distance(source: number, target: number): number {
    return this.nodes[source]?.edges?.[target] ?? Infinity;
  }

  //Retorna todos los IDs de los nodos adyacentes a uno específico
  neighbors(vertex: number): number[] {
    return Object.keys(this.nodes[vertex]?.edges ?? {}).map(Number);
  }

  //Obtiene el arreglo de posiciones de un nodo específico
  getPositions(vertex: number): number[] {
    return this.nodes[vertex]?.positions ?? [];
  }

  //Busca en el grafo el nodo que contiene cierto arreglo de
  //posiciones y retorna el ID del nodo
  findVertexByPositions(posiciones: number[]): number{
    for (const vertex of this.vertices) {
      const guardadas = this.nodes[vertex].positions;
      if (deepEqual(guardadas, posiciones)) {
        return vertex;
      }
    }
    return -1; // si no lo encuentra
  }

}
