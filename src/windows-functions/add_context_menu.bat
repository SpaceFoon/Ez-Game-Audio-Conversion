@echo off
setlocal
echo Adding EZ-Game-Audio to context menu...

:: Create config.ini on first run. Redirect-first "> file echo" writes no
:: trailing space, and no ( ) block is used: a ")" in the folder path, as in
:: "Program Files (x86)", would end the block early.
if exist "%~dp0config.ini" goto :readConfig
> "%~dp0config.ini" echo [Settings]
>> "%~dp0config.ini" echo AppPath=%~dp0EZ-Game-Audio.exe

:readConfig
set "APPPATH="
:: tokens=1,* keeps everything after the first "=", so paths may contain "=".
for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0config.ini") do if /i "%%a"=="AppPath" set "APPPATH=%%b"

:: Trim trailing spaces only (spaces inside the path, e.g. "Program Files", stay).
:trimApp
if not defined APPPATH goto :checkApp
if not "%APPPATH:~-1%"==" " goto :checkApp
set "APPPATH=%APPPATH:~0,-1%"
goto :trimApp

:checkApp
if exist "%APPPATH%" goto :register
echo ERROR: EZ-Game-Audio.exe not found at "%APPPATH%"
echo Please update the path in "%~dp0config.ini"
pause
exit /b 1

:register
:: Add context menu entries for directories
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f

reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%V\"" /f

:: Add context menu entries for audio files
for %%e in (mp3 wav flac ogg opus m4a aiff aif) do call :addFileType %%e

echo Context menu added successfully!
echo You can now right-click on folders or audio files to access EZ-Game-Audio.
pause
exit /b 0

:addFileType
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.%1\shell\EZ-Game-Audio" /ve /d "EZ-Game-Audio Convert" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.%1\shell\EZ-Game-Audio" /v "Icon" /d "%APPPATH%" /f
reg add "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.%1\shell\EZ-Game-Audio\command" /ve /d "\"%APPPATH%\" \"%%1\"" /f
exit /b 0
