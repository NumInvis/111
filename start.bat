@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0
set PROJECT_DIR=%PROJECT_DIR:~0,-1%

echo ==========================================
echo Variational Infinity
echo ==========================================
echo.

cd /d "%PROJECT_DIR%"

echo [1/4] Starting PostgreSQL...
docker compose up -d 2>nul
if errorlevel 1 (
    echo Docker not available, trying native PostgreSQL...
    set PGDATA=%USERPROFILE%\scoop\persist\postgresql\data
    if exist "!PGDATA!\PG_VERSION" (
        pg_ctl -D "!PGDATA!" start 2>nul
    )
)

echo [2/4] Waiting for PostgreSQL...
:WAIT
pg_isready -h localhost -p 5432 >nul 2>&1
if errorlevel 1 (
    ping -n 2 127.0.0.1 >nul
    goto WAIT
)
echo PostgreSQL ready.

echo [3/4] Pushing Prisma schema...
call pnpm db:push -- --accept-data-loss

echo [4/4] Starting services...
start "VI API (:3000)" cmd /k "cd /d %PROJECT_DIR% && pnpm dev:api"
ping -n 3 127.0.0.1 >nul
start "VI Web (:16543)" cmd /k "cd /d %PROJECT_DIR% && pnpm dev:web"

echo.
echo API:  http://localhost:3000
echo Web:  http://localhost:16543
echo.
pause
