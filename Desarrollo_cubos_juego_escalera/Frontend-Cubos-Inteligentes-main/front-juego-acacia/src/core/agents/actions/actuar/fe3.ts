//Determina si el último cubo movido es la mejor opción de movimiento
//Ilumina en verde si es la mejor opción
//Ilumina en rojo si no es la mejor opción
import { Dijkstra, reconstruirCamino, obtenerTrayectoriaDePosiciones } from '../../../utils/Dijkstra';
import { createGraph } from '../../../utils/graph/GraphFromFile';

export async function FE3(trayectoria: Array<number[]>) {
    //Validar que hayan al menos dos movimientos realizados
    if (trayectoria.length < 2) {
        return;
    }

    //Obtener el estado anterior en la trayectoria
    const previousState = trayectoria[trayectoria.length - 2];
    const currentState = trayectoria[trayectoria.length - 1];

    //Cargar el grafo
    const graph = await createGraph(); // con posiciones cargadas

    //Cargar la ruta desde el movimiento anterior hasta el final del juego
    const previousStateIdnex = graph.findVertexByPositions(previousState);
    const prev = Dijkstra(graph, previousStateIdnex); // 2771 es el nodo de destino
    const camino = reconstruirCamino(prev, previousStateIdnex, 2771);
    const trayectoriaDePosiciones = obtenerTrayectoriaDePosiciones(graph, camino);

    //tomar el mejor movimiento
    const betterState = (() => {
        if (trayectoriaDePosiciones.length === 0) {
            return currentState; // si no hay camino, devuelve el estado actual
        }
        return trayectoriaDePosiciones[1]; // devuelve la primera posición del camino   
    })();

    //Comparar con el estado actual
    const int_vibration = 0.23; //suave
    const frequency = 1; //frecuencia de iluminacion
    const sound = 1;
    const cubeMoved = (() => {
        for (let i = 0; i < currentState.length; i++) {
            if (currentState[i] === 0) {
                return previousState[i];
            }
        }
    })();

    let rgb = [];
    if (currentState === betterState) {
        //Iluminar verde si el estado actual SI ✅ coincide con el mejor estado
        rgb = [0, 255, 0]; //VERDE

    } else {
        //Iluminar Rojo si el estado actual NO 🛑 coincide con el mejor estado
        rgb = [255, 0, 0]; //ROJO

    }
    const cube = {
        id: cubeMoved,
        color: rgb,
        vibrationIntensity: int_vibration,
        iluminationFrequency: frequency,
        soundId: sound
    }

    return cube;

}