"""Alinea los marcadores de una sesión de Cubos Inteligentes con el EEG.

El archivo crudo del OpenBCI GUI ("OpenBCI Raw EXG Data", Cyton+Daisy)
trae en cada muestra la hora del PC (columna "Timestamp", segundos Unix).
Control Mago de Oz guarda sus marcadores con la hora del mismo reloj, así
que cada marcador cae en la muestra cuya hora es la más cercana.

La columna Timestamp no avanza muestra a muestra: el GUI la pone al recibir
cada paquete, así que muchas muestras seguidas comparten la misma hora y hay
saltos. Por eso no se busca la muestra "más cercana" a lo bruto, sino que se
ajusta una recta hora = a + b * muestra a todo el registro (el reloj de la
placa es estable) y con ella se convierte la hora de cada marcador en número
de muestra. El script informa la frecuencia que resulta del ajuste y el
error típico, para ver de un vistazo si el registro tuvo cortes.

Requisito: el OpenBCI GUI y el navegador con Control deben correr en el
MISMO computador (mismo reloj). Si no, hay que medir la diferencia entre
relojes y pasarla con --desfase.

Entradas de marcadores aceptadas:
  - el CSV que descarga Control ("Descargar marcadores EEG"), o
  - la bitácora en disco del backend (bitacoras/<sesion>.jsonl).

Salidas (junto al archivo EEG, o en --salida):
  - <eeg>_eventos.txt  tabla para EEGLAB: latency (s), type (código), evento, intento
  - <eeg>_marcadores.csv  con la muestra asignada a cada marcador y su error
  - con --fusionar: <eeg>_con_marcadores.txt, el mismo archivo crudo con una
    columna "Marker" añadida (código del marcador en su muestra, 0 en el resto)

Uso:
  python -I sincronizar_eeg.py "Sesion 1.txt" marcadores-eeg.csv
  python -I sincronizar_eeg.py "Sesion 1.txt" ../Backend-Cubos-Inteligentes-main/bitacoras/xxx.jsonl --fusionar

En EEGLAB (MATLAB), tras cargar el EEG:
  EEG = pop_importevent(EEG, 'event', 'Sesion 1_eventos.txt', ...
        'fields', {'latency','type','evento','intento'}, 'skipline', 1, 'timeunit', 1);
"""

import argparse
import csv
import json
import math
import sys
from pathlib import Path


def leer_eeg(ruta: Path):
    """Devuelve (cabecera, lineas_de_datos, indice_timestamp, frecuencia_nominal)."""
    cabecera, datos = [], []
    fs_nominal = None
    with ruta.open(encoding='utf-8', errors='replace') as f:
        for linea in f:
            if linea.startswith('%'):
                cabecera.append(linea)
                if 'Sample Rate' in linea:
                    try:
                        fs_nominal = float(linea.split('=')[1].split()[0])
                    except (IndexError, ValueError):
                        pass
                continue
            if linea.lstrip().startswith('Sample Index'):
                cabecera.append(linea)
                continue
            if linea.strip():
                datos.append(linea.rstrip('\r\n'))
    columnas = [c.strip() for c in cabecera[-1].split(',')]
    if 'Timestamp' not in columnas:
        sys.exit('El archivo EEG no tiene columna "Timestamp" (¿es un archivo crudo del OpenBCI GUI?).')
    return cabecera, datos, columnas.index('Timestamp'), fs_nominal


def ajustar_reloj(datos, i_ts):
    """Recta hora = a + b * muestra por mínimos cuadrados."""
    xs, ys = [], []
    for k, linea in enumerate(datos):
        partes = linea.split(',')
        try:
            t = float(partes[i_ts])
        except (IndexError, ValueError):
            continue
        if t > 1e9:  # hora Unix válida
            xs.append(k)
            ys.append(t)
    if len(xs) < 10:
        sys.exit('Muy pocas muestras con hora válida en la columna Timestamp.')
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx
    a = my - b * mx
    residuos = [y - (a + b * x) for x, y in zip(xs, ys)]
    rms = math.sqrt(sum(r * r for r in residuos) / n)
    peor = max(abs(r) for r in residuos)
    return a, b, rms, peor, ys[0], ys[-1]


def leer_marcadores(ruta: Path):
    """Lista de dicts {t (s Unix), codigo, evento, detalle, intento}."""
    out = []
    if ruta.suffix.lower() == '.jsonl':
        with ruta.open(encoding='utf-8') as f:
            for linea in f:
                if not linea.strip():
                    continue
                r = json.loads(linea)
                m = r.get('marcador') if r.get('registro') == 'marcador_eeg' else None
                if m:
                    out.append({'t': m['tsMs'] / 1000, 'codigo': int(m['codigo']), 'evento': m['evento'],
                                'detalle': m.get('detalle', ''), 'intento': m.get('intentoNum') or ''})
    else:
        with ruta.open(encoding='utf-8-sig', newline='') as f:
            for r in csv.DictReader(f):
                out.append({'t': float(r['timestamp_unix']), 'codigo': int(r['codigo']), 'evento': r['evento'],
                            'detalle': r.get('detalle', ''), 'intento': r.get('intento', '')})
    out.sort(key=lambda m: m['t'])
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('eeg', type=Path, help='archivo crudo del OpenBCI GUI (.txt)')
    ap.add_argument('marcadores', type=Path, help='CSV de marcadores de Control o bitácora .jsonl del backend')
    ap.add_argument('--desfase', type=float, default=0.0,
                    help='segundos a sumar a la hora de los marcadores (si el EEG se grabó en otro PC)')
    ap.add_argument('--salida', type=Path, help='carpeta de salida (por defecto, la del EEG)')
    ap.add_argument('--fusionar', action='store_true', help='escribir también el EEG con una columna Marker')
    args = ap.parse_args()

    cabecera, datos, i_ts, fs_nominal = leer_eeg(args.eeg)
    a, b, rms, peor, t_ini, t_fin = ajustar_reloj(datos, i_ts)
    fs = 1 / b
    print(f'EEG: {len(datos)} muestras, {t_fin - t_ini:.1f} s de registro')
    print(f'Frecuencia según el reloj del PC: {fs:.2f} Hz (nominal {fs_nominal or "?"} Hz)')
    print(f'Ajuste del reloj: error típico {rms * 1000:.1f} ms, peor {peor * 1000:.1f} ms')
    if fs_nominal and abs(fs - fs_nominal) / fs_nominal > 0.02:
        print('  AVISO: la frecuencia difiere más de un 2 % de la nominal — ¿hubo cortes o paquetes perdidos?')
    if peor > 0.5:
        print('  AVISO: algún tramo se aparta más de 0,5 s de la recta — revisar si el registro se pausó.')

    marcadores = leer_marcadores(args.marcadores)
    if not marcadores:
        sys.exit('No hay marcadores en el archivo indicado.')

    dentro, fuera = [], 0
    for m in marcadores:
        t = m['t'] + args.desfase
        muestra = round((t - a) / b)
        if 0 <= muestra < len(datos):
            dentro.append({**m, 'muestra': muestra, 'latencia_s': muestra / fs})
        else:
            fuera += 1
    print(f'Marcadores: {len(marcadores)} en total, {len(dentro)} dentro del registro EEG, {fuera} fuera')
    if fuera and not dentro:
        print('  Ninguno cae dentro del EEG: ¿son de otra sesión, o el EEG se grabó en otro PC (usar --desfase)?')

    salida = args.salida or args.eeg.parent
    salida.mkdir(parents=True, exist_ok=True)
    base = args.eeg.stem

    with (salida / f'{base}_eventos.txt').open('w', encoding='utf-8', newline='') as f:
        f.write('latency\ttype\tevento\tintento\n')
        for m in dentro:
            f.write(f"{m['latencia_s']:.4f}\t{m['codigo']}\t{m['evento']}\t{m['intento']}\n")

    with (salida / f'{base}_marcadores.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['timestamp_unix', 'muestra', 'latencia_s', 'codigo', 'evento', 'intento', 'detalle'])
        for m in dentro:
            w.writerow([f"{m['t']:.3f}", m['muestra'], f"{m['latencia_s']:.4f}", m['codigo'], m['evento'], m['intento'], m['detalle']])

    if args.fusionar:
        por_muestra = {}
        for m in dentro:
            por_muestra.setdefault(m['muestra'], m['codigo'])  # si dos caen en la misma muestra, queda el primero
        with (salida / f'{base}_con_marcadores.txt').open('w', encoding='utf-8', newline='') as f:
            for linea in cabecera[:-1]:
                f.write(linea if linea.endswith('\n') else linea + '\n')
            f.write(cabecera[-1].rstrip('\r\n') + ', Marker\n')
            for k, linea in enumerate(datos):
                f.write(f'{linea}, {por_muestra.get(k, 0)}\n')

    print(f'Listo: {salida / (base + "_eventos.txt")}')


if __name__ == '__main__':
    main()
