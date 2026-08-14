@echo off
title Cubos Inteligentes - Lanzador

set "ROOT=%~dp0"

echo.
echo  =====================================================
echo    CUBOS INTELIGENTES - Iniciando Sistema
echo  =====================================================
echo.

:: ---- PASOS 1-2: Abrir FRONTEND en nueva ventana PowerShell ----
echo  [1/4] Abriendo ventana FRONTEND...
start "FRONTEND - Cubos Inteligentes" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; Write-Host '=== FRONTEND - Cubos Inteligentes ===' -ForegroundColor Cyan; Set-Location '%ROOT%Frontend-Cubos-Inteligentes-main\front-juego-acacia'; npm run dev"

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
