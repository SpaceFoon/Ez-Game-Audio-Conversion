@echo off
echo Removing EZ-Game-Audio from context menu...

:: Remove folder context menu entries
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\shell\EZ-Game-Audio" /f 2>nul
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\Directory\Background\shell\EZ-Game-Audio" /f 2>nul

:: Remove file context menu entries
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.mp3\shell\EZ-Game-Audio" /f 2>nul
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.wav\shell\EZ-Game-Audio" /f 2>nul
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.flac\shell\EZ-Game-Audio" /f 2>nul
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.ogg\shell\EZ-Game-Audio" /f 2>nul
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.m4a\shell\EZ-Game-Audio" /f 2>nul
reg delete "HKEY_CURRENT_USER\SOFTWARE\Classes\SystemFileAssociations\.aiff\shell\EZ-Game-Audio" /f 2>nul

echo Context menu entries removed successfully!
echo To reinstall, run add_context_menu.bat
pause