@echo off
echo Adding EZ-Game-Audio to context menu...

:: Check if config.ini exists, create it if not
if not exist config.ini (
  echo [Settings] > config.ini
  echo AppPath=%~dp0EZ-Game-Audio.exe >> config.ini
)

:: Read app path from config
for /f "tokens=2 delims==" %%a in ('type config.ini ^| findstr AppPath') do (
  set APPPATH=%%a
)

:: Trim any spaces
set APPPATH=%APPPATH: =%

:: Check if the app exists at the specified path
if not exist "%APPPATH%" (
  echo ERROR: EZ-Game-Audio.exe not found at %APPPATH%
  echo Please update the path in config.ini
  pause
  exit /b 1
)

:: Add context menu entries
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%V\"" /f

echo Context menu added successfully!
echo You can now right-click on folders to access EZ-Game-Audio.
pause