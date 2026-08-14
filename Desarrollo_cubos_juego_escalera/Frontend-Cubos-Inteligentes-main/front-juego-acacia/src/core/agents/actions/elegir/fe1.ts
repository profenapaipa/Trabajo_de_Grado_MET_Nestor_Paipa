//Terminado funcional
//Ilumina los cubos que son posibles movimientos según las reglas del juego

import { createGraph } from '../../../utils/graph/GraphFromFile';


export async function FE1(currentState: number[]) {

    const graph = await createGraph();
    const currentStateIndex = graph.findVertexByPositions(currentState);

    //Obtiene los índices de los nodos vecinos del estado actual
    const possibleMovesIndices = graph.neighbors(currentStateIndex);
    //Obtiene las posiciones de los nodos vecinos
    const possibleMoves = possibleMovesIndices.map(index => graph.getPositions(index));

    const possibleCubesToMove = (() => {
        const cubesIndices = [];
        for(const position of possibleMoves) {
            for (let i = 0; i < 11; i++) {
                if (position[i] === 0) {
                    cubesIndices.push(currentState[i]) //Guarda el índice del cubo que se puede mover
                }
            }

        }
        return cubesIndices;
    })();

    const possibleCubesData = []
    for (const cubeIndex of possibleCubesToMove) {
        const int_vibration = 0.23; //suave
        const rgb = [173, 216, 230]; //azul claro
        const frequency = 1; //frecuencia de iluminacion
        const sound = 1;
        const cube = {
            id: cubeIndex,
            color: rgb,
            vibrationIntensity: int_vibration,
            iluminationFrequency: frequency,
            soundId: sound
        }
        possibleCubesData.push(cube);
    }

    return possibleCubesData;

}