@echo off
cd /d %~dp0
call venv\Scripts\activate.bat
cd my_flask_project
waitress-serve --host=0.0.0.0 --port=5000 --threads=4 app.run:app 
pause