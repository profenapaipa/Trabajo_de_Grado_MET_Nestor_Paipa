import ModalInforme, { Bloque } from './informe/ModalInforme'
import { REFERENCIAS } from './informe/fuentes'

// Panel de créditos y reconocimientos.
//
// El desarrollo se apoya en antecedentes con autoría identificable: el
// dispositivo procede del módulo INNOVA del proyecto ACACIA, el juego y su
// análisis de trayectorias del trabajo de Liévano y Molina, y la
// investigación se realiza bajo la dirección de Jhon Jairo Páez. Dejar esa
// atribución dentro de la propia aplicación —y no solo en el documento—
// corresponde a la práctica de reconocer la procedencia de cada componente,
// sobre todo ahora que la aplicación es de acceso público.
//
// Todo lo que aparece aquí procede del documento del trabajo de grado y de su
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
      etiqueta="Créditos y reconocimientos"
      titulo="Escalera Inteligente"
      subtitulo="Aplicación de registro y análisis desarrollada en el marco del trabajo de grado de la Maestría en Educación en Tecnología, Universidad Distrital Francisco José de Caldas"
      onCerrar={onCerrar}
    >
      <Bloque titulo="Trabajo de grado">
        <p style={parrafo}>
          <b>Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio
          durante la resolución del juego La Escalera en niños con Trastorno del Espectro Autista — TEA nivel 1.</b>
        </p>
        <ul style={lista}>
          <Persona nombre="Néstor Andrés Paipa Castro" papel="autor de la investigación y del desarrollo de esta aplicación" />
          <Persona nombre="PhD Jhon Jairo Páez Rodríguez" papel="director del trabajo de grado" />
        </ul>
        <p style={apunte}>
          Universidad Distrital Francisco José de Caldas · Facultad de Ciencias y Educación ·
          Maestría en Educación en Tecnología · Modalidad de profundización · Bogotá, 2026.
        </p>
      </Bloque>

      <Bloque titulo="Antecedente tecnológico · proyecto ACACIA">
        <p style={parrafo}>
          El diseño mecánico, electrónico y de firmware de los cubos inteligentes, así como una primera versión del
          software de control, fueron desarrollados por el <b>módulo INNOVA del proyecto ACACIA</b>
          {' '}(561754-EPP-1-2015-1-CO-EPPKA2-CBHE-JP), cofinanciado por el programa <b>Erasmus+</b> y ejecutado
          conjuntamente por la <b>Universidad NOVA de Lisboa</b> y la <b>Universidad Distrital Francisco José de
          Caldas</b> (Red CADEP ACACIA). El presente desarrollo constituye una continuación de ese trabajo.
        </p>
        <p style={{ ...apunte, marginBottom: '10px' }}>Equipo de desarrollo del módulo INNOVA:</p>
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

      <Bloque titulo="Antecedente conceptual · el juego La Escalera">
        <p style={parrafo}>
          Las tres reglas del juego, el grafo de estados y el planteamiento de analizar el aprendizaje como una
          trayectoria sobre dicho grafo proceden del trabajo de grado de <b>Lina Paola Liévano Chaparro</b> y
          {' '}<b>Rafael Ricardo Molina Monguí</b>, <i>Análisis de las trayectorias de aprendizaje del juego La
          Escalera</i> (Universidad Distrital Francisco José de Caldas, 2022). Las reglas implementadas corresponden
          a las de su Figura 3.3 y el grafo coincide con el de su script de MATLAB; ambas correspondencias se
          verifican de forma automática en cada compilación.
        </p>
        <p style={apunte}>
          El modelo de andamiaje humano-robot que enmarca la mediación Pausar–Pensar–Actuar procede de Páez y
          González (2022), <i>Human-Robot Scaffolding: An Architecture to Foster Problem-solving Skills</i>, ACM
          Transactions on Human-Robot Interaction, 11(3).
        </p>
      </Bloque>

      <Bloque titulo="Fundamento teórico de las métricas">
        <p style={parrafo}>
          Los indicadores de circuidad, ramificación y buclicidad implementados en los informes se fundamentan en las
          fuentes que se relacionan a continuación. Cada informe incluye además las ecuaciones correspondientes, con
          la numeración que tienen en el documento del trabajo de grado.
        </p>
        <ol style={{ ...lista, fontSize: '12px', color: 'var(--color-paper-dim)' }}>
          {REFERENCIAS.map(r => <li key={r} style={{ marginBottom: '4px' }}>{r}</li>)}
        </ol>
      </Bloque>

      <Bloque titulo="Participación en las sesiones piloto">
        <p style={parrafo}>
          Se agradece a quienes participaron en las sesiones piloto —cuyas bitácoras se incluyen en la aplicación
          como sesiones de ejemplo— y a sus familias, por la autorización para el registro y el uso de los datos.
        </p>
        <p style={apunte}>
          Los datos de personas participantes se tratan según el consentimiento informado firmado por sus padres o
          tutores legales, descrito en el capítulo de metodología del trabajo de grado.
        </p>
      </Bloque>

      <Bloque titulo="Herramientas y tecnologías">
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
          Todas ellas son herramientas de software libre o de código abierto de sus respectivos autores, empleadas
          bajo sus licencias correspondientes.
        </p>
      </Bloque>

      <Bloque titulo="Referencia de la aplicación">
        <p style={parrafo}>
          La referencia formal para citar esta aplicación se incorporará en esta sección una vez publicado el
          artículo derivado de la investigación.
        </p>
        <p style={apunte}>
          Entretanto, cualquier uso o reproducción debe atribuirse a su autor y a los antecedentes relacionados en
          este panel.
        </p>
      </Bloque>
    </ModalInforme>
  )
}
