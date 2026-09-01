// Indicador de "carga" hacia una sugerencia de PPA — un anillo que se va
// llenando con cada falla, para que se vea cuándo el sistema está por
// sugerir la fase (nunca activarla sola, solo sugerirla).

function PpaChargeMeter({ value, max, colorHex, label }: {
  value: number
  max: number
  colorHex: string
  label: string
}) {
  const pct = Math.max(0, Math.min(value / max, 1))
  const size = 42, stroke = 5, r = (size - stroke) / 2, c = 2 * Math.PI * r

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorHex} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill="#fff">
          {value}/{max}
        </text>
      </svg>
      <div style={{ fontSize: '11px', color: '#999' }}>{label}</div>
    </div>
  )
}

export default PpaChargeMeter
