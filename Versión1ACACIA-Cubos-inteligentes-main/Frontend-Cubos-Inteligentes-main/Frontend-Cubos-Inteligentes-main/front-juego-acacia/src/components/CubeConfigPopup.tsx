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
  id: number,
  color: string,
  vibrationIntensity: number,
  iluminationFrequency: number,
  onSave?: (data: {
    color: string,
    vibrationIntensity: number,
    iluminationFrequency: number
  }) => void
}

function CubeConfigPopup({ id, color, vibrationIntensity, iluminationFrequency, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const [tempColor, setTempColor] = useState(color)
  const [tempIntensity, setTempIntensity] = useState(vibrationIntensity)
  const [tempFrequency, setTempFrequency] = useState(iluminationFrequency)

useEffect(() => {
  if (open) {
    setTempColor(color)
    setTempIntensity(vibrationIntensity)
    setTempFrequency(iluminationFrequency)
  }
}, [open, color, vibrationIntensity, iluminationFrequency])


  const handleSave = () => {
    onSave?.({
      color: tempColor,
      vibrationIntensity: tempIntensity,
      iluminationFrequency: tempFrequency
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
            backgroundColor: color,
            display: 'inline-block',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {id}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuración del Cubo {id}</DialogTitle>
          <DialogDescription>
            Ajusta las opciones según tu preferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <label className="flex items-center space-x-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tempIntensity}
              onChange={(e) => setTempIntensity(parseFloat(e.target.value))}
              className="accent-blue-500"
            />
            <span>Intensidad: {tempIntensity.toFixed(2)}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tempFrequency}
              onChange={(e) => setTempFrequency(parseFloat(e.target.value))}
              className="accent-blue-500"
            />
            <span>Frecuencia: {tempFrequency.toFixed(2)}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="color"
              className="w-10 h-10 border-none rounded"
              value={tempColor}
              onChange={(e) => setTempColor(e.target.value)}
            />
            <span>Color</span>
            <span>{tempColor}</span>
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

export default CubeConfigPopup
