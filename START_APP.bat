@echo off
echo ============================================
echo     PFFP App - Khoi dong PocketBase
echo ============================================
echo.
echo App se chay tai: http://127.0.0.1:8090/
echo Admin Panel:     http://127.0.0.1:8090/_/
echo.
echo Nhan Ctrl+C de tat server khi xong viec.
echo ============================================
echo.

cd /d "C:\Users\User\OneDrive - Slow Forest\Apps\PFFP\Cloude_PFFP_16Feb2026\pocketbase"
start http://127.0.0.1:8090/
pocketbase.exe serve
