# Guía de conexión — Cubos Inteligentes (Backend + Frontend + Maestro)

Esta guía cubre dos cosas:
1. **Configuración inicial** de un PC (se hace una sola vez por equipo).
2. **Inicio de sesión diario** (cada vez que se va a usar el sistema).

También incluye el estado actual del diagnóstico de hardware (Maestro).

---

## 1. Configuración inicial de un PC nuevo

Esto solo se hace **una vez** por computador.

### 1.1. Instalar dependencias
```powershell
cd "<ruta>\Backend-Cubos-Inteligentes-main"
npm install

cd "<ruta>\Frontend-Cubos-Inteligentes-main\front-juego-acacia"
npm install
```

### 1.2. Configurar el firewall de Windows (para que el Maestro pueda llegar al backend)
Ejecutar PowerShell **como Administrador**:
```powershell
New-NetFirewallRule -DisplayName "Backend Cubos Inteligentes (Node 3000)" `
  -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow `
  -Profile Domain,Private
```

### 1.3. Marcar la red DIE-ACACIA como "Privada"
La primera vez que te conectes a `DIE-ACACIA`, Windows puede marcarla como "Pública" (esto bloquea conexiones entrantes). Verifica con:
```powershell
Get-NetConnectionProfile
```
Si `DIE-ACACIA` aparece como `Public`, cámbiala (como Administrador):
```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

### 1.4. Verificación
Con el backend corriendo (ver sección 2) y conectado a `DIE-ACACIA`, ejecuta:
```powershell
.\Backend-Cubos-Inteligentes-main\diagnostico-red.ps1
```
Debe mostrar `OK - Status 200` tanto para `localhost` como para la IP de red, y `DIE-ACACIA` como `Private`.

---

## 2. Inicio de sesión diario (cada vez)

### 2.1. Abrir el proyecto en VS Code
Abre la carpeta `juego-escalera-vista-main` en VS Code.

### 2.2. Iniciar el backend
Abre una terminal (Terminal → New Terminal):
```powershell
cd "Backend-Cubos-Inteligentes-main"
npm run dev
```
Espera a ver:
```
Servidor corriendo en el puerto:  3000
Dirección del servidor -> localhost:3000
```

### 2.3. Iniciar el frontend
Abre **otra** terminal nueva (no cierres la del backend):
```powershell
cd "Frontend-Cubos-Inteligentes-main\front-juego-acacia"
npm run dev
```
Espera a ver la URL `http://localhost:5173/` y ábrela en el navegador.

### 2.4. Conectarse a la red de los cubos
Conecta el PC (WiFi o Ethernet) a la red **DIE-ACACIA**.
> Nota: esta red es local y **no tiene acceso a internet**. El backend y frontend funcionan igual (corren en `localhost`), pero perderás internet en el navegador mientras estés conectado a esta red.

### 2.5. Verificar la conexión con la base física
En el frontend, el indicador "Conectado / Desconectado" refleja si **la base Maestro está hablando con el backend** (no si tu PC tiene red local).
- 🟢 **Conectado**: el Maestro está enviando datos al backend correctamente.
- 🔴 **Desconectado**: el Maestro no ha hecho ninguna petición al backend en los últimos 5 segundos.

Si dice "Desconectado" estando en `DIE-ACACIA`, revisa la sección 3.

---

## 3. Estado actual / Diagnóstico (causa raíz encontrada)

**Resumen del diagnóstico realizado:**
- ✅ Backend funcionando y accesible en la red (`http://192.168.0.101:3000` respondió `200 OK`).
- ✅ Firewall configurado correctamente (regla creada y verificada).
- ✅ Red `DIE-ACACIA` configurada como `Private`.
- ✅ Mecanismo de estado (`baseStatus`) probado y funcionando.
- ✅ Se encontró el firmware real (`Maestro_Wifi.ino` y `Cubo-Esclavo.ino` en `Downloads\Propuesta de trabajo de grado en modalidad de monografía (1)\OneDrive_2026-05-22\Cubos inteligentes\`).
- ✅ El firmware del Maestro tiene hardcodeado `http://192.168.0.101:3000/...` y la IP actual del PC en `DIE-ACACIA` es **exactamente `192.168.0.101`** → coincide, no hay que cambiar nada de red.
- ✅ SSID/contraseña `DIE-ACACIA` / `DIE-ACACIA#` también coinciden con el firmware.

**Causa raíz real**: el Maestro NO empieza a comunicarse con el backend (no hace `GET /api/obtenerComando` ni `POST /api/posiciones`) hasta que se cumplen DOS condiciones en su código:
1. **Los 10 cubos esclavos deben estar conectados a la red propia del Maestro `ESP32_Master_AP` (contraseña `12345678`)**. El Maestro revisa `stationList.num == 10` — si falta uno solo, se queda esperando para siempre.
2. Las 11 entradas de la base deben estar **estables** (los cubos quietos en su posición) durante 800ms.

**Significado real de los LEDs de cada cubo** (de `Cubo-Esclavo.ino`):
- 🔴 Rojo parpadeante = el cubo está intentando conectarse a `ESP32_Master_AP` (aún no lo logra).
- 🔵 Azul fijo (parpadeo leve) = el cubo ya está conectado a `ESP32_Master_AP`. ✅ Este es el estado que necesitamos en los 10 cubos.
- Apagado = el cubo no está encendido (interruptor individual lateral, ver manual pág. 6).

> El LED "rojo fijo" del Maestro reportado antes **no corresponde a ninguna lógica de WiFi en su firmware** (no controla LEDs propios) — probablemente es solo el indicador de encendido/carga de la placa. No es un buen indicador de estado; el indicador real es si el backend empieza a recibir `GET /api/obtenerComando`.

**Próximos pasos:**
1. Encender los 10 cubos (interruptor individual, herramienta puntiaguda) y esperar a que **todos** muestren azul fijo.
2. Colocar los 10 cubos en sus posiciones de la base sin moverlos.
3. Con el backend corriendo (`npm run dev`), observar la terminal: deberían empezar a aparecer líneas `GET /api/obtenerComando 200 ... - 25` repetidas — eso confirma que el Maestro ya está hablando con el backend.
4. Si aparecen, mover un cubo de la base debería generar `POST /api/posiciones` en el backend y actualizar el frontend (`actualizarPosiciones`).

---

## 4. (Opcional) IP fija para el PC en DIE-ACACIA

Si el firmware del Maestro tiene **hardcodeada** la IP del backend, conviene que el PC siempre tenga la misma IP en `DIE-ACACIA` (ej. `192.168.0.101`). Esto se puede configurar como IP estática en el adaptador WiFi — pídelo si lo necesitas y lo dejamos configurado.
