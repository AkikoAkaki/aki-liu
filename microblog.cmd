@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo [错误] 未检测到 Node.js，请先安装 Node.js && pause && exit /b 1)
node scripts\microblog-server.js
pause
