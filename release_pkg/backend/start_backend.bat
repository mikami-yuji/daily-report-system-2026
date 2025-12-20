@echo off
cd /d "%~dp0"
py -u main.py > backend_debug.log 2>&1
