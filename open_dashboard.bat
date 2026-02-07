@echo off
echo ==================================================
echo         [TDM] Test Data Manager - Render
echo ==================================================
echo.
echo Abrindo o painel do TDM no navegador...
start https://tdm-api-vn0v.onrender.com
echo.
echo ==================================================
echo Para rodar os testes automatizados, configure a URL:
echo.
echo set TDM_API_URL=https://tdm-api-vn0v.onrender.com
echo python test_selenium_example.py
echo ==================================================
pause
