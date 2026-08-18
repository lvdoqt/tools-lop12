@echo off
echo ============================================
echo   Tools All - Khoi dong ung dung
echo ============================================
echo.

echo [1/2] Khoi dong Python Backend (FastAPI)...
start "ToolsAll-Backend" cmd /k "cd /d d:\tools\backend && python main.py"

echo [2/2] Khoi dong React Frontend (Vite)...
timeout /t 3 /nobreak >nul
start "ToolsAll-Frontend" cmd /k "cd /d d:\tools\frontend && npm run dev"

echo.
echo ============================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   API Docs: http://localhost:8000/docs
echo ============================================
echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
