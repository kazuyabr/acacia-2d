@echo off
setlocal

python "%~dp0stack.py"
exit /b %errorlevel%
