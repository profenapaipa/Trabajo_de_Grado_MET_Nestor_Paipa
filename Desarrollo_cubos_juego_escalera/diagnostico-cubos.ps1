# Diagnostico Cubos Inteligentes - ejecutar sin internet
$sep  = '=' * 62
$sep2 = '-' * 62
$log  = [System.Collections.Generic.List[string]]::new()
$ts      = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$logDir  = "D:\Escritorio old\juego-escalera-vista-main\errores de diagnostico"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = "$logDir\diagnostico_$ts.txt"

function L    { param([string]$m, [string]$c='White') Write-Host $m -ForegroundColor $c; $script:log.Add($m) }
function OK   { param($m) L "  [OK]    $m" 'Green' }
function ERR  { param($m) L "  [ERROR] $m" 'Red' }
function WARN { param($m) L "  [WARN]  $m" 'Yellow' }
function SEC  { param($m) L "`n$sep2`n  $m`n$sep2" 'Cyan' }

L $sep 'Cyan'
L '  DIAGNOSTICO - CUBOS INTELIGENTES' 'Cyan'
L "  Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 'Cyan'
L $sep 'Cyan'

# 1. Red WiFi
SEC '[1] RED WIFI ACTIVA'
$iface  = netsh wlan show interfaces 2>$null
$ssid   = ($iface | Select-String '^\s+SSID\s+:' | Select-Object -First 1) -replace '.*:\s*', ''
$estado = ($iface | Select-String 'Estado'        | Select-Object -First 1) -replace '.*:\s*', ''
$senal  = ($iface | Select-String 'Senal|Signal'  | Select-Object -First 1) -replace '.*:\s*', ''
if ($ssid -match '\S') {
    OK "Conectado a: '$ssid'"
    L  "       Estado : $estado"
    L  "       Señal  : $senal"
    if ($ssid -notmatch 'acacia') { WARN "La red activa NO es Acacia — los cubos pueden no comunicarse" }
} else {
    ERR 'No hay red WiFi activa'
}

# 2. IP del PC
SEC '[2] IP LOCAL DEL PC'
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.' } |
    ForEach-Object { OK "$($_.InterfaceAlias) -> $($_.IPAddress)" }

# 3. Backend puerto 3000
SEC '[3] BACKEND (puerto 3000)'
$p3000 = netstat -ano 2>$null | Select-String '0\.0\.0\.0:3000\s|127\.0\.0\.1:3000\s'
if ($p3000) {
    OK 'Puerto 3000 ACTIVO — Backend corriendo'
    try {
        $r = Invoke-WebRequest 'http://localhost:3000/api/obtenerComando' -TimeoutSec 5 -UseBasicParsing -EA Stop
        OK "GET /api/obtenerComando -> HTTP $($r.StatusCode)"
        L  "  Respuesta: $($r.Content)"
        if ($r.Content -match 'sin_comando') { OK 'Sin comandos pendientes (normal cuando no hay juego activo)' }
        else { WARN 'Hay un comando pendiente que el ESP32 no ha recogido' }
    } catch { ERR "Backend no responde a /api/obtenerComando: $_" }
} else {
    ERR 'Puerto 3000 INACTIVO — Backend no esta corriendo'
}

# 4. Frontend puerto 5173
SEC '[4] FRONTEND (puerto 5173)'
$p5173 = netstat -ano 2>$null | Select-String '0\.0\.0\.0:5173\s|127\.0\.0\.1:5173\s'
if ($p5173) { OK 'Puerto 5173 ACTIVO — Frontend corriendo' }
else { ERR 'Puerto 5173 INACTIVO — Frontend no esta corriendo' }

# 5. Ping al ESP32 Maestro
SEC '[5] PING ESP32 MAESTRO (192.168.0.101)'
$ping = Test-Connection '192.168.0.101' -Count 4 -Quiet 2>$null
if ($ping) {
    OK 'ESP32 Maestro RESPONDE al ping'
    try {
        $rm = Invoke-WebRequest 'http://192.168.0.101:3000/api/obtenerComando' -TimeoutSec 5 -UseBasicParsing -EA Stop
        OK "API accesible via IP Maestro -> HTTP $($rm.StatusCode)"
    } catch { WARN "Maestro responde ping pero no accede al backend via 192.168.0.101:3000 — posible IP erronea en firmware" }
} else {
    ERR 'ESP32 Maestro NO responde en 192.168.0.101 — verificar encendido y red'
}

# 6. Firewall puerto 3000
SEC '[6] FIREWALL PUERTO 3000 (acceso desde ESP32)'
$tcpTest = Test-NetConnection -ComputerName 'localhost' -Port 3000 -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) { OK 'Puerto 3000 accesible localmente' }
else { ERR 'Puerto 3000 bloqueado localmente' }
$fwRule = Get-NetFirewallRule 2>$null | Where-Object { $_.DisplayName -match '3000' -or $_.DisplayName -match 'node' -or $_.DisplayName -match 'Node' }
if ($fwRule) { OK "Regla firewall existente: $($fwRule.DisplayName -join ', ')" }
else { WARN 'No hay regla firewall explicita para puerto 3000 — Windows puede bloquear conexiones entrantes del ESP32' }

# 7. Node y npm
SEC '[7] NODE.JS Y NPM'
$nv   = node  --version 2>$null
$npmv = npm   --version 2>$null
if ($nv)   { OK "Node.js : $nv" }   else { ERR 'Node.js no encontrado' }
if ($npmv) { OK "npm     : v$npmv" } else { ERR 'npm no encontrado' }

# 8. node_modules
SEC '[8] DEPENDENCIAS (node_modules)'
$fm = Test-Path 'D:\Escritorio old\juego-escalera-vista-main\Frontend-Cubos-Inteligentes-main\front-juego-acacia\node_modules'
$bm = Test-Path 'D:\Escritorio old\juego-escalera-vista-main\Backend-Cubos-Inteligentes-main\node_modules'
if ($fm) { OK 'Frontend node_modules: OK' } else { ERR 'Frontend node_modules falta — ejecutar npm install' }
if ($bm) { OK 'Backend  node_modules: OK' } else { ERR 'Backend  node_modules falta — ejecutar npm install' }

# Resumen
L "`n$sep" 'Cyan'
L '  RESUMEN' 'Cyan'
L $sep 'Cyan'
$errores = $log | Where-Object { $_ -match '\[ERROR\]' }
$avisos  = $log | Where-Object { $_ -match '\[WARN\]' }
if ($errores.Count -eq 0 -and $avisos.Count -eq 0) {
    L '  Todo OK — sistema listo' 'Green'
} else {
    if ($errores.Count -gt 0) { L "`n  ERRORES ($($errores.Count)):"; $errores | ForEach-Object { L "  $_" 'Red' } }
    if ($avisos.Count  -gt 0) { L "`n  AVISOS  ($($avisos.Count)):";  $avisos  | ForEach-Object { L "  $_" 'Yellow' } }
}

$log | Out-File -FilePath $logFile -Encoding UTF8
L "`n  Log guardado en:`n  $logFile" 'Cyan'
L $sep 'Cyan'
Read-Host "`nPresiona Enter para cerrar"
