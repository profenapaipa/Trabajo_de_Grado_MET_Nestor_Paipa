import CubeConfigPopup from './CubeConfigPopup';

import socket from '../client-socket/sockets';
import hexToRgbArray from '../core/utils/hextToRgb';

function Cube({
    id,
    color,
    vibrationIntensity,
    iluminationFrequency,
    onUpdate
}: {
    id: number;
    color: string;
    vibrationIntensity: number;
    iluminationFrequency: number;
    onUpdate: (newValues: {
        color: string;
        vibrationIntensity: number;
        iluminationFrequency: number;
    }) => void;
}) {
    const cubeSize = 50;

    return (
        <div
            style={{
                width: cubeSize + 'px',
                height: cubeSize + 'px',
                display: 'inline-block',
                margin: '5px',
                backgroundColor: color
            }}
        >

            <CubeConfigPopup
                id={id}
                color={color}
                vibrationIntensity={vibrationIntensity}
                iluminationFrequency={iluminationFrequency}
                onSave={(newValues) => {
                    onUpdate(newValues); //Se notifica a App.tsx del cambio
                    // Emitir evento al servidor con los nuevos datos
                    socket.emit('comandoCubo', {
                        cuboID: id,
                        frecuencia: newValues.iluminationFrequency,
                        vibracion: newValues.vibrationIntensity,
                        color: hexToRgbArray(newValues.color),
                    });
                }}
            />
        </div>
    );
}

export default Cube;