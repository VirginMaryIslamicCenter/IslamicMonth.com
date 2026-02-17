@echo off
REM Build and deploy script for Moon Sighting Maps
REM This script builds the Angular app and the .NET server,
REM then copies the Angular output into the server's wwwroot folder.

set SCRIPT_DIR=%~dp0
pushd %SCRIPT_DIR%\..
set ROOT_DIR=%CD%
popd

echo === Building Angular app ===
cd /d "%ROOT_DIR%"
call npx ng build --configuration production
if errorlevel 1 exit /b 1

echo === Copying Angular output to server\wwwroot ===
if exist "%ROOT_DIR%\server\wwwroot" rmdir /s /q "%ROOT_DIR%\server\wwwroot"
xcopy /s /e /i /q "%ROOT_DIR%\dist\islamic-month\browser" "%ROOT_DIR%\server\wwwroot"

echo === Building .NET server ===
cd /d "%ROOT_DIR%\server"
dotnet publish -c Release -o "%ROOT_DIR%\server\publish"
if errorlevel 1 exit /b 1

echo.
echo === Done ===
echo Publish output is in: server\publish\
echo Deploy the contents of server\publish\ to your IIS site.
echo.
echo IIS Setup:
echo   1. Install the .NET 9 Hosting Bundle on the server
echo   2. Create a new IIS site pointing to the publish folder
echo   3. Set the Application Pool to 'No Managed Code'
echo   4. Ensure the IIS_IUSRS group has read access to the folder
