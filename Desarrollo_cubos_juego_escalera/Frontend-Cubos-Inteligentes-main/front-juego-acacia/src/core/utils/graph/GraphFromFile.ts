import { loadDataFromFile, loadGraphStates } from '../../utils/LoadCSVData';

import sourcesPath from '@/assets/GraphData/SGrafo.csv?url';
import targetsPath from '@/assets/GraphData/TGrafo.csv?url';

import { Graph } from './Graph';

export async function createGraph() {
    //Carga los sources y targets de los archivos independientes
    const sources = await loadDataFromFile(sourcesPath);
    const targets = await loadDataFromFile(targetsPath);

    //Carga todos los estados del archivo
    const statesData = await loadGraphStates();

    //Crea la estructura grafo
    const graph = new Graph();

    //Llena el grafo con los vértices primeramente
    for (let i = 0; i < statesData.length; i++) {
        graph.addVertex(i, statesData[i]);
    }
    //Crea las aristas entre los vértices, todas con peso = 1
    for (let i = 0; i < sources.length; i++) {
        graph.addEdge(sources[i] - 1, targets[i] - 1);
    }

    return graph;
}