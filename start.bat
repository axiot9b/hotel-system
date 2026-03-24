@echo off
title Hotel System
cd /d "%~dp0"

echo.
echo  ==========================================
echo   HOTEL SYSTEM - Iniciando servidor...
echo  ==========================================
echo.

REM Instalar dependencias si faltan
if not exist "backend\node_modules" (
    echo  [1/3] Instalando dependencias del backend...
    call npm install --prefix backend
    if errorlevel 1 ( echo ERROR: Fallo instalacion backend & pause & exit /b 1 )
)
if not exist "frontend\node_modules" (
    echo  [1/3] Instalando dependencias del frontend...
    call npm install --prefix frontend
    if errorlevel 1 ( echo ERROR: Fallo instalacion frontend & pause & exit /b 1 )
)

REM Instalar dependencias raiz si faltan (cross-env, concurrently)
if not exist "node_modules" (
    echo  Instalando dependencias raiz...
    call npm install
)

REM Siempre reconstruir el frontend para aplicar cambios
echo  [2/3] Construyendo frontend...
call npm run build
if errorlevel 1 ( echo ERROR: Fallo el build del frontend & pause & exit /b 1 )

echo.
echo  [3/3] Iniciando servidor en http://localhost:3001
echo  Presiona Ctrl+C para detener.
echo.

call npm run start
if errorlevel 1 ( echo. & echo ERROR: El servidor se detuvo inesperadamente & pause )
