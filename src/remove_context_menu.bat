@echo off
echo Removing EZ-Game-Audio from context menu...

:: Remove context menu entries
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /f
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /f

echo Context menu entries removed successfully!
pause