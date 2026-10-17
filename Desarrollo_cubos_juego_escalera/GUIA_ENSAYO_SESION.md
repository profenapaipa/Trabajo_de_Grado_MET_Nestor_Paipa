# Guía de ensayo de una sesión — Cubos Inteligentes + EEG

Lista para un **ensayo completo sin participante** antes de la primera
sesión real, y para repetir (abreviada) al comienzo de cada sesión. Se
complementa con `GUIA_CONEXION.md` (red, firewall, arranque del backend y
del frontend) y `ESTADO_VISUAL_CUBOS.md` (qué significa cada color).

---

## 1. Mapa de pines (tomado del firmware, 2026-10-16)

El manual de ACACIA no trae el diagrama eléctrico; esto es lo que el
código supone. Conviene confirmarlo con un multímetro una vez y anotar
aquí lo que se encuentre.

### Base (maestro, ESP32 DevKit V1 — `Maestro_v3.ino`, `pinesBase`)

| Casilla (pantalla) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GPIO del maestro | 39 | 34 | 35 | 27 | 14 | 17 | 18 | 19 | 21 | 22 | 23 |
| Resistencia interna | ✗ | ✗ | ✗ | pulldown | pulldown | pulldown | pulldown | pulldown | pulldown | pulldown | pulldown |

- Cada casilla lee **ALTO = hay un cubo**. El cubo pone ese nivel con su
  pin `Pfcaja` a través del contacto de la casilla.
- **Casillas 1, 2 y 3** (GPIO 39, 34, 35) son pines solo-entrada del ESP32
  y no tienen resistencia interna: si la base no tiene una resistencia a
  tierra en esas tres, con la casilla vacía el pin "flota" y la lectura
  salta sola. La prueba de la base (abajo) lo delata: la casilla se pone
  azul/blanca sin tocarla. Remedio: una resistencia de 10–100 kΩ de cada
  uno de esos pines a GND en la base.
- Las otras 8 tienen activado el pulldown interno desde el 2026-10-16
  (inofensivo si ya hay resistencias externas).
- Para que el nivel del cubo signifique algo, cubo y base deben **compartir
  tierra** por un contacto (el manual confirma que los cubos se cargan en la
  base, así que ya hay contactos de alimentación).

### Cubo (ESP32-C3 SuperMini — `Cubo_Esclavo_v3.ino`)

| Función | GPIO | Nota |
|---|---|---|
| LED rojo / verde / azul | 4 / 3 / 2 | PWM |
| Motor de vibración | 5 | PWM |
| Presencia hacia la base (`Pfcaja`) | 6 | Salida en ALTO; `ID=0` la baja 250 ms para identificar el cubo |
| Medición de batería (`BATERIA_PIN`) | — | **Desactivada en esta versión** (`BATERIA_PIN = -1`): los cubos no se modifican. Ver §2 |

---

## 2. Señal y reinicios de cada cubo (y batería, para una próxima versión)

Cada cubo manda cada 5 s la señal WiFi (dBm), el motivo de su último
arranque y cuánto lleva encendido. Control lo muestra en el panel lateral
**"Cubos · conexión y señal"**: "señal débil" por debajo de −72 dBm, y en
rojo si el último arranque fue anómalo (caída de tensión, fallo del
programa, vigilante), con una fila `reinicio_cubo` en la bitácora. Un
"reinició: caída de tensión (brownout)" en mitad de una sesión casi siempre
es batería baja o un contacto flojo: es el único indicio de batería que hay
hoy, sin tocar el hardware.

**Batería — próxima versión.** El firmware, el maestro, el backend y
Control ya están listos para mostrarla (pila con el porcentaje bajo cada
cubo, columna en el panel, aviso y fila `bateria_baja` por debajo de 20 %);
hoy no se ve nada porque cada cubo informa "medición desactivada". Para
activarla en un cubo:

1. Soldar un divisor 100 kΩ + 100 kΩ: BAT+ → 100k → GPIO1 → 100k → GND.
2. En `Cubo_Esclavo_v3.ino` poner `BATERIA_PIN = 1` y cargarlo.

Control la muestra sola, sin otros cambios. Sin divisor no hay que
activarla: el pin al aire da lecturas sin sentido (el firmware las descarta
como "sin divisor de tensión"). Tener en cuenta que, apoyado en la base, el
cubo se carga y la batería se lee más alta de lo que tiene.

---

## 3. Ensayo completo (sin participante)

Marcar cada punto. Si algo falla, anotarlo en `PENDIENTES_TESIS.md` antes de
seguir.

### Antes de encender
- [ ] Cubos cargados (al menos 30 min en la base).
- [ ] Router DIE-ACACIA encendido; PC conectado a esa red, marcada "Privada".
- [ ] OpenBCI: casco, gel/electrodos, dongle conectado; OpenBCI GUI **en el
      mismo PC** que el navegador de Control (mismo reloj — ver §4).
- [ ] Reloj del PC sincronizado (Configuración → Hora → "Sincronizar ahora").

### Arranque
- [ ] Backend (`npm run dev` en `Backend-Cubos-Inteligentes-main`). Debe decir
      `Servidor corriendo en el puerto: 3000`.
- [ ] Frontend (`npm run build` y `npx vite preview`, o `npm run dev`).
- [ ] Encender la base y los 10 cubos. En Control: "Conectado" y
      "esclavos 10/10"; cada cubo azul (1-5) o rojo (6-10).
