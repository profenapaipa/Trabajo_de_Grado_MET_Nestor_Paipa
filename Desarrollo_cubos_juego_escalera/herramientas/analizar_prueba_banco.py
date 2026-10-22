"""Reproduce las cifras de la prueba de banco a partir de la bitácora del backend.

Lee un archivo bitacoras/<sesion>.jsonl (una línea JSON por evento; lo escribe
el backend mientras Control está abierto) y calcula lo que cita el libro en
«Verificación del prototipo (versión 3)»:

  - duración, intentos y reportes de posición (con y sin repeticiones);
  - latencia cubo -> pantalla (mediana, p90, p95, máximo);
  - rondas de identificación por IP y cuántas salieron completas;
  - cambios de lectura por casilla (una casilla que no cambia nunca mientras
    las demás sí es una casilla ciega: cableado);
  - reinicios de cubos y cuántos fueron por caída de tensión.

Si hubo dos ventanas de Control abiertas, cada hecho llega dos veces al
archivo; aquí se descartan las repeticiones (mismo tipo y detalle a menos de
1,5 s). Los archivos recientes traen además el campo `instancia`.

Uso:  python -I analizar_prueba_banco.py ruta/a/sesion.jsonl
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path


def sin_repeticiones(filas, ventana_ms=1500, clave=lambda r: (r.get('tipo'), r.get('detalle'))):
    out = []
    for r in sorted(filas, key=lambda r: r['tsBackend']):
        if out and clave(out[-1]) == clave(r) and r['tsBackend'] - out[-1]['tsBackend'] < ventana_ms:
            continue
        out.append(r)
    return out


def percentil(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    filas = [json.loads(l) for l in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines() if l.strip()]
    eventos = [r for r in filas if r.get('registro') == 'evento_cubo']
    marcadores = [r['marcador'] for r in filas if r.get('registro') == 'marcador_eeg']

    dur = (filas[-1]['tsBackend'] - filas[0]['tsBackend']) / 3.6e6
    print(f'Duración: {dur:.2f} h; {len(filas)} registros')
    tipos = Counter(r['tipo'] for r in eventos)
    print(f"Intentos iniciados: {tipos['intento_iniciado']}")

    pos = [r for r in eventos if r['tipo'] == 'posiciones']
    distintos = sin_repeticiones(pos, 300, lambda r: (json.dumps(r.get('posiciones')),))
    print(f'Reportes de posición: {len(pos)} registros, {len(distintos)} distintos ({len(pos) - len(distintos)} repetidos)')

    lat = [m['latenciaMs'] for m in marcadores if m.get('latenciaMs') is not None]
    if lat:
        print(f'Latencia cubo->pantalla (n={len(lat)}): mediana {percentil(lat, .5)} ms, '
              f'p90 {percentil(lat, .9)}, p95 {percentil(lat, .95)}, máx {max(lat)}')

    ident = sin_repeticiones([r for r in eventos if r['tipo'] == 'identificacion_cubos'])
    comp = sum('incompleta' not in r['detalle'] for r in ident)
    if ident:
        print(f'Identificación por IP: {len(ident)} rondas, {comp} completas ({round(100 * comp / len(ident))} %)')

    cambios = Counter()
    anterior = None
    for r in pos:
        p = r['posiciones']
        if anterior:
            for i, (a, b) in enumerate(zip(anterior, p)):
                if a != b:
                    cambios[i + 1] += 1
        anterior = p
    print('Cambios por casilla:', ', '.join(f'{c}: {cambios[c]}' for c in range(1, 12)))
    ciegas = [c for c in range(1, 12) if cambios[c] == 0]
    if ciegas and sum(cambios.values()) >= 16:
        print(f'  -> casillas sin ningún cambio (posibles casillas ciegas): {ciegas}')

    rein = sin_repeticiones([r for r in eventos if r['tipo'] == 'reinicio_cubo'], 3000)
    caidas = Counter(re.search(r'#(\d+)', r['detalle']).group(1) for r in rein if 'brownout' in r['detalle'])
    print(f'Reinicios de cubos: {len(rein)}; por caída de tensión: {sum(caidas.values())} {dict(caidas)}')


if __name__ == '__main__':
    main()
