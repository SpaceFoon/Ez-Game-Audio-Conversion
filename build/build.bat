
@ECHO OFF
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.WindowTitle = 'EZ GAME EZ BUILDER'"
color 0A
@REM Change Color of text and background to something cooler. Redundant for reliability.
@REM Go to the following file path and delete the file to get your terminal colors back.
@REM Don't worry, your old ones are somewhere else.
@REM echo $Host.UI.RawUI.BackgroundColor = 'DarkGreen' > "%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
@REM echo $Host.UI.RawUI.ForegroundColor = 'White' >> "%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
@REM powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.BackgroundColor = 'DarkGreen'"
@REM powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.ForegroundColor = 'White'"

echo Starting build.bat...
@rem This is a hack for pkg to find the node worker files.
set PKG_ENV=packaging
echo Building with pkg.js...

START pkg . -o .\dist\EZ-Game-Audio.exe --compress GZIP

@REM Make HTML and PDF from markdown file then copy them over to dist
echo Making HTML...
start npx markdown-to-html --source README.md --output ./readmes/README.html
if errorlevel 1 (
    echo Error: Markdown to HTML conversion failed.
    pause
    exit /b 1
) else (
    echo Markdown to HTML conversion successful.
)
echo Done with HTML. Making PDF...
echo Creating PDF

start md-to-pdf ./README.md

:WAIT_LOOPP
timeout /t 1 >nul
if exist README.pdf (
    echo PDF completed successfully.
   xcopy README.pdf .\readmes /v /y /q
   del "README.pdf"
) else (
    
    goto :WAIT_LOOPP
)


timeout /t 1 >nul
xcopy .\readmes .\dist /v /y /q
xcopy .\ffmpeg-bin .\dist /v /y /q
xcopy .\src\add_context_menu.bat .\dist /v /y /q
xcopy .\src\remove_context_menu.bat .\dist /v /y /q
:WAIT_LOOP
timeout /t 1 >nul

if not exist ".\dist\EZ-Game-Audio.exe" (
    goto :WAIT_LOOP
)
echo pkg.js finished!
if not exist ".\dist\README.pdf" (
    goto :WAIT_LOOP
)
if not exist ".\dist\README.html" (
    goto :WAIT_LOOP
)

@REM echo resedit is generating icon and meta data...
node src\ico\icon.js
@REM echo resedit finished!
timeout /t 1 >nul

echo Zipping...
powershell -Command "Compress-Archive -Update -Path .\dist\* -DestinationPath .\release\EZ-Game-Audio-Conversion.zip -CompressionLevel Optimal"
echo Zipped!
echo Making .7z...
cd ./dist/
"C:\Progra~1\7-Zip\7zG.exe" a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on ..\release\EZ-Game-Audio-Conversion.7z .\* || (
    echo .7z finished!
    echo 7-Zip not found or had an error. .7z will not be made
)

del /Q * >nul
echo Build done!

cd ../build/frames

TITLE HACKED!
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$wshell = New-Object -ComObject wscript.shell;Sleep 1;$wshell.SendKeys('{F11}');"

echo " _____                                                                                                     _____ ";
echo "( ___ )                                                                                                   ( ___ )";
echo " |   |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|   | ";
echo " |   |                                                                                                     |   | ";
echo " |   |       ________  ___  ___  ___  ___       ________                                                   |   | ";
echo " |   |      |\   __  \|\  \|\  \|\  \|\  \     |\   ___ \                                                  |   | ";
echo " |   |      \ \  \|\ /\ \  \\\  \ \  \ \  \    \ \  \_|\ \                                                 |   | ";
echo " |   |       \ \   __  \ \  \\\  \ \  \ \  \    \ \  \ \\ \                                                |   | ";
echo " |   |        \ \  \|\  \ \  \\\  \ \  \ \  \____\ \  \_\\ \                                               |   | ";
echo " |   |         \ \_______\ \_______\ \__\ \_______\ \_______\                                              |   | ";
echo " |   |          \|_______|\|_______|\|__|\|_______|\|_______|                                              |   | ";
echo " |   |                                                                                                     |   | ";
echo " |   |                                                                                                     |   | ";
echo " |   |                                                                                                     |   | ";
echo " |   |       ________  ________  _____ ______   ________  ___       _______  _________  _______            |   | ";
echo " |   |      |\   ____\|\   __  \|\   _ \  _   \|\   __  \|\  \     |\  ___ \|\___   ___\\  ___ \           |   | ";
echo " |   |      \ \  \___|\ \  \|\  \ \  \\\__\ \  \ \  \|\  \ \  \    \ \   __/\|___ \  \_\ \   __/|          |   | ";
echo " |   |       \ \  \    \ \  \\\  \ \  \\|__| \  \ \   ____\ \  \    \ \  \_|/__  \ \  \ \ \  \_|/__        |   | ";
echo " |   |        \ \  \____\ \  \\\  \ \  \    \ \  \ \  \___|\ \  \____\ \  \_|\ \  \ \  \ \ \  \_|\ \       |   | ";
echo " |   |         \ \_______\ \_______\ \__\    \ \__\ \__\    \ \_______\ \_______\  \ \__\ \ \_______\      |   | ";
echo " |   |          \|_______|\|_______|\|__|     \|__|\|__|     \|_______|\|_______|   \|__|  \|_______|      |   | ";
echo " |   |                                                                                                     |   | ";
echo " |___|~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|___| ";
echo "(_____)                                                                                                   (_____)";

pathping 127.0.0.1 -n -q 1 -p 3500 >nul

set /A "num_frames=13"
set /A "frame_counter=1"

:inner_loop
if exist "frame%frame_counter%.txt" (
    type "frame%frame_counter%.txt"
) else (
    echo Frame file not found: "frame%frame_counter%.txt"
)

pathping 127.0.0.1 -n -q 1 -p 80 >nul

set /A "frame_counter+=1"

set /A "frame_counter=frame_counter %% num_frames"
if %frame_counter% equ 0 set "frame_counter=%num_frames%"

cls

goto inner_loop

exit

