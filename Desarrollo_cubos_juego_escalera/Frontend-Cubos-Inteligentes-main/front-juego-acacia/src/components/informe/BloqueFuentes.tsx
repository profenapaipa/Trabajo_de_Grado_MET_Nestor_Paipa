import { Bloque, Tabla, th, thIzq, td, tdIzq } from './ModalInforme'
import { METRICAS, REFERENCIAS, NOTA_ECUACIONES } from './fuentes'

// El cierre de todos los informes, en tres partes que se leen por separado:
// quien solo quiere entender el informe se queda en la primera tabla, y quien
// pregunta de dónde sale cada número sigue en la segunda y en las referencias.

export default function BloqueFuentes() {
  return (
    <>
      <Bloque titulo="Cómo leer las métricas"
        derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>sin fórmulas, en palabras</span>}>
        <Tabla nota="Esta tabla basta para interpretar todo el informe. Las fórmulas están en el bloque siguiente, para quien las necesite.">
          <thead><tr>
            <th style={thIzq}>Símbolo</th>
            <th style={thIzq}>Métrica</th>
            <th style={thIzq}>Qué mide</th>
            <th style={thIzq}>Cómo se lee un valor</th>
          </tr></thead>
          <tbody>
            {METRICAS.map(m => (
              <tr key={m.simbolo}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, fontSize: '13px' }}>{m.simbolo}</td>
                <td style={{ ...tdIzq, fontWeight: 600, whiteSpace: 'nowrap' }}>{m.nombre}</td>
                <td style={{ ...tdIzq, color: 'var(--color-paper-dim)' }}>{m.queMide}</td>
                <td style={{ ...tdIzq, color: 'var(--color-paper-dim)' }}>{m.ejemplo}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Bloque>

      <Bloque titulo="Ecuaciones y de dónde salen"
        derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>soporte académico</span>}>
        <Tabla nota={NOTA_ECUACIONES}>
          <thead><tr>
            <th style={thIzq}>Símbolo</th>
            <th style={thIzq}>Ecuación</th>
            <th style={th}>En la tesis</th>
            <th style={thIzq}>Procedencia</th>
          </tr></thead>
          <tbody>
            {METRICAS.map(m => (
              <tr key={m.simbolo}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, fontSize: '13px' }}>{m.simbolo}</td>
                <td style={{ ...td, textAlign: 'left', fontSize: '11.5px' }}>{m.ecuacion}</td>
                <td style={{ ...td, color: 'var(--color-paper-faint)', whiteSpace: 'nowrap' }}>{m.numero ?? '—'}</td>
                <td style={{ ...tdIzq, color: 'var(--color-paper-dim)', fontSize: '12px' }}>{m.fuente}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Bloque>

      <Bloque titulo="Referencias">
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: 1.6, color: 'var(--color-paper-dim)' }}>
          {REFERENCIAS.map(r => <li key={r} style={{ marginBottom: '4px' }}>{r}</li>)}
        </ol>
      </Bloque>
    </>
  )
}
