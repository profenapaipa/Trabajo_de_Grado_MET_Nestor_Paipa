import ModalInforme, { Bloque } from './informe/ModalInforme'
import { REFERENCIAS } from './informe/fuentes'

// Panel de créditos.
//
// Esta aplicación no empieza en cero: el juego y su análisis vienen del
// trabajo de Liévano y Molina, los cubos físicos —mecánica, electrónica,
// firmware y una primera versión del software de control— los desarrolló el
// módulo INNOVA del proyecto ACACIA, y el marco de la investigación lo dirige
// Jhon Jairo Páez. Dejarlo escrito dentro de la propia aplicación, y no solo
// en el documento, es parte de hacer bien el trabajo: quien abra esto en la
// web tiene que poder ver de quién es cada cosa.
//
// Todo lo que aparece aquí está tomado del documento de la tesis y de su
// bibliografía (entradas ACACIA2025, LievanoMolina2022 y PaezGonzalez2022).

const parrafo: React.CSSProperties = { fontSize: '13.5px', lineHeight: 1.65, color: 'var(--color-paper)', margin: '0 0 10px' }
const apunte: React.CSSProperties = { fontSize: '12px', lineHeight: 1.6, color: 'var(--color-paper-dim)', margin: 0 }

function Persona({ nombre, papel }: { nombre: string; papel: string }) {
  return (
    <li style={{ marginBottom: '5px' }}>
      <b style={{ color: 'var(--color-paper)' }}>{nombre}</b>
      <span style={{ color: 'var(--color-paper-dim)' }}> — {papel}</span>
    </li>
  )
}

const lista: React.CSSProperties = { margin: '0 0 10px', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.6 }

