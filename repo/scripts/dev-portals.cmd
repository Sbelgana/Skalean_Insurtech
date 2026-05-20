@echo off
setlocal enabledelayedexpansion

REM Skalean InsurTech -- Lance les 3 apps assure (Windows)
REM Usage : pnpm dev:portals:win

echo Skalean InsurTech -- demarrage workflow assure (3 apps Windows)
echo Ports : 3004, 3005, 3006

REM Verification ports
for %%P in (3004 3005 3006) do (
  netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul
  if !errorlevel! equ 0 (
    echo ERREUR : port %%P deja utilise. Trouver le PID : netstat -ano ^| findstr :%%P
    exit /b 1
  )
)

REM Lancement concurrently
call pnpm exec concurrently ^
  --names "customer,assure-portal,assure-mobile" ^
  --prefix-colors "blue,green,magenta" ^
  --kill-others-on-fail ^
  "pnpm --filter @insurtech/web-customer-portal dev" ^
  "pnpm --filter @insurtech/web-assure-portal dev" ^
  "pnpm --filter @insurtech/web-assure-mobile dev"

endlocal
