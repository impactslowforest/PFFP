@echo off
REM ============================================
REM PFFP PocketBase Backup to Google Drive
REM Chay thu cong: double-click file nay
REM Hoac dat lich trong Windows Task Scheduler
REM ============================================

set SOURCE=C:\Users\User\OneDrive - Slow Forest\Apps\PFFP\Cloude_PFFP_16Feb2026\pocketbase\pb_data
set GDRIVE=G:\My Drive\PFFP_Backup

REM Tao ten thu muc theo ngay gio
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set DDATE=%%c-%%a-%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set DTIME=%%a%%b
set BACKUP_NAME=pb_data_%DDATE%_%DTIME%

echo ============================================
echo PFFP Backup - %date% %time%
echo ============================================
echo Source: %SOURCE%
echo Dest:   %GDRIVE%\%BACKUP_NAME%
echo.

REM Copy toan bo thu muc pb_data
xcopy "%SOURCE%" "%GDRIVE%\%BACKUP_NAME%\" /E /I /Q /Y

if %errorlevel%==0 (
    echo.
    echo [OK] Backup thanh cong: %GDRIVE%\%BACKUP_NAME%

    REM Xoa backup cu hon 7 ngay (giu 7 ban moi nhat)
    echo.
    echo Dang kiem tra backup cu...
    for /f "skip=7 delims=" %%d in ('dir /b /o-d /ad "%GDRIVE%\pb_data_*" 2^>nul') do (
        echo Xoa backup cu: %%d
        rmdir /s /q "%GDRIVE%\%%d"
    )
) else (
    echo.
    echo [LOI] Backup that bai!
)

echo.
echo ============================================
pause
