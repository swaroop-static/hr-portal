@echo off
echo ========================================
echo    HR PORTAL - First Time Setup
echo ========================================
echo.

echo [1/4] Installing backend dependencies...
cd /d %~dp0backend
call npm install

echo.
echo [2/4] Setting up database...
call npx prisma db push

echo.
echo [3/4] Seeding database with demo users...
call node src/seed.js

echo.
echo [4/4] Installing frontend dependencies...
cd /d %~dp0frontend
call npm install

echo.
echo ========================================
echo  Setup Complete!
echo.
echo  Run start.bat to launch the portal
echo.
echo  Login credentials:
echo  Manager:     manager@company.com / manager123
echo  HR:          hr@company.com / hr123
echo  Interviewer: interviewer@company.com / interviewer123
echo ========================================
pause
