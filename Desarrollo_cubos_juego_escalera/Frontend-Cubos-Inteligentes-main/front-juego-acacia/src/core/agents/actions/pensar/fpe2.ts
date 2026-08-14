//Terminada
//Envía diferentes frecuencias de iuluminación al último cubo movido
//Configurar patrones de iluminación

export function fpe2(trayectoria: Array<number[]>) {

    const currentState = trayectoria[trayectoria.length - 1];
    const previousState = (() => {
        if (trayectoria.length > 1) {
            return trayectoria[trayectoria.length - 2];
        }
        return currentState;
    })();

    const cubeMoved = (() => {
        for (let i = 0; i < currentState.length; i++) {
            if (currentState[i] === 0) {
                return previousState[i];
            }
        }
    })();

    //create cube with an array of frequency
    const int_vibration = 0.23; //suave
    const rgb = [173, 216, 230]; //azul claro
    const frequencies = [0.2, 0.6, 0.3, 0.4]; //frecuencia de iluminacion
    const sound = 1;

    const cube = {
        id: cubeMoved,
        color: rgb,
        vibrationIntensity: int_vibration,
        iluminationFrequency: frequencies,
        soundId: sound
    }

    //return the cube to move
    return cube;
    




}