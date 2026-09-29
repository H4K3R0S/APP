@echo off
REM IMPERIUM celija: prozor aplikacije sam pokrece API iz .venv.
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Celija nema svoje Python okruzenje (.venv).
  echo Pokreni u CORE repou: build_cell.py imperium "%~dp0." 4803 --update
  pause
  exit /b 1
)
start "" "%~dp0IMPERIUM.exe"
