import { downloadFile } from '../../core/simulation/bitacora'
import { PALABRA_BALANCE, type Balance } from './interpretar'
import { METRICAS, REFERENCIAS, NOTA_ECUACIONES } from './fuentes'

// Informe descargable: un único archivo .html que se abre en cualquier
// navegador, se imprime o se guarda como PDF, y se puede enviar al tutor sin
// que tenga que abrir la aplicación ni pedir ningún otro archivo.
//
// Se construye a partir de los mismos datos que se ven en pantalla (no
// copiando el DOM): las tablas se reescriben y los grafos entran como imagen
// PNG, porque un grafo de Cytoscape vive en un <canvas> y no sobrevive a una
// copia de HTML. Tipografía del sistema y estilos incrustados: el archivo no
// hace ninguna llamada a la red (regla dura #5 del proyecto).

export type TablaDoc = {
  cols: string[]
  // 'izq' para texto, 'der' para números — por columna.
  alineacion?: ('izq' | 'der')[]
  filas: (string | number)[][]
  nota?: string
}

export type SeccionDoc = {
  titulo: string
  parrafos?: string[]
  tablas?: TablaDoc[]
  // Pares etiqueta/valor, para los resúmenes de cifras.
  datos?: { etiqueta: string; valor: string }[]
}

export type GraficoDoc = { titulo: string; dataUrl: string | null; nota?: string }

