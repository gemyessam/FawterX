@echo off
title ETA Invoice SaaS Launcher
echo ===================================================
echo    Egyptian ETA Invoice SaaS - Auto Launcher 🚀
echo ===================================================
echo.
echo [1/2] Starting BACKEND server (Port 5000)...
start "ETA Backend Server" cmd /k "cd backend && npm run dev"

echo [2/2] Starting FRONTEND server (Vite)...
start "ETA Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo [SUCCESS] Both servers have been launched in separate windows!
echo - Backend: http://localhost:5000
echo - Frontend: http://localhost:5173
echo ===================================================
echo.
pause
