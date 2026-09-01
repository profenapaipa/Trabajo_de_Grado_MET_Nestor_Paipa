import PlatformConfigPopup from "./PlatformConfigPopup";

function Platform({ playSound, currentSoundId }: {
    playSound: (id: number) => void,
    currentSoundId: number
}) {
    return (
        <div style={{
            width: '100%',
            height: '50px',
            margin: '0 auto',
            display: 'flex',
            backgroundColor: 'gray',
        }}>
            <PlatformConfigPopup
                currentSoundId={currentSoundId}
                onSave={({ soundId }) => {
                    playSound(soundId);
                    console.log(soundId);
                }}
            />
        </div>
    );
}

export default Platform;