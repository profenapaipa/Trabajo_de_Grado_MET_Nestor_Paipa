import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Download, ExternalLink, FolderOpen, HardDrive, Trash2, Upload } from 'lucide-react'
import { Panel, SectionTitle } from '../ui/brand'
import { sectionLabel, smallBtn } from '../ui/styles'
import { leerSalud, suscribirSalud } from '../core/session/almacen'
import { elegirCarpeta, leerCarpeta, olvidarCarpeta, reactivarCarpeta, suscribirCarpeta } from '../core/session/carpeta'
import { borrarInforme, exportarRespaldo, importarRespaldo, leerVersionInformes, listarInformes, suscribirInformes, type InformeGuardado } from '../core/session/respaldo'
import { cargarArchivo } from '../core/session/perfiles'

// Respaldo de sesiones e informes.
//
// Existe porque se perdieron sesiones: el navegador guarda lo suyo en un
// almacén interno de capacidad limitada que el usuario no ve, y cuando se
// llena o se abre la aplicación por otra dirección, el historial desaparece
// sin avisar. Este panel hace visible dónde está guardado todo y da tres
// salidas que no dependen de esa memoria: una carpeta del disco, los informes
// guardados y una copia de seguridad completa en un archivo.

const aviso: React.CSSProperties = { fontSize: '11.5px', lineHeight: 1.55, color: 'var(--color-paper-dim)' }
const fila: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }

function Linea({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ ...sectionLabel, marginBottom: '6px' }}>{titulo}</div>
      {children}
    </div>
  )
}

function abrirEnPestana(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function PanelRespaldo({ alCambiar }: { alCambiar: () => void }) {
  const salud = useSyncExternalStore(suscribirSalud, leerSalud)
  const carpeta = useSyncExternalStore(suscribirCarpeta, leerCarpeta)
  const [informes, setInformes] = useState<InformeGuardado[]>([])
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const sesiones = cargarArchivo().sesiones.length

  const versionInformes = useSyncExternalStore(suscribirInformes, leerVersionInformes)
  const refrescar = () => { void listarInformes().then(setInformes) }
  useEffect(refrescar, [salud.ultimoGuardado, versionInformes])

  const nota = (texto: string, error = false) => setMensaje({ texto, error })

  async function restaurar(f: File | null | undefined) {
    if (!f) return
    const r = importarRespaldo(await f.text())
    if (!r.ok) return nota(r.error, true)
    nota(r.nuevas > 0
      ? `Copia restaurada: ${r.nuevas} ${r.nuevas === 1 ? 'sesión nueva' : 'sesiones nuevas'} de ${r.sesiones} que traía el archivo.`
      : `La copia traía ${r.sesiones} ${r.sesiones === 1 ? 'sesión' : 'sesiones'}, y todas ya estaban guardadas aquí.`)
    alCambiar()
    if (entrada.current) entrada.current.value = ''
  }

  const idbMal = salud.idb !== 'ok'
  const hora = salud.ultimoGuardado ? new Date(salud.ultimoGuardado).toLocaleTimeString() : null

  return (
    <Panel>
      <SectionTitle>Respaldo de sesiones e informes</SectionTitle>
      <div style={aviso}>
        Cada sesión se guarda sola en la memoria del navegador y, si eliges una carpeta, también en tu disco.
        Aquí ves dónde está todo y puedes sacarlo a un archivo.
      </div>

      <Linea titulo="Memoria del navegador">
        <div style={{ ...fila, fontSize: '12px', color: idbMal ? 'var(--color-offline)' : 'var(--color-online)' }}>
          <HardDrive size={13} />
          {idbMal
            ? 'No disponible: el historial depende de una memoria pequeña que se llena. Elige una carpeta o descarga una copia.'
            : <>Activa · <b>{sesiones}</b> {sesiones === 1 ? 'sesión guardada' : 'sesiones guardadas'}{hora ? ` · último guardado ${hora}` : ''}</>}
        </div>
        {salud.local === 'lleno' && !idbMal && (
          <div style={{ ...aviso, marginTop: '4px' }}>
            La memoria rápida del navegador (localStorage) está llena. No se pierde nada por eso: lo principal
            está en la otra, que admite mucho más.
          </div>
        )}
      </Linea>

      <Linea titulo="Carpeta en tu equipo">
        {!carpeta.soportada ? (
          <div style={aviso}>
            Este navegador no deja elegir una carpeta (solo Chrome y Edge). Los informes se descargan como archivos
            normales, y la copia de seguridad de abajo sirve igual.
          </div>
        ) : (
          <>
            <div style={{ ...fila, fontSize: '12px' }}>
              <FolderOpen size={13} />
              {carpeta.nombre
                ? <>Carpeta <b>«{carpeta.nombre}»</b> · {carpeta.permiso === 'granted'
                  ? <span style={{ color: 'var(--color-online)' }}>guardando cada sesión</span>
                  : <span style={{ color: 'var(--color-caution)' }}>falta el permiso de escritura</span>}</>
                : 'Ninguna elegida todavía.'}
            </div>
            <div style={{ ...fila, marginTop: '8px' }}>
              <button onClick={() => void elegirCarpeta().then(ok => ok && nota('Carpeta elegida. Cada intento se copiará ahí.'))} style={smallBtn}>
                <FolderOpen size={11} /> {carpeta.nombre ? 'Cambiar carpeta' : 'Elegir carpeta'}
              </button>
              {carpeta.nombre && carpeta.permiso !== 'granted' && (
                <button onClick={() => void reactivarCarpeta().then(ok => nota(ok ? 'Permiso concedido.' : 'No se concedió el permiso.', !ok))}
                  style={{ ...smallBtn, borderColor: 'var(--color-caution)', color: 'var(--color-caution)' }}>
                  Permitir escribir
                </button>
              )}
              {carpeta.nombre && <button onClick={() => void olvidarCarpeta()} style={smallBtn}>Quitar</button>}
            </div>
            <div style={{ ...aviso, marginTop: '6px' }}>
              Dentro se crea una carpeta por perfil y, en ella, una por sesión, con la sesión completa y los informes
              que guardes. Después de recargar la página, el navegador pide volver a conceder el permiso: es una
              restricción suya, no un fallo.
            </div>
            {carpeta.error && <div style={{ ...aviso, color: 'var(--color-offline)', marginTop: '4px' }}>Último error: {carpeta.error}</div>}
          </>
        )}
      </Linea>

      <Linea titulo={`Informes guardados en el navegador · ${informes.length}`}>
        {informes.length === 0 ? (
          <div style={aviso}>
            Aún no hay ninguno. Dentro de cualquier informe, el botón <b>Guardar informe</b> lo deja aquí, en tu
            carpeta y en tus descargas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {informes.map(i => (
              <div key={i.id} style={{ ...fila, justifyContent: 'space-between', fontSize: '11.5px', borderTop: '1px solid var(--color-line)', paddingTop: '6px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'var(--color-paper)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.titulo}</div>
                  <div style={{ color: 'var(--color-paper-faint)' }}>{i.participante} · {new Date(i.creado).toLocaleString()}</div>
                </div>
                <button onClick={() => abrirEnPestana(i.html)} style={smallBtn} title="Abrir en otra pestaña"><ExternalLink size={11} /></button>
                <button onClick={() => descargar(`${i.titulo}.html`.replace(/[^\w.-]+/g, '-'), i.html, 'text/html;charset=utf-8')} style={smallBtn} title="Descargar"><Download size={11} /></button>
                <button onClick={() => void borrarInforme(i.id)} style={smallBtn} title="Borrar"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </Linea>

      <Linea titulo="Copia de seguridad completa">
        <div style={aviso}>
          Todos los perfiles y todas las sesiones en un solo archivo. Es la salida que sirve siempre, con cualquier
          navegador, y la que permite pasar el historial a otro equipo o a otra dirección de la aplicación.
        </div>
        <input ref={entrada} type="file" accept=".json,application/json" aria-label="Copia de seguridad en formato JSON"
          onChange={e => void restaurar(e.target.files?.[0])}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
        <div style={{ ...fila, marginTop: '8px' }}>
          <button onClick={() => {
            const sello = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
            descargar(`escalera-copia-${sello}.json`, exportarRespaldo(), 'application/json')
            nota('Copia descargada.')
          }} style={smallBtn}><Download size={11} /> Descargar copia</button>
          <button onClick={() => entrada.current?.click()} style={smallBtn}><Upload size={11} /> Restaurar copia…</button>
        </div>
      </Linea>

      {mensaje && (
        <div style={{ fontSize: '11.5px', marginTop: '12px', lineHeight: 1.5, color: mensaje.error ? 'var(--color-offline)' : 'var(--color-online)' }}>
          {mensaje.texto}
        </div>
      )}
    </Panel>
  )
}
