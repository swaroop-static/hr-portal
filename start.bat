@echo off
echo ========================================
echo    HR PORTAL - Starting All Services
echo ========================================
echo.

echo [1/2] Starting Backend (port 5000)...
start "HR Portal - Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend (port 5173)...
start "HR Portal - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo  Portal is starting up!
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:5173
echo ========================================
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start http://localhost:5173