- [ ] Panel "Cubos · conexión y señal": los 10 con señal mejor que −72 dBm.
      Ninguno en rojo (reinicio anómalo).

### Base
- [ ] **Probar base** (botón junto a "Identificar cubos"): levantar y
      apoyar el cubo de cada casilla, una por una, hasta 11/11. Una casilla
      que no llega a ✓, o que cambia sola sin tocarla, apunta al cableado
      (ver §1).
- [ ] **Identificar cubos** con dos cubos intercambiados a propósito: el
      tablero de pantalla debe quedar igual al físico y marcar en blanco los
      dos cubos fuera de lugar.

### Partida de prueba (5 pares)
- [ ] Abrir la **Vista del jugador** en el segundo monitor.
- [ ] **Iniciar intento**: cuenta regresiva con tonos en pantalla y destellos
      en los cubos.
- [ ] Levantar un cubo: flota en pantalla (Control y Vista del jugador) en
      menos de ~150 ms. Revisar la latencia en el panel lateral (mediana y
      p95 en verde/amarillo).
- [ ] Jugada inválida a propósito: cubo naranja + vibración, los 10 en
      Pausar, cronómetro detenido, la pantalla muestra adónde volver.
      Devolverlo: el intento sigue solo.
- [ ] Pausar / Reanudar desde Control.
- [ ] Enviar Pausar, Pensar y Actuar a un cubo de cada equipo.
- [ ] Llegar a un bloqueo o a la victoria; reordenar; los cubos vuelven a su
      color.
- [ ] **Minimizar Control** 30 s durante un intento y volver: la cuenta
      regresiva, el apagado automático de señales y el cronómetro no se
      atrasan (corren en un worker desde el 2026-10-16). Aun así, mejor no
      minimizar: dejar Control en su propio monitor.

### Al terminar
- [ ] Bitácora en disco: `Backend-Cubos-Inteligentes-main/bitacoras/<sesión>.jsonl`
      existe y crece con cada evento (no hace falta exportar para no perder
      nada si el navegador se cierra).
- [ ] Exportar desde Control: bitácora de cubos, bitácora del operador y
      **marcadores EEG (CSV)**.
- [ ] Guardar el archivo crudo del OpenBCI GUI.
- [ ] Correr la sincronización (§4) y revisar sus avisos.

---

## 4. Sincronización con el EEG

Control registra **marcadores** (inicio del intento, "¡YA!", cada cubo
levantado, cada jugada válida o inválida, pausas, señales PPA del operador,
victoria/bloqueo…) con la hora del reloj del PC. Las jugadas del tablero no
llevan la hora de llegada a la pantalla sino la **hora física estimada**
(se descuentan el antirrebote de la base, la espera en el maestro y el
viaje por la red).

El OpenBCI GUI guarda en cada muestra la hora del mismo reloj (columna
`Timestamp`). Para alinear:

```
python -I herramientas/sincronizar_eeg.py "<archivo OpenBCI>.txt" "<marcadores-eeg-....csv>"
```

(o la bitácora en disco `.jsonl` en lugar del CSV). Produce:

- `<eeg>_eventos.txt` — para EEGLAB:
  `EEG = pop_importevent(EEG, 'event', '<eeg>_eventos.txt', 'fields', {'latency','type','evento','intento'}, 'skipline', 1, 'timeunit', 1);`
- `<eeg>_marcadores.csv` — muestra asignada a cada marcador.
- con `--fusionar`: el archivo crudo con una columna `Marker`.

Probado con `Versión1ACACIA-.../Sesión 1.txt` (125 Hz nominal): el ajuste
del reloj da 125,09 Hz, error típico ~140 ms. **Ese error es del propio
OpenBCI GUI**, que pone la hora por lotes al recibir los paquetes; el script
lo reduce ajustando una recta a todo el registro, pero queda una
incertidumbre de ~0,1 s. Sirve para analizar ventanas de segundos
(intentos, fases PPA); **no alcanza para potenciales evocados** (ERP,
escala de ms).

Si se necesita precisión de milisegundos, la vía es un **disparador por
cable**: un pin libre del maestro conectado a una entrada digital de la
Cyton (D11/D12/D17, modo "Digital" en el GUI), con un pulso en cada evento.
Queda como mejora de hardware pendiente (ver `PENDIENTES_TESIS.md`).

Marcadores por UDP en vivo (opcional, sin probar): arrancar el backend con
`OPENBCI_MARCADORES=<host>:<puerto>` y el backend manda el código de cada
marcador como texto por UDP a esa dirección. Sirve si la versión instalada
del OpenBCI GUI tiene un widget de marcadores con entrada UDP (revisar su
puerto en el propio GUI) o para cualquier otro programa que escuche UDP. No
reemplaza la sincronización por reloj.

### Códigos de marcador

| Código | Evento | Código | Evento |
|---|---|---|---|
| 10 | intento iniciado (Iniciar) | 30 | pausa del operador |
| 11 | "¡YA!" — puede mover | 31 | reanudar |
| 20 | cubo levantado | 32 / 33 / 34 | señal Pausar / Pensar / Actuar |
| 21 | jugada válida | 35 | señal apagada (estado inicial) |
| 22 | jugada inválida | 40 / 41 | victoria / bloqueo |
| 23 | pausa automática | 42 | reinicio manual |
| 24 | corrección completada | 43 | tablero reordenado |

No cambiar estos códigos entre sesiones: el análisis los usa.
