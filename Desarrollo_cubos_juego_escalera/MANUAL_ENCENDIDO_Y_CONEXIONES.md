# Manual de encendido y conexiones — Cubos Inteligentes (versión 3)

Orden en el que se conectan y energizan el router, el computador, el backend,
el maestro y los cubos; qué se debe ver en cada paso; y cómo apagar. Complementa
`GUIA_CONEXION.md` (instalación en un PC nuevo, firewall) y
`GUIA_ENSAYO_SESION.md` (ensayo completo y mapa de pines).

> **Por qué importa el orden.** El maestro crea la red de los cubos en el
> **mismo canal que el router** (el ESP32 tiene un solo radio). Si el router no
> está listo cuando el maestro arranca, espera solo 12 s y crea esa red en el
> canal 1; cuando el router aparece después, la red de los cubos salta de canal y
> los cubos se desconectan. Y el maestro busca al backend al arrancar (si no lo encuentra,
> lo vuelve a buscar cada 30 s). Por eso: primero lo que el maestro necesita, y al final los cubos.

## Quién habla con quién

```
Navegador (Control) ──Socket.IO──► Backend (PC, puerto 3000)
                                      ▲  HTTP + UDP 4210 (descubrimiento)
                                      │
Router DIE-ACACIA ◄──WiFi── Maestro (ESP32 DevKit V1) ──WiFi propio (AP)──► Cubos 1–10
                                      ▲  cables de las 11 casillas (presencia)
                                      └─ Base de madera
```

- El PC y el maestro se conectan al **router** (red `DIE-ACACIA`, sin internet).
- Los cubos **no** se conectan al router: se conectan a la red propia del
  maestro (`ESP32_Master_AP`). Cada cubo tiene IP fija `192.168.4.(N+1)`:
  cubo 1 → `.2` … cubo 10 → `.11`.

## A. Antes de empezar (una vez por sesión)

1. **Cubos cargados**: apoyados en la base al menos 30 min (según el manual de
   ACACIA, un cubo con luz muy tenue o parpadeo rojo persistente necesita
   carga; déjalo 5 min en la base y reintenta).
2. **Firmware cargado en todo el sistema, junto**: el maestro y los 10 cubos
   deben ser de la misma fecha (el maestro manda un ping y el cubo cierra la
   conexión si no lo oye). En cada cubo se edita solo `NUMERO_CUBO` (1–10, el
   de su etiqueta). Placa del cubo: *ESP32C3 Dev Module*; del maestro: *ESP32
   Dev Module*.
3. **Un solo Control abierto.** Dos ventanas de Control duplican los eventos de
   la bitácora. La *Vista del jugador* sí puede ir en una ventana aparte.

## B. Orden de encendido

| Paso | Qué hacer | Qué debes ver | Si no |
|---|---|---|---|
| **1. Router** | Enchufar y esperar a que termine de arrancar (≈1–2 min). Dejarlo en un **canal fijo** (no «automático»). | Luces de WiFi estables | No sigas: sin router el maestro arranca sin red y los cubos quedarán saltando de canal |
| **2. PC** | Conectarlo a `DIE-ACACIA` (marcada como red **Privada**; sin internet es normal). Ver `GUIA_CONEXION.md` §1.2–1.3 | Conectado, «sin internet» | Revisar firewall (puertos 3000 y UDP 4210) |
| **3. Backend** | En `Backend-Cubos-Inteligentes-main`: `npm run dev` | `Servidor corriendo en el puerto: 3000` y `[UDP] Escuchando descubrimiento en puerto 4210` | Si el puerto está ocupado, cerrar el backend anterior |
| **4. Control** | Abrir la aplicación en el navegador (Control Mago de Oz). Ahora «Desconectado» es normal: aún no hay maestro | Pantalla de Control | — |
| **5. Maestro** | Alimentarlo: banco de energía por USB y los **tres interruptores (I, D, M) hacia la derecha** (manual ACACIA). Orden entre ellos: no está documentado; anota el que uses | LED **rojo** del maestro encendido. En el backend: `[UDP] ESP32 en … descubrió este backend` y, a los pocos segundos, «Base física conectada» | Si no aparece el UDP, el PC no está en la misma red o el firewall bloquea el 4210: reiniciar el maestro **después** de arreglarlo |
| **6. Esperar ≈ 15 s** | Dejar que el maestro termine de levantar su red | — | No encender los cubos antes de esto |
| **7. Cubos** | Encender **uno por uno** (interruptor lateral, con una punta, por el orificio de la pared izquierda del cubo). Esperar a que cada uno termine antes del siguiente | El cubo **parpadea en blanco N veces** (N = su número; verifica que coincide con la etiqueta) y luego queda **azul (1–5) o rojo (6–10)**. En Control sube «esclavos n/10» | **Magenta fijo** = no encuentra la red del maestro (el maestro no está listo, está lejos o el nombre/clave no coinciden): esperar; reintenta solo. **Parpadeo rojo o azul muy tenue** = batería: cargarlo |
| **8. Comprobar** | Con los 10 encendidos, en Control | «Conectado», **10 de 10** cubos, estados «Conectado» y latencia < 30 ms en el panel de enlace | Ver la tabla de problemas |
| **9. Base** | Botón **Probar base** (levantar y apoyar cada casilla) y luego **Reidentificar cubos (IP)** | 11/11 casillas con ✓; el tablero de pantalla igual al físico | Casillas que no cambian: ver `GUIA_ENSAYO_SESION.md` §1 |
| **10. Vista del jugador** | «Abrir en otra ventana» y arrastrarla al segundo monitor | Solo los cubos y el cronómetro | — |