export type DocInforme = {
  etiqueta: string // "Informe del nivel" / "Informe general de la sesión"
  titulo: string
  subtitulo?: string
  meta: { etiqueta: string; valor: string }[]
  // Balance con semáforo: va primero, para quien no lea las ecuaciones.
  balance?: Balance
  sintesis: string[]
  secciones: SeccionDoc[]
  graficos: GraficoDoc[]
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ESTILO = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 28px 30px 60px; background: #ffffff; color: #0c1315;
  font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13.5px; line-height: 1.6;
}
main { max-width: 1000px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: -0.01em; }
h2 { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #455457;
     margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #aeb9bc; }
h3 { font-size: 13px; margin: 18px 0 6px; }
.etiqueta { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #0f62fe; font-weight: 600; }
.meta { font-size: 12px; color: #455457; margin: 8px 0 0; }
.meta span { margin-right: 14px; white-space: nowrap; }
.sintesis { border-left: 3px solid #0f62fe; background: #f2f5f6; padding: 12px 16px; margin: 10px 0 4px; }
.balance { border: 2px solid #0f62fe; padding: 12px 16px; margin: 18px 0 4px; }
.balance .titular { font-size: 15px; font-weight: 600; margin: 4px 0 10px; }
.sem { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; }
.sem-bien { color: #198038; } .sem-medio { color: #8e6a00; }
.sem-bajo { color: #da1e28; } .sem-nd { color: #6a787b; }
.sintesis p { margin: 0 0 6px; }
.sintesis p:last-child { margin-bottom: 0; }
.datos { display: flex; flex-wrap: wrap; gap: 18px 26px; margin: 10px 0 4px; }
.datos div { min-width: 110px; }
.datos .k { font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: #6a787b; }
.datos .v { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 18px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 12px; }
/* Sin versalitas: en mayúsculas, la ν de retornos se vuelve N y la μ de
   bucles, M. */
th { text-align: right; font-size: 11px; letter-spacing: 0.04em; color: #6a787b;
     border-bottom: 1px solid #aeb9bc; padding: 5px 7px; white-space: nowrap; }
td { text-align: right; padding: 6px 7px; border-top: 1px solid #dbe1e3;
     font-family: 'IBM Plex Mono', ui-monospace, monospace; }
th.izq, td.izq { text-align: left; font-family: inherit; }
.nota { font-size: 11px; color: #6a787b; margin: 6px 0 0; }
figure { margin: 14px 0 0; page-break-inside: avoid; }
figure img { width: 100%; height: auto; border: 1px solid #dbe1e3; border-radius: 3px; background: #fff; }
figcaption { font-size: 11px; color: #6a787b; margin-top: 5px; }
.falta { font-size: 12px; color: #6a787b; font-style: italic; }
.refs { font-size: 12px; line-height: 1.6; color: #455457; padding-left: 20px; margin: 8px 0 0; }
.refs li { margin-bottom: 4px; }
footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #dbe1e3; font-size: 11px; color: #6a787b; }
@media print {
  body { padding: 0; font-size: 11pt; }
  h2 { page-break-after: avoid; }
  table, figure { page-break-inside: avoid; }
  @page { margin: 16mm; }
}
`

function tablaHtml(t: TablaDoc): string {
  const clase = (i: number) => ((t.alineacion?.[i] ?? 'der') === 'izq' ? ' class="izq"' : '')
  const encabezado = t.cols.map((c, i) => `<th${clase(i)}>${esc(c)}</th>`).join('')
  const cuerpo = t.filas.map(f => `<tr>${f.map((v, i) => `<td${clase(i)}>${esc(v)}</td>`).join('')}</tr>`).join('\n')
  return `<table><thead><tr>${encabezado}</tr></thead><tbody>\n${cuerpo}\n</tbody></table>`
    + (t.nota ? `<p class="nota">${esc(t.nota)}</p>` : '')
}

export function construirHtml(doc: DocInforme): string {
  const generado = new Date().toLocaleString()
  const secciones = doc.secciones.map(s => {
    const partes: string[] = [`<h2>${esc(s.titulo)}</h2>`]
    if (s.datos?.length) {
      partes.push('<div class="datos">' + s.datos.map(d =>
        `<div><div class="k">${esc(d.etiqueta)}</div><div class="v">${esc(d.valor)}</div></div>`).join('') + '</div>')
    }
    for (const p of s.parrafos ?? []) partes.push(`<p>${esc(p)}</p>`)
    for (const t of s.tablas ?? []) partes.push(tablaHtml(t))
    return partes.join('\n')
  }).join('\n')

  const graficos = doc.graficos.length === 0 ? '' : `<h2>Grafos de estados</h2>\n` + doc.graficos.map(g => (
    g.dataUrl
      ? `<figure><img alt="${esc(g.titulo)}" src="${g.dataUrl}"><figcaption>${esc(g.titulo)}${g.nota ? ' — ' + esc(g.nota) : ''}</figcaption></figure>`
      : `<figure><figcaption class="falta">${esc(g.titulo)} — el grafo no se pudo incluir (estaba oculto al descargar).</figcaption></figure>`
  )).join('\n')

  // El archivo viaja solo: lleva la lectura en palabras, las ecuaciones con
  // su número en la tesis y las referencias completas.
  const comoLeer = tablaHtml({
    cols: ['Símbolo', 'Métrica', 'Qué mide', 'Cómo se lee un valor'],
    alineacion: ['izq', 'izq', 'izq', 'izq'],
    filas: METRICAS.map(m => [m.simbolo, m.nombre, m.queMide, m.ejemplo]),
    nota: 'Esta tabla basta para interpretar todo el informe. Las fórmulas están debajo, para quien las necesite.',
  })
  const ecuaciones = tablaHtml({
    cols: ['Símbolo', 'Ecuación', 'En la tesis', 'Procedencia'],
    alineacion: ['izq', 'izq', 'der', 'izq'],
    filas: METRICAS.map(m => [m.simbolo, m.ecuacion, m.numero ?? '—', m.fuente]),
    nota: NOTA_ECUACIONES,
  })
  const referencias = '<ol class="refs">' + REFERENCIAS.map(r => `<li>${esc(r)}</li>`).join('') + '</ol>'

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.etiqueta)} · ${esc(doc.titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
<main>
<div class="etiqueta">${esc(doc.etiqueta)} · Escalera Inteligente</div>
<h1>${esc(doc.titulo)}</h1>
${doc.subtitulo ? `<p class="meta">${esc(doc.subtitulo)}</p>` : ''}
<p class="meta">${doc.meta.map(m => `<span><b>${esc(m.etiqueta)}:</b> ${esc(m.valor)}</span>`).join('')}</p>
${doc.balance ? `<div class="balance">
<div class="etiqueta">Balance general · lo esencial en una mirada</div>
<p class="titular">${esc(doc.balance.titular)}</p>
${doc.balance.indicadores.length ? tablaHtml({
  cols: ['Indicador', 'Valor', 'Cómo le fue', 'Lectura'],
  alineacion: ['izq', 'der', 'izq', 'izq'],
  filas: doc.balance.indicadores.map(i => [i.nombre, i.valor, PALABRA_BALANCE[i.nivel], i.lectura]),
}) : ''}
</div>` : ''}
<h2>Síntesis</h2>
<div class="sintesis">${doc.sintesis.map(f => `<p>${esc(f)}</p>`).join('')}</div>
${secciones}
${graficos}
<h2>Cómo leer las métricas</h2>
${comoLeer}
<h2>Ecuaciones y de dónde salen</h2>
${ecuaciones}
<h2>Referencias</h2>
${referencias}
<footer>
Generado por la aplicación Escalera Inteligente el ${esc(generado)}. Este archivo es autónomo: no necesita ningún otro documento ni conexión a internet.
</footer>
</main>
</body>
</html>`
}

export function nombreArchivo(base: string, participante: string): string {
  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const quien = (participante || 'sin-nombre').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base}-${quien}-${sello}`
}

export function descargarHtml(nombre: string, doc: DocInforme): void {
  downloadFile(`${nombre}.html`, construirHtml(doc), 'text/html;charset=utf-8')
}

export function descargarJson(nombre: string, datos: unknown): void {
  downloadFile(`${nombre}.json`, JSON.stringify(datos, null, 2), 'application/json')
}

export function descargarCsv(nombre: string, csv: string): void {
  downloadFile(`${nombre}.csv`, csv, 'text/csv;charset=utf-8')
}

// Filas planas de intentos para el CSV, compartidas por los dos informes.
export function csvDeIntentos(filas: (string | number)[][], cols: string[]): string {
  const esc2 = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  return [cols.map(esc2).join(','), ...filas.map(f => f.map(esc2).join(','))].join('\n')
}
