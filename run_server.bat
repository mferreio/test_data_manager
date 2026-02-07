@echo off
echo Iniciando servidor TDM...
echo Portais:
echo   - Backend API: http://127.0.0.1:8000/docs
echo   - Frontend: Abra o arquivo frontend/index.html
echo.
uvicorn backend.main:app --reload
pause
