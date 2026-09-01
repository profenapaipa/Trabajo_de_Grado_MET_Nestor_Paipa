import { useEffect, useState } from 'react'
import { FP1 } from './core/agents/actions/pausar/fp1';
import { FP2 } from './core/agents/actions/pausar/fp2';
import { FP3 } from './core/agents/actions/pausar/fp3';
import { FPe1 } from './core/agents/actions/pensar/fpe1';
import { FPe2 } from './core/agents/actions/pensar/fpe2';
import { FPe3 } from './core/agents/actions/pensar/fpe3';
import { FE1 } from './core/agents/actions/elegir/fe1';
//import { FE2 } from './core/agents/actions/fe2';
import { FE3 } from './core/agents/actions/elegir/fe3';

import sound1 from './assets/sounds/loop.mp3';

import './App.css'
import Cube from './components/Cube'
import Platform from './components/Platform'
import { GameState } from './core/GameState';
import hexToRgbArray from './core/utils/hextToRgb';

import socket from './client-socket/sockets';

function App() {

  socket.connect()

  useEffect(() => {
    // Escuchar evento del backend para actualizar las posiciones
    socket.on('actualizarPosiciones', (data) => {
      console.log('📦 Posiciones recibidas:', data.posiciones);
      const tempPositions = [...data.posiciones]

      SimDataReceived(tempPositions)

    });

    // Limpieza del listener al desmontar
    return () => {
      socket.off('actualizarPosiciones');
    };
  }, []);



  // Set the initial state for the cubes positions
  // The array contains the IDs of the cubes in their initial position
  const teamBColor = '#ff0000'
  const teamAColor = '#0000ff'
  const emptySpaceColor = '#808080'
  const defaultVibrationIntensity = 0.3
  const defaultIluminationFrequency = 0.3

  // The element (0) represents an empty space
  const originalCubes = [
    { id: 1, color: teamAColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 2, color: teamAColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 3, color: teamAColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 4, color: teamAColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 5, color: teamAColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 0, color: emptySpaceColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 6, color: teamBColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 7, color: teamBColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 8, color: teamBColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 9, color: teamBColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency },
    { id: 10, color: teamBColor, vibrationIntensity: defaultVibrationIntensity, iluminationFrequency: defaultIluminationFrequency }
  ]

  const [cubesData, setCubesData] = useState(originalCubes);

  //Setea el estado inicial del juego y guarda el estado actual del juego
  const [gameState, setGameState] = useState<GameState>({
    cubesPositions: [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10], //Todos los cubos están puestos en sus posiciones iniciales
    liftedCube: null, //No hay cubo levantado al inicio del juego
    emptyPosition: null // No hay posición vacía al inicio del juego diferente a la que ya está
  })

  useEffect(() => {
    console.log("Estado de juego actualizado:", gameState);
    // Aquí puedes hacer lógica con el estado nuevo
  }, [gameState]);

  const cubes = gameState.cubesPositions.map((id) => {
    const cubeData = cubesData.find(c => c.id === id);
    return cubeData ?? { id: 0, color: emptySpaceColor, vibrationIntensity: 0, iluminationFrequency: 0 };
  });



  //function to render the cubes
  function renderCubes() {
    return (
      <div className="card">
        {cubes.map((cube, index) => (
          <Cube
            key={index}
            id={cube.id}
            color={cube.color}
            vibrationIntensity={cube.vibrationIntensity}
            iluminationFrequency={cube.iluminationFrequency}
            onUpdate={(newValues) => {
              setCubesData(prev => {
                const updated = [...prev];
                const i = updated.findIndex(c => c.id === cube.id);
                if (i !== -1) {
                  updated[i] = { ...updated[i], ...newValues };
                }
                return updated;
              });
            }}
          />

        ))}


      </div>

    )
  }

  //Audio player 🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷
  // Dentro de App()
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  };

  const playAudioById = (id: number) => {
    const sounds: { [key: number]: string } = {
      1: sound1,
      2: sound1,
      3: sound1,
      4: sound1,
      5: sound1,
    };

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const newAudio = new Audio(sounds[id]);
    newAudio.play();
    setCurrentAudio(newAudio);
  };
  //End audio player 🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷

  const [path, setPath] = useState<number[][]>(gameState.cubesPositions ? [gameState.cubesPositions] : []);
  useEffect(() => {
    console.log('Trayectoria actualizada (desde useEffect):', path);
  }, [path]);

  async function SimDataReceived(cubesPositions: number[]) {
    await handleStateChange([...cubesPositions]);
  }

  async function SimDataSend() {
    const int_vibration = 0.23; //suave
    const rgb = [173, 216, 230]; //azul claro
    const frequency = 1; //frecuencia de iluminacion
    const sound = 1;
    const cube = {
      id: 0,
      color: rgb,
      vibrationIntensity: int_vibration,
      iluminationFrequency: frequency,
      soundId: sound
    }

    socket.emit("comandoCubo", cube);
    console.log("Datos enviados")

  }

  async function handleStateChange(cubesPositions: number[]) {
    const emptyPositions = [];
    for (let i = 0; i < cubesPositions.length; i++) {
      if (cubesPositions[i] === 0) emptyPositions.push(i);
    }

    console.log("Estado recibido:", cubesPositions);

    // --- Caso: levantar cubo ---
    if (emptyPositions.length === 2) {
      const estadoActual = gameState.cubesPositions;
      // Buscar cuál posición se vació recientemente (estaba ocupada antes)
      const vaciada = emptyPositions.find(index => estadoActual[index] !== 0);
      const cuboLevantado = estadoActual[vaciada!];
      const nuevoEstado: GameState = {
        cubesPositions: [...cubesPositions],
        liftedCube: cuboLevantado,
        emptyPosition: vaciada!,
      };
      setCubesData(originalCubes);
      setGameState(nuevoEstado);
      stopAudio(); // Detener audio al levantar

      // --- Caso: dejar cubo ---
    } else if (emptyPositions.length === 1) {
      const nuevoEstado: GameState = {
        cubesPositions: [...cubesPositions],
        liftedCube: null,
        emptyPosition: null
      };
      setCubesData(originalCubes);

      setPath(trayectoria => [...trayectoria, cubesPositions]);
      setGameState(nuevoEstado);

      // --- Caso inesperado ---
    } else {
      console.warn("⚠️ Número inesperado de posiciones vacías:", emptyPositions.length);
    }
    //Restauración de los cubos -------------------------------------
    const mensaje = "restaurar"
    socket.emit("restaurarCubos", mensaje);
    //---------------------------------------------------------------
  }

  //Renderiza la página completa
  return (
    <>
      <h1>Juego Escalera Inteligente</h1>
      <button onClick={SimDataSend}>Simular envío de datos</button >
      <p></p>

      <div className="card">
        {renderCubes()}
      </div>
      <Platform
        playSound={playAudioById}
        currentSoundId={1}
      />

    </>
  )
}

export default App
