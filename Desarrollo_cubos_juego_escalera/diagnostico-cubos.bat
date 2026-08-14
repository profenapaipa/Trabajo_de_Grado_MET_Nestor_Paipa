@echo off
chcp 65001 >nul
title Diagnostico - Cubos Inteligentes

net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoExit -ExecutionPolicy Bypass -File "D:\Escritorio old\juego-escalera-vista-main\diagnostico-cubos.ps1"
