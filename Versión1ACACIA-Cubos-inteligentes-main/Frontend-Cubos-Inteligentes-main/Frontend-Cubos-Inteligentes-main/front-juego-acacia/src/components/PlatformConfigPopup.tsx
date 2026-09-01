import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type Props = {
    currentSoundId: number,
    onSave?: (data: {
        soundId: number
    }) => void
}

function PlatformConfigPopup({ currentSoundId, onSave }: Props) {
    const [open, setOpen] = useState(false)
    const [savedMsg, setSavedMsg] = useState(false)

    const [tempSoundId, setTempSoundId] = useState(currentSoundId)

    useEffect(() => {
        setTempSoundId(currentSoundId)
    }, [currentSoundId])

    const handleSave = () => {
        onSave?.({
            soundId: tempSoundId
        })

        // Mostrar mensaje "Guardado"
        setSavedMsg(true)

        // Ocultar mensaje y cerrar modal luego de un pequeño delay
        setTimeout(() => {
            setSavedMsg(false)
            setOpen(false)
        }, 1000)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: "gray",
                        display: 'inline-block',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >

                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Configuración de la plataforma</DialogTitle>
                    <DialogDescription>
                        Ajusta las opciones según tu preferencia.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                    <label className="flex items-center space-x-2">
                        <span>Selecciona el sonido de la plataforma: </span>

                        <select name="soundId" value={tempSoundId} onChange={(e) => setTempSoundId(Number(e.target.value))}>
                            <option value={1}>Sonido 1</option>
                            <option value={2}>Sonido 2</option>
                            <option value={3}>Sonido 3</option>
                            <option value={4}>Sonido 4</option>
                            <option value={5}>Sonido 5</option>S

                        </select>
                    </label>





                    <div className="flex items-center justify-between">
                        <Button onClick={handleSave}>Guardar cambios</Button>
                        {savedMsg && <span className="text-green-600 text-sm">¡Guardado!</span>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default PlatformConfigPopup
