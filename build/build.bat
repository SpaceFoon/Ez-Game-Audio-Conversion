
@ECHO OFF
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$wshell = New-Object -ComObject wscript.shell;Sleep 1;$wshell.SendKeys('{F11}');"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.WindowTitle = 'HACKED⋆༺𓆩☠︎︎𓆪༻⋆'"

@REM Change Color of text and background to something cooler. Redundant for reliability.
echo $Host.UI.RawUI.BackgroundColor = 'DarkGreen' > "%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
echo $Host.UI.RawUI.ForegroundColor = 'White' >> "%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.BackgroundColor = 'DarkGreen'"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.ForegroundColor = 'White'"
color 0A

echo Starting build.bat...
@rem This is a hack for pkg to find the node worker files.
set PKG_ENV=packaging
echo Building with pkg.js...
goto :endof
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

if exist README.pdf (
    echo PDF completed successfully.
    move README.pdf .\readmes /v /y /q
) else (
    echo Error: Conversion failed.
)

xcopy .\readmes .\dist /v /y /q
xcopy .\ffmpeg-bin .\dist /v /y /q

:WAIT_LOOP
if not exist ".\dist\EZ-Game-Audio.exe" (
    timeout /t 1 >nul
    goto :WAIT_LOOP
)
echo pkg.js finished!
if not exist ".\dist\README.pdf" (
    timeout /t 1 >nul
    goto :WAIT_LOOP
)
if not exist ".\dist\README.html" (
    timeout /t 1 >nul
    goto :WAIT_LOOP
)

echo resedit is generating icon and meta data...
node src\ico\icon.js
echo resedit finished!
cd .\dist\
echo Zipping...
powershell -Command "Compress-Archive -Update -Path .\* -DestinationPath ..\release\EZ-Game-Audio-Conversion.zip -CompressionLevel Optimal"
echo Zipped!
echo Making .7z...
"C:\Progra~1\7-Zip\7zG.exe" a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on ..\release\EZ-Game-Audio-Conversion.7z .\* || (
    echo .7z finished!
    echo 7-Zip not found or had an error. .7z will not be made
)
@REM del /Q * >nul
echo Build done!

:endof

cd .\dist\
cd ../build/frames

:loop

set /A "num_frames=13"
set /A "frame_counter=1"

:inner_loop
if exist "frame%frame_counter%.txt" (
    type "frame%frame_counter%.txt"
) else (
    echo Frame file not found: "frame%frame_counter%.txt"
)

pathping 127.0.0.1 -n -q 1 -p 90 >nul

set /A "frame_counter+=1"

set /A "frame_counter=frame_counter %% num_frames"
if %frame_counter% equ 0 set "frame_counter=%num_frames%"

cls

goto inner_loop

exit

