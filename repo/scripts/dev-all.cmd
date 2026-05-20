@echo off
setlocal enabledelayedexpansion

REM Skalean InsurTech -- Lance les 7 apps Next.js (Windows)
REM Usage : pnpm dev:all:win
REM Pre-requis : machine 16+ GB RAM minimum

echo ===============================================================================
echo   Skalean InsurTech -- demarrage de 7 apps Next.js (Windows)
echo ===============================================================================
echo.
echo   ATTENTION : consommation RAM cumulee estimee 3-5 GB.
echo   Recommande : machine avec 16 GB RAM minimum.
echo.
echo   Si RAM ^< 16 GB, utiliser plutot : pnpm dev:portals:win
echo.

REM Detection RAM Windows (en MB)
for /f "tokens=2 delims==" %%I in ('wmic ComputerSystem get TotalPhysicalMemory /value ^| findstr "TotalPhysicalMemory"') do set RAM_BYTES=%%I
set /a RAM_GB=!RAM_BYTES! / 1073741824
echo   RAM totale detectee : !RAM_GB! GB

if !RAM_GB! lss 16 (
  echo   WARN : moins de 16 GB de RAM. Continuer ? [Y/N]
  set /p REPLY=
  if /i not "!REPLY!"=="Y" exit /b 0
)

REM Verification ports
for %%P in (3000 3001 3002 3003 3004 3005 3006) do (
  netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul
  if !errorlevel! equ 0 (
    echo ERREUR : port %%P deja utilise.
    exit /b 1
  )
)

echo   Tous les ports sont libres. Demarrage en cours.
echo.

call pnpm exec concurrently ^
  --names "admin,broker,garage,garage-mob,customer,assure-p,assure-m" ^
  --prefix-colors "red,blue,yellow,cyan,green,magenta,white" ^
  --kill-others-on-fail ^
  --restart-tries 0 ^
  "pnpm --filter @insurtech/web-insurtech-admin dev" ^
  "pnpm --filter @insurtech/web-broker dev" ^
  "pnpm --filter @insurtech/web-garage dev" ^
  "pnpm --filter @insurtech/web-garage-mobile dev" ^
  "pnpm --filter @insurtech/web-customer-portal dev" ^
  "pnpm --filter @insurtech/web-assure-portal dev" ^
  "pnpm --filter @insurtech/web-assure-mobile dev"

endlocal
