# Diagnostico de red para conexion Cubos Inteligentes <-> Backend
# Ejecutar como Administrador, conectado a la red DIE-ACACIA,
# y con el backend corriendo (npm run dev) en otra terminal.

Write-Host "================ PERFIL DE RED ================" -ForegroundColor Cyan
Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity | Format-Table -AutoSize

Write-Host "================ IP DEL ADAPTADOR WI-FI ================" -ForegroundColor Cyan
$myip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq "Wi-Fi" }).IPAddress
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq "Wi-Fi" } | Select-Object IPAddress, PrefixLength
Write-Host "Mi IP: $myip"

Write-Host "================ GATEWAY (ROUTER) ================" -ForegroundColor Cyan
$gw = (Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.DestinationPrefix -eq "0.0.0.0/0" -and $_.InterfaceAlias -eq "Wi-Fi" }).NextHop | Select-Object -First 1
Write-Host "Gateway: $gw"
Write-Host "--- Ping al gateway ---"
Test-Connection -ComputerName $gw -Count 2 | Select-Object Address, Status, ResponseTime

Write-Host "================ BACKEND EN LOCALHOST ================" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3
    Write-Host "OK - Status $($r.StatusCode)"
} catch { Write-Host "ERROR: $_" -ForegroundColor Red }

Write-Host "================ BACKEND EN IP DE RED ($myip) ================" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "http://${myip}:3000/" -UseBasicParsing -TimeoutSec 3
    Write-Host "OK - Status $($r.StatusCode)"
} catch { Write-Host "ERROR: $_" -ForegroundColor Red }

Write-Host "================ ESCANEANDO DISPOSITIVOS EN LA RED ($myip/24) ================" -ForegroundColor Cyan
Write-Host "Esto puede tardar ~10 segundos..."
$subnet = ($myip -split '\.')[0..2] -join '.'
$pings = 1..254 | ForEach-Object {
    $ip = "$subnet.$_"
    [PSCustomObject]@{ IP = $ip; Ping = (New-Object System.Net.NetworkInformation.Ping); Task = $null }
}
foreach ($p in $pings) { $p.Task = $p.Ping.SendPingAsync($p.IP, 800) }
[System.Threading.Tasks.Task]::WaitAll($pings.Task)
$pings | Where-Object { $_.Task.Result.Status -eq 'Success' } | Sort-Object { [int]($_.IP -split '\.')[-1] } | ForEach-Object { Write-Host $_.IP }

Write-Host "================ TABLA ARP (dispositivos detectados) ================" -ForegroundColor Cyan
arp -a

Write-Host ""
Write-Host "================ FIN DEL DIAGNOSTICO ================" -ForegroundColor Green
Write-Host "Copia toda esta salida y compartela."