**Si por error encendiste los cubos antes que el maestro:** quedan en magenta y
se conectan solos cuando el maestro aparece. Pero si el maestro llegó a
arrancar **antes que el router**, apágalo y enciéndelo de nuevo (paso 5).

## C. Durante la sesión

- **No** apagar ni reiniciar el maestro con un intento en curso.
- Si se **reinicia el maestro**: los cubos vuelven solos en unos 10 s (cierran la
  conexión vieja a los 9 s sin datos). Después pulsa **Reidentificar cubos
  (IP)**, porque el maestro vuelve a suponer el orden inicial.
- Si **cambia la IP del PC** (otro router, DHCP): el maestro conserva la
  dirección vieja del backend; reiniciar el maestro.
- Si se **reinicia el backend** con la misma IP: Control se reconecta solo.
- Un cubo en **magenta** a mitad de sesión perdió la red: revisar su batería y
  su distancia al maestro.

## D. Orden de apagado

1. Terminar o reiniciar el intento en curso; descargar bitácoras (la del
   backend queda sola en `Backend-Cubos-Inteligentes-main/bitacoras/`).
2. Cerrar Control y la Vista del jugador.
3. Apagar los **cubos** (interruptor lateral) y **apoyarlos en la base** para
   que carguen.
4. Apagar el **maestro** (interruptores I, D, M).
5. Detener el **backend** (Ctrl + C).
6. Router al final (o dejarlo encendido si hay otros equipos).

> Apagar el maestro con los cubos encendidos los deja en magenta buscando red,
> y el LED a esa intensidad gasta la batería de 180 mAh.

## E. Cuidados

- **Carga:** los cubos se cargan apoyados en la base con el maestro encendido
  (manual ACACIA). Antes de una sesión, ≥ 30 min.
- **Un solo número por cubo:** si dos cubos tienen el mismo `NUMERO_CUBO`,
  se disputan la IP y ninguno funciona bien. El panel lo anota
  (`cubo_distinto` en la bitácora).
- **Reinicios por caída de tensión:** si un cubo se reinicia solo, está sin
  batería o con un contacto flojo (el panel muestra «reinició: caída de
  tensión»).
- **Cargar firmware:** con el cubo conectado por USB-C y fuera de la base. Para
  ver mensajes por el Monitor Serie del cubo, activar *USB CDC On Boot*.
- **Contraseñas** de la red de los cubos y del router: están en el firmware
  (`Maestro_v3.ino` y `Cubo_Esclavo_v3.ino`); cámbialas ahí y en el router si el
  repositorio es público.

## F. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Control «Desconectado» con el maestro encendido | El maestro no halló al backend (backend abierto después, otra red o firewall) | Backend y red primero; reiniciar el maestro |
| Cubos magenta aunque el maestro está encendido | Maestro arrancó antes que el router, o cubos de una versión de firmware distinta | Reiniciar maestro con el router listo; cargar maestro y cubos de la misma fecha |
| Un cubo se queda sin conexión tras apagar y encender | Falta de batería o `NUMERO_CUBO` repetido | Cargarlo; comprobar el parpadeo blanco al encender |
| La pantalla muestra cubos desordenados y están en orden | La identidad inferida se descuadró | **Reidentificar cubos (IP)** |
| Casilla que no detecta que el cubo sale | Pin, cable o contacto de esa casilla | **Intercambiar dos cubos de casilla**: si la falla se queda en la casilla, es la base (ver `GUIA_ENSAYO_SESION.md` §1) |
| La señal PPA «no se siente» | Cubo con batería baja | Cargar; la vibración ya arranca a plena potencia 80 ms |
