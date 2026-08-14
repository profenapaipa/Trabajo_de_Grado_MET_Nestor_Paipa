//Terminado funcional
//Da pista de un movimiento a realizar
import { Dijkstra, reconstruirCamino, obtenerTrayectoriaDePosiciones } from '../../../utils/Dijkstra';
import { createGraph } from '../../../utils/graph/GraphFromFile';
export async function FP1(currentState: number[]) {

    console.log('currentStaeFP1', currentState);
    
    const graph = await createGraph(); // con posiciones cargadas

    const currentStateIndex = graph.findVertexByPositions(currentState);

    const prev = Dijkstra(graph, currentStateIndex); // 2771 es el nodo de destino
    const camino = reconstruirCamino(prev, currentStateIndex, 2771);
    const trayectoriaDePosiciones = obtenerTrayectoriaDePosiciones(graph, camino);
    console.log('trayectoriaDePosiciones', trayectoriaDePosiciones);
    const betterState = (() => {
        if(trayectoriaDePosiciones.length === 0) {
            return currentState; // si no hay camino, devuelve el estado actual
        }
        return trayectoriaDePosiciones[1]; // devuelve la primera posición del camino   
    })();
    const int_vibration = 0.23; //suave
    const rgb = [173, 216, 230]; //azul claro
    const frequency = 1; //frecuencia de iluminacion
    const sound = 1;
    const cubeToMove = (() => {
        for (let i = 0; i < 11; i++) {
            if (betterState[i] === 0) {
                return i;
            }
        }
        return -1;
    })();
    const cube = {
        id: cubeToMove,
        color: rgb,
        vibrationIntensity: int_vibration,
        iluminationFrequency: frequency,
        soundId: sound
    }
    console.log(cube);
    //return the cube to move
    return cube;
}

