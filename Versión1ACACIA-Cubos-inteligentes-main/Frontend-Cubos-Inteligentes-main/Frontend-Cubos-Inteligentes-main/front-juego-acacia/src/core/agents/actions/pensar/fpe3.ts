//Terminada y functional
//Ilumina el cubo que está levantado y en mano del jugador

import { GameState } from "../../../GameState";

function fpe3(currentGameState: GameState) {

  const liftedCube = currentGameState.liftedCube;
  
  const cube = {
    id: liftedCube, //siempre se llama cuando se levanta un cubo, se asume que nunca es null
    color: [173, 216, 230], // Azul claro
    vibrationIntensity: 0.23, // Suave
    iluminationFrequency: [0.2, 0.6, 0.3, 0.4], // Frecuencia de iluminación
    soundId: 1 // ID del sonido
  }

  return cube;
}

export default fpe3;
