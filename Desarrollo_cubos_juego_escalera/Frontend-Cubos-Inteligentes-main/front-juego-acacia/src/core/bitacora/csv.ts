export function toCsvGeneric<T extends object>(rows: T[], cols: (keyof T)[]): string {
  const esc = (v: unknown) => {
    if (v === undefined || v === null) return ''
    const s = Array.isArray(v) ? JSON.stringify(v) : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const header = cols.map(String).join(',')
  const rows_ = rows.map(row => cols.map(c => esc(row[c])).join(','))
  return [header, ...rows_].join('\n')
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function nowIso(): string {
  return new Date().toISOString()
}
