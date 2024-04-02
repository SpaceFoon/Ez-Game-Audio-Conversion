
@ECHO OFF
@REM prompt $g
@REM title %~n0
@REM color 0F
@REM set maxCount=100
@REM set count=0
@REM   rem --- Initialize.
@REM   setlocal EnableDelayedExpansion
@REM   set /A "MaxBalls = 30"
@REM   set /A "MaxX     = 81"
@REM   set /A "MaxY     = 81"
@REM   set /A  "lines=MaxY+2","cols=MaxX+1"
@REM   mode con lines=%lines% cols=%cols%
@REM   for /L %%X in (1,1,%MaxX%)  do set "BlankRow= !BlankRow!"
@REM   for /L %%B in (0,1,%MaxBalls%) do ( 
@REM     set /A "Ball_%%B.c=%%B %% 9"
@REM     set /A "Ball_%%B.x=!RANDOM! %% MaxX","Ball_%%B.i=(!RANDOM! %% 3) + 1"
@REM     set /A "Ball_%%B.y=!RANDOM! %% MaxY","Ball_%%B.j=(!RANDOM! %% 2) + 1"
@REM   )
@REM :PERPETUAL_LOOP
@REM PING localhost -n .1 >NUL
@REM   rem --- Calculate changes.
@REM   for /L %%B in (0,1,%MaxBalls%) do (
@REM     set /A "Ball_%%B.x += Ball_%%B.i" 
@REM     set /A "Ball_%%B.y += Ball_%%B.j"
@REM     if /I !Ball_%%B.x! GEQ %MaxX% set /A "Ball_%%B.x = %MaxX%","Ball_%%B.i *= -1"
@REM     if /I !Ball_%%B.x! LEQ 0      set /A "Ball_%%B.x = 0",     "Ball_%%B.i *= -1"
@REM     if /I !Ball_%%B.y! GEQ %MaxY% set /A "Ball_%%B.y = %MaxY%","Ball_%%B.j *= -1"
@REM     if /I !Ball_%%B.y! LEQ 0      set /A "Ball_%%B.y = 0",     "Ball_%%B.j *= -1"
@REM   )
@REM   rem --- Build Screen.
@REM   for /L %%Y in (0,1,%MaxY%) do (
@REM     set "Row_%%Y="
@REM     for /L %%B in (0,1,%MaxBalls%) do (
@REM       if /I !Ball_%%B.y! EQU %%Y (
@REM         if "!Row_%%Y!"=="" set "Row_%%Y=%BlankRow%"
@REM         set /A "x2 = Ball_%%B.x + 1"
@REM         call set "Row_%%Y=%%Row_%%Y:~0,!Ball_%%B.x!%%!Ball_%%B.c!%%Row_%%Y:~!x2!%%"
@REM       )
@REM     )
@REM   )
@REM   rem --- Display Screen.
@REM   cls
@REM for /L %%Y in (0,1,%maxCount%) do (
@REM     REM Check if the count has reached the maximum
@REM     if !count! gtr %maxCount% (
@REM         REM Do something if the count is greater than the maximum
@REM         echo Maximum count reached.
@REM     ) else (
@REM         REM Do something else if the count is within the limit
@REM         echo Current count: !count!
@REM     )

@REM     REM Increment the count
@REM     set /a count+=1
@REM )
@REM goto :PERPETUAL_LOOP
echo Starting build.bat...
title EZ Builder for EZ Batch Audio Convertion
set PKG_ENV=packaging
xcopy .\readmes .\dist /v /y /q
xcopy .\ffmpeg-bin .\dist /v /y /q
echo Building with pkg.js...
START pkg . -o .\dist\EZ-Game-Audio.exe --compress GZIP

:WAIT_LOOP
if not exist ".\dist\EZ-Game-Audio.exe" (
    timeout /t 1 >nul
    goto :WAIT_LOOP
)
echo pkg.js finished!
echo resedit is generating icon and meta data...
node src\ico\icon.js
echo resedit finished!
cd .\dist\
echo Zipping...
powershell -Command "Compress-Archive -Update -Path .\* -DestinationPath ..\build\EZ-Game-Audio-Conversion.zip -CompressionLevel Optimal"
echo Zipped!
echo Making .7z...
"C:\Progra~1\7-Zip\7zG.exe" a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on ..\build\EZ-Game-Audio-Conversion.7z .\* || (
    echo .7z finished!
    echo 7-Zip not found or had an error. .7z will not be made
)
del /Q * >nul
echo Build done!
exit