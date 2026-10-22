import { useState } from 'react'
import { Save } from 'lucide-react'
import { guardarInforme, type ResultadoGuardado } from '../../core/session/respaldo'
import { btnDoc } from './ModalInforme'

// «Guardar informe»: lo deja en el navegador, en la carpeta de la sesión y, si
// no hay carpeta, en las descargas. Es distinto de «Descargar informe», que
// solo baja un archivo HTML suelto: aquí el informe queda guardado con los
// datos con que se hizo (JSON) y las filas de intentos (CSV), de modo que se
// pueda regenerar o analizar aparte.

type Props = {
  tipo: 'nivel' | 'sesion' | 'macro'
  titulo: string
  base: string
  sesion: { sesionId: string; perfilId: string; inicio: string; participante: string }
  // Se piden como funciones para construir el informe solo al pulsar: el HTML
  // lleva los grafos como imagen, que solo existen con la ventana abierta.
  html: () => string
  json: () => unknown
  csv: () => string
}

function resumen(r: ResultadoGuardado): { texto: string; error: boolean } {
  if (r.error && !r.carpeta && !r.descargado && !r.navegador) return { texto: `No se pudo guardar: ${r.error}`, error: true }
  const partes: string[] = []
  if (r.navegador) partes.push('en el navegador')
  if (r.carpeta) partes.push(`en la carpeta «${r.carpeta}»`)
  if (r.descargado) partes.push('en tus descargas')
  return { texto: `Guardado ${partes.join(', ')}.`, error: !r.navegador && !r.carpeta && !r.descargado }
}

export default function GuardarInforme({ tipo, titulo, base, sesion, html, json, csv }: Props) {
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true)
    try {
      const r = await guardarInforme({ tipo, titulo, base, sesion, html: html(), json: json(), csv: csv() })
      setEstado(resumen(r))
    } catch (e) {
      setEstado({ texto: `No se pudo guardar: ${String((e as Error)?.message ?? e)}`, error: true })
    } finally { setOcupado(false) }
  }

  return (
    <>
      <button onClick={() => void guardar()} disabled={ocupado} style={btnDoc}
        title="Guarda el informe con sus datos en el navegador y en la carpeta de la sesión, o lo descarga si no hay carpeta">
        <Save size={13} /> {ocupado ? 'Guardando…' : 'Guardar informe'}
      </button>
      {estado && (
        <span role="status" style={{ fontSize: '11.5px', alignSelf: 'center', color: estado.error ? 'var(--color-offline)' : 'var(--color-online)' }}>
          {estado.texto}
        </span>
      )}
    </>
  )
}
