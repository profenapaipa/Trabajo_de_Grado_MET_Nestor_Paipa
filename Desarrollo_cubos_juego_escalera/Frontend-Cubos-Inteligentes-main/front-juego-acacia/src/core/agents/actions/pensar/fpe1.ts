//Terminado funcional
//Ilumina el movmido movido en el último movimiento

export function fpe1(trayectoria: Array<number[]>){

    const currentState = trayectoria[trayectoria.length - 1];

    const previousState = (() =>{
        if(trayectoria.length > 1){
            return trayectoria[trayectoria.length - 2];
        }
        return currentState;
    })();

    const cubeMoved = (() => {

        for(let i = 0; i < currentState.length; i++){
            if(currentState[i] === 0){
                return previousState[i];
            }
        }
    })();
    const int_vibration = 0; //No vibra
    const rgb = [173, 216, 230]; //gris claro
    const frequency = 0.5; //Se ilumina suave
    const sound = 0; //sonido por definir

    const cube = {
        id: cubeMoved,
        color: rgb,
        vibrationIntensity: int_vibration,
        iluminationFrequency: frequency,
        soundId: sound
    }

    return cube;

}