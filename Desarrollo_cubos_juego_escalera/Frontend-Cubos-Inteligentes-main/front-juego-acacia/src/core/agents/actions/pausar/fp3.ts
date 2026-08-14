//Terminado
//Ilumina todos los cubos

export function fp3() {

    const cubes: Array<{ 
        id: number, 
        color: number[], 
        vibrationIntensity: number, 
        iluminationFrequency: number, 
        soundId: number 
    }> = [];

    for (let i = 1; i < 11; i++) {
        const int_vibration = 0.25; //suave
        const rgb = [238, 130, 238]; //violeta claro
        const frequency = 0.25; //frecuencia de iluminacion
        const sound = 1;

        const cube = {
            id: i,
            color: rgb,
            vibrationIntensity: int_vibration,
            iluminationFrequency: frequency,
            soundId: sound
        }

        cubes.push(cube);
    }

    return cubes;
}