export default function Creditos({ onCerrar }: { onCerrar: () => void }) {
  return (
    <ModalInforme
      etiqueta="Créditos"
      titulo="Quién hizo esto"
      subtitulo="Escalera Inteligente · aplicación de apoyo al trabajo de grado, construida sobre el trabajo de otras personas"
      onCerrar={onCerrar}
    >
      <Bloque titulo="Trabajo de grado">
        <p style={parrafo}>
          <b>Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio
          durante la resolución del juego La Escalera en niños con Trastorno del Espectro Autista — TEA nivel 1.</b>
        </p>
        <ul style={lista}>
          <Persona nombre="Néstor Andrés Paipa Castro" papel="autor del trabajo de grado y de esta aplicación" />
          <Persona nombre="PhD Jhon Jairo Páez Rodríguez" papel="director del trabajo de grado" />
        </ul>
        <p style={apunte}>
          Universidad Distrital Francisco José de Caldas · Facultad de Ciencias y Educación ·
          Maestría en Educación en Tecnología · Modalidad de profundización · Bogotá, 2026.
        </p>
      </Bloque>

      <Bloque titulo="Los cubos inteligentes · proyecto ACACIA">
        <p style={parrafo}>
          El diseño mecánico, electrónico y de firmware de los cubos, junto con una primera versión del software de
          control, fueron desarrollados por el <b>módulo INNOVA del proyecto ACACIA</b>
          {' '}(561754-EPP-1-2015-1-CO-EPPKA2-CBHE-JP), cofinanciado por el programa <b>Erasmus+</b> y ejecutado
          conjuntamente por la <b>Universidad NOVA de Lisboa</b> y la <b>Universidad Distrital Francisco José de
          Caldas</b> (Red CADEP ACACIA). Esta aplicación continúa ese desarrollo; no lo reemplaza.
        </p>
        <ul style={lista}>
          <Persona nombre="João Sarraipa" papel="Universidad NOVA de Lisboa" />
          <Persona nombre="John Páez" papel="Universidad Distrital Francisco José de Caldas" />
          <Persona nombre="Jeniffer López" papel="Universidad Distrital Francisco José de Caldas" />
          <Persona nombre="Rafael Fino" papel="Universidad Distrital Francisco José de Caldas" />
          <Persona nombre="Karen Roldán Piñeros" papel="diseño" />
        </ul>
        <p style={apunte}>
          Fuente: <i>Manual de Cubos Inteligentes</i>, Red CADEP ACACIA – Universidad Distrital Francisco José de
          Caldas (2025). La entrega original —firmware del maestro y de los cubos, backend y frontend— se conserva
          sin modificaciones en el repositorio de esta investigación, como referencia documental verificable del
          punto de partida.
        </p>
      </Bloque>

      <Bloque titulo="El juego La Escalera y el análisis de sus trayectorias">
        <p style={parrafo}>
          Las tres reglas del juego, el grafo de estados y la idea de leer el aprendizaje como una trayectoria sobre
          ese grafo provienen del trabajo de grado de <b>Lina Paola Liévano Chaparro</b> y <b>Rafael Ricardo Molina
          Monguí</b>, <i>Análisis de las trayectorias de aprendizaje del juego La Escalera</i> (Universidad Distrital
          Francisco José de Caldas, 2022). Las reglas implementadas aquí son exactamente las de su Figura 3.3, y el
          grafo coincide con el de su script de MATLAB: ambas cosas se comprueban en cada compilación.
        </p>
        <p style={apunte}>
          El andamiaje humano-robot que enmarca la mediación Pausar–Pensar–Actuar procede de Páez y González (2022),
          <i> Human-Robot Scaffolding: An Architecture to Foster Problem-solving Skills</i>, ACM Transactions on
          Human-Robot Interaction 11(3).
        </p>
      </Bloque>

      <Bloque titulo="Fundamento de las métricas de los informes">
        <p style={parrafo}>
          Las medidas de circuidad, ramificación y buclicidad que aparecen en los informes se apoyan en la literatura
          que se lista a continuación; cada informe lleva además sus ecuaciones con el número que tienen en el
          documento de la tesis.
        </p>
        <ol style={{ ...lista, fontSize: '12px', color: 'var(--color-paper-dim)' }}>
          {REFERENCIAS.map(r => <li key={r} style={{ marginBottom: '4px' }}>{r}</li>)}
        </ol>
      </Bloque>

      <Bloque titulo="Quienes jugaron">
        <p style={parrafo}>
          Gracias a los participantes de las sesiones piloto —cuyas bitácoras vienen incluidas en la aplicación como
          sesiones de ejemplo— y a sus familias, por autorizar el registro y el uso de esos datos.
        </p>
        <p style={apunte}>
          Los datos de personas participantes se tratan según el consentimiento informado firmado por sus padres o
          tutores legales, descrito en el capítulo de metodología del trabajo de grado.
        </p>
      </Bloque>

      <Bloque titulo="Hecho con">
        <ul style={{ ...lista, color: 'var(--color-paper-dim)' }}>
          <li><b style={{ color: 'var(--color-paper)' }}>React</b>, <b style={{ color: 'var(--color-paper)' }}>TypeScript</b> y <b style={{ color: 'var(--color-paper)' }}>Vite</b> — interfaz y compilación.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>Cytoscape.js</b> — dibujo del grafo de estados.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>Socket.IO</b> — enlace con el backend de los cubos físicos.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>Tailwind CSS</b> y <b style={{ color: 'var(--color-paper)' }}>lucide</b> — estilos base e iconografía.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>IBM Plex Sans</b> y <b style={{ color: 'var(--color-paper)' }}>IBM Plex Mono</b> — tipografía, autohospedada.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>IBM Carbon Design System</b> — la paleta de color del sistema visual.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>ESP32 / Arduino</b> — firmware de los cubos y del maestro.</li>
          <li><b style={{ color: 'var(--color-paper)' }}>OpenBCI</b> — casco de electroencefalografía previsto en el protocolo.</li>
        </ul>
        <p style={apunte}>
          Cada una de estas herramientas es software libre o de código abierto de sus respectivos autores, y se usa
          bajo sus propias licencias.
        </p>
      </Bloque>

      <Bloque titulo="Cómo citar esta aplicación">
        <p style={{ ...apunte, fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.7 }}>
          Paipa Castro, N. A. (2026). <i>Escalera Inteligente: aplicación de registro y análisis de trayectorias del
          juego La Escalera</i> [software]. Universidad Distrital Francisco José de Caldas, Maestría en Educación en
          Tecnología. Construida sobre los cubos inteligentes del módulo INNOVA del proyecto ACACIA.
        </p>
      </Bloque>
    </ModalInforme>
  )
}
