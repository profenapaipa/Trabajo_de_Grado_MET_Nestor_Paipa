
@echo off
title Cubos Inteligentes - Lanzador

set "ROOT=%~dp0"

echo.
echo  =====================================================
echo    CUBOS INTELIGENTES - Iniciando Sistema
echo  =====================================================
echo.

:: ---- PASO 0: liberar los puertos 5173 (frontend) y 3000 (backend) ----
:: Si queda un Vite viejo (por ejemplo de otra copia del proyecto) ocupando
:: el 5173, Vite salta en silencio a otro puerto y este script igual abre
:: el navegador en 5173 -- mostrando lo que sea que haya ahi, no lo que se
:: acaba de arrancar. Se libera antes de empezar para evitarlo.
echo  [0/4] Liberando puertos 5173 y 3000 si estan ocupados...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173,3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: ---- PASOS 1-2: Abrir FRONTEND en nueva ventana PowerShell ----
echo  [1/4] Abriendo ventana FRONTEND...
start "FRONTEND - Cubos Inteligentes" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; Write-Host '=== FRONTEND - Cubos Inteligentes ===' -ForegroundColor Cyan; Set-Location '%ROOT%Frontend-Cubos-Inteligentes-main\front-juego-acacia'; npm run dev -- --port 5173 --strictPort"

:: ---- PASO 3: Esperar que Vite arranque y abrir navegador ----
echo  [2/4] Esperando que Vite inicie (12 segundos)...
timeout /t 12 /nobreak >nul
echo  [3/4] Abriendo navegador en http://localhost:5173 ...
start http://localhost:5173

:: ---- PASOS 4-5: Abrir BACKEND en nueva ventana PowerShell ----
echo  [4/4] Abriendo ventana BACKEND...
start "BACKEND - Cubos Inteligentes" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; Write-Host '=== BACKEND - Cubos Inteligentes ===' -ForegroundColor Green; Set-Location '%ROOT%Backend-Cubos-Inteligentes-main'; npm run dev"

echo.
echo  =====================================================
echo   Listo. Revisa las ventanas abiertas:
echo   - Frontend : http://localhost:5173
echo   - Backend  : http://localhost:3000
echo  =====================================================
echo.
pause
