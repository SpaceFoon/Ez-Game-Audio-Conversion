@echo off
echo Adding EZ-Game-Audio to context menu...

:: Check if config.ini exists, create it if not
if not exist "%~dp0config.ini" (
  echo [Settings] > "%~dp0config.ini"
  echo AppPath=%~dp0EZ-Game-Audio.exe >> "%~dp0config.ini"
)

:: Read app path from config
for /f "tokens=2 delims==" %%a in ('type "%~dp0config.ini" ^| findstr AppPath') do (
  set APPPATH=%%a
)

:: Trim any spaces
set APPPATH=%APPPATH: =%

:: Check if the app exists at the specified path
if not exist "%APPPATH%" (
  echo ERROR: EZ-Game-Audio.exe not found at %APPPATH%
  echo Please update the path in "%~dp0config.ini"
  pause
  exit /b 1
)

:: Add context menu entries for directories
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%V\"" /f

:: Add context menu entries for audio files
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.mp3\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.mp3\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.mp3\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.wav\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.wav\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.wav\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.flac\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.flac\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.flac\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.ogg\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.ogg\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.ogg\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.m4a\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.m4a\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.m4a\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.aiff\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.aiff\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.aiff\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

echo Context menu added successfully!
echo You can now right-click on folders or audio files to access EZ-Game-Audio.
pause