@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "OUTPUT_DIR=%ROOT_DIR%out"
set "DIST_DIR=%ROOT_DIR%dist"
set "APP_EXE=%OUTPUT_DIR%\win-unpacked\AI Status Beacon.exe"
set "TOOLS_DIR=%ROOT_DIR%tools"
set "NSIS_RESOURCES_VERSION=3.4.1"
set "NSIS_RESOURCES_ROOT=%TOOLS_DIR%\nsis-resources"
set "NSIS_RESOURCES_EXTRACTED_DIR=%NSIS_RESOURCES_ROOT%\electron-builder-binaries-nsis-resources-%NSIS_RESOURCES_VERSION%"
set "NSIS_RESOURCES_DIR=%NSIS_RESOURCES_EXTRACTED_DIR%\nsis-resources"
set "NSIS_RESOURCES_ZIP=%NSIS_RESOURCES_ROOT%\nsis-resources-%NSIS_RESOURCES_VERSION%.zip"
set "NSIS_RESOURCES_URL=https://cdn.npmmirror.com/binaries/electron-builder-binaries/nsis-resources-%NSIS_RESOURCES_VERSION%/nsis-resources-%NSIS_RESOURCES_VERSION%.zip"
set "ZIP_FILE="
set "MODE=%~1"

if not defined MODE set "MODE=release"

if /I not "%MODE%"=="release" if /I not "%MODE%"=="dir" (
    echo Usage: build-win.bat [release^|dir]
    exit /b 1
)

pushd "%ROOT_DIR%" >nul

echo ========================================
echo Building Windows package...
echo Mode: %MODE%
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found in PATH.
    popd >nul
    exit /b 1
)

echo [1/4] Clearing proxy environment variables for this process...
set "http_proxy="
set "https_proxy="
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "all_proxy="
set "NO_PROXY=*"
set "npm_config_proxy="
set "npm_config_https_proxy="
set "NPM_CONFIG_PROXY="
set "NPM_CONFIG_HTTPS_PROXY="
set "GLOBAL_AGENT_HTTP_PROXY="
set "GLOBAL_AGENT_HTTPS_PROXY="
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"

echo [2/4] Cleaning old build output...
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"

echo [3/4] Running build...
call npm run build
if errorlevel 1 (
    set "BUILD_RESULT=%errorlevel%"
    goto :collect
)

if /I "%MODE%"=="dir" (
    call npm run pack:win:dir
    set "BUILD_RESULT=%errorlevel%"
    goto :collect
)

call :ensure_nsis_resources
if errorlevel 1 (
    set "BUILD_RESULT=%errorlevel%"
    goto :collect
)

set "ELECTRON_BUILDER_NSIS_RESOURCES_DIR=%NSIS_RESOURCES_DIR%"
call npm run pack:win:installer
if errorlevel 1 (
    set "BUILD_RESULT=%errorlevel%"
    goto :collect
)

call npm run pack:win:dir
if errorlevel 1 (
    set "BUILD_RESULT=%errorlevel%"
    goto :collect
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-Content -Raw -Encoding UTF8 'package.json' | ConvertFrom-Json).version"`) do set "APP_VERSION=%%I"
if not defined APP_VERSION (
    set "BUILD_RESULT=1"
    goto :collect
)

set "ZIP_FILE=%OUTPUT_DIR%\AI Status Beacon-%APP_VERSION%-win-x64.zip"
if exist "%ZIP_FILE%" del /f /q "%ZIP_FILE%"

powershell -NoProfile -Command "Compress-Archive -Path '%OUTPUT_DIR%\win-unpacked\*' -DestinationPath '%ZIP_FILE%' -CompressionLevel Optimal"
set "BUILD_RESULT=%errorlevel%"

echo.
:collect
echo [4/4] Collecting artifacts...
if exist "%APP_EXE%" (
    echo unpacked: %APP_EXE%
) else (
    echo unpacked: not found
)

if defined ZIP_FILE (
    if exist "%ZIP_FILE%" (
        echo zip:
        echo %ZIP_FILE%
    ) else (
        echo zip: not found
    )
) else (
    echo zip: not found
)

if exist "%OUTPUT_DIR%\*.exe" (
    echo setup:
    dir /b "%OUTPUT_DIR%\*.exe"
) else (
    echo setup: not found
)

echo.
if "%BUILD_RESULT%"=="0" (
    echo Build completed successfully.
) else (
    echo Build failed with exit code %BUILD_RESULT%.
)
echo ========================================

popd >nul
exit /b %BUILD_RESULT%

:ensure_nsis_resources
if exist "%NSIS_RESOURCES_DIR%\plugins\x86-unicode\UAC.dll" exit /b 0

echo Preparing NSIS resources...
if not exist "%NSIS_RESOURCES_ROOT%" mkdir "%NSIS_RESOURCES_ROOT%"
if exist "%NSIS_RESOURCES_EXTRACTED_DIR%" rmdir /s /q "%NSIS_RESOURCES_EXTRACTED_DIR%"

curl.exe --noproxy * -L "%NSIS_RESOURCES_URL%" -o "%NSIS_RESOURCES_ZIP%"
if errorlevel 1 exit /b 1

powershell -NoProfile -Command "Expand-Archive -Path '%NSIS_RESOURCES_ZIP%' -DestinationPath '%NSIS_RESOURCES_ROOT%' -Force"
if errorlevel 1 exit /b 1

if exist "%NSIS_RESOURCES_DIR%\plugins\x86-unicode\UAC.dll" exit /b 0
exit /b 1
