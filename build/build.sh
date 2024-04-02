# set PKG_ENV=packaging &&
# echo "start bash script"
# pkg . -o .\\dist\\EZ-Game-Audio.exe --compress GZIP &&
# node src/ico/icon.js &&
# xcopy .\\readmes .\\dist /v /y /f &&
# xcopy .\\ffmpeg-bin .\\dist /v /y /f && cd .\\dist\\ &&
# powershell -Command \"Compress-Archive -Update -Path .\\* -DestinationPath ../\\build\\EZ-Game-Audio-Conversion.zip -CompressionLevel Optimal\" &&
# \"C:\\Progra~1\\7-Zip\\7zG.exe\" a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on ../\\build\\EZ-Game-Audio-Conversion.7z .\\* || echo '7-Zip not found or had an error.\n .7z will not be made'