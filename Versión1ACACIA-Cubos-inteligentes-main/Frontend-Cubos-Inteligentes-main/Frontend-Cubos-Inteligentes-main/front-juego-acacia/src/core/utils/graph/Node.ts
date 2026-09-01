//Definición del tipo nodo del grafo
export type Node = {
  positions: number[]; //Información de las posiciones
  edges: Record<number, number>; // vecinos y pesos
};