@echo off
setlocal
cd /d "%~dp0"
set "pathTestIP=lan"
if not "%~1"=="" set "pathTestIP=%~1"
set "pathTestTLS=%LOCALAPPDATA%\PathMobile-Phone-Test\Private"
py -3 server.py --bind "%pathTestIP%" --allow-lan --port 8443 --cert "%pathTestTLS%\phone-cert.pem" --key "%pathTestTLS%\phone-key.pem"
pause
