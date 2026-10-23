@echo off
cd /d "%~dp0"
echo Opening MediTrack 360 in your default web browser...
start "" "%~dp0static\index.html"
exit
