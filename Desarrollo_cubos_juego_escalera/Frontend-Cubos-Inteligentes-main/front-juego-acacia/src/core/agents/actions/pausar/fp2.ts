//import { LoadGraphFromFile } from '../../utils/graph/GraphFromFile';

//Revisar si está terminada
export async function fp2(trayectoria: Array<number[]>) {


    //const graph = await LoadGraphFromFile();
    const currentState = trayectoria[trayectoria.length - 1];

    //tomar el estado inicial del grafo
    const initialState = [1,2,3,4,5,0,6,7,8,9,10];
    const previousState = (() =>{
        if(trayectoria.length > 1){
            return trayectoria[trayectoria.length - 2];
        }
        return initialState;
    })();

    const cubeToMove = (() => {
        for(let i = 0; i < currentState.length; i++){
            if(currentState[i] === 0){
                return previousState[i];
            }
        }
    })(); //cubo a mover
    const int_vibration = 0; //No vibra
    const rgb = [211, 211, 211]; //gris claro
    const frequency = 0.25; //Se ilumina suave
    const sound = 0; //sonido por definir

    const cube = {
        id: cubeToMove,
        color: rgb,
        vibrationIntensity: int_vibration,
        iluminationFrequency: frequency,
        soundId: sound
    }

    return cube;
}

