@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set BUILD_DIR=%SCRIPT_DIR%build
set PRODUCTION_DIR=%SCRIPT_DIR%production
set PTAU_FILE=%SCRIPT_DIR%pot12_final.ptau

echo === G3ZKP Production Circuit Compilation ===
echo Production circuits directory: %PRODUCTION_DIR%
echo Build directory: %BUILD_DIR%
echo Powers of Tau file: %PTAU_FILE%

if not exist "%PRODUCTION_DIR%" (
  echo ERROR: Production directory not found at %PRODUCTION_DIR%
  exit /b 1
)

if not exist "%PTAU_FILE%" (
  echo ERROR: Powers of Tau file not found at %PTAU_FILE%
  echo This file is required for the trusted setup phase of Groth16
  exit /b 1
)

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

echo.
echo === Installing Dependencies ===
call npm install 2>nul || echo Dependencies already installed

echo.
echo === Checking Required Tools ===

npx circom --version >nul 2>&1
if errorlevel 1 (
  echo Installing circom...
  call npm install --save-dev circom
)

npx snarkjs --version >nul 2>&1
if errorlevel 1 (
  echo Installing snarkjs...
  call npm install --save-dev snarkjs
)

if not exist "node_modules\circomlib" (
  echo Installing circomlib...
  call npm install circomlib
)

echo OK All required tools available

set SUCCESS_COUNT=0
set FAIL_COUNT=0

echo.
echo === Compiling Production Circuits ===

for %%circuit in (authentication message_security forward_secrecy message_send message_delivery key_rotation group_message) do (
  set "CIRCUIT_NAME=%%circuit"
  set "CIRCUIT_FILE=%PRODUCTION_DIR%\!CIRCUIT_NAME!.circom"
  
  if not exist "!CIRCUIT_FILE!" (
    echo ERROR: Circuit file not found: !CIRCUIT_FILE!
    set /a FAIL_COUNT+=1
  ) else (
    echo.
    echo ==========================================
    echo Compiling: !CIRCUIT_NAME! ^(Production^)
    echo ==========================================
    
    echo Step 1: Compile Circom to R1CS and WASM...
    call npx circom "!CIRCUIT_FILE!" --r1cs --wasm --sym -o "%BUILD_DIR%"
    if errorlevel 1 (
      echo ERROR: Circom compilation failed
      set /a FAIL_COUNT+=1
    ) else (
      echo OK Step 1: R1CS and WASM generated
      
      echo.
      echo Step 2: Setup Groth16 proving system...
      call npx snarkjs groth16 setup "%BUILD_DIR%\!CIRCUIT_NAME!.r1cs" "%PTAU_FILE%" "%BUILD_DIR%\!CIRCUIT_NAME!_0000.zkey"
      if errorlevel 1 (
        echo ERROR: Groth16 setup failed
        set /a FAIL_COUNT+=1
      ) else (
        echo OK Step 2: Groth16 setup complete
        
        echo.
        echo Step 3: Contribute to ceremony...
        echo g3zkp-production-%random% | npx snarkjs zkey contribute "%BUILD_DIR%\!CIRCUIT_NAME!_0000.zkey" "%BUILD_DIR%\!CIRCUIT_NAME!_final.zkey" --name="G3ZKP Production Contributor"
        if errorlevel 1 (
          echo ERROR: Ceremony contribution failed
          set /a FAIL_COUNT+=1
        ) else (
          echo OK Step 3: Ceremony contribution complete
          
          echo.
          echo Step 4: Export verification key...
          call npx snarkjs zkey export verificationkey "%BUILD_DIR%\!CIRCUIT_NAME!_final.zkey" "%BUILD_DIR%\!CIRCUIT_NAME!_verification_key.json"
          if errorlevel 1 (
            echo ERROR: Verification key export failed
            set /a FAIL_COUNT+=1
          ) else (
            echo OK Step 4: Verification key exported
            
            echo.
            echo Step 5: Export Solidity verifier...
            call npx snarkjs zkey export solidityverifier "%BUILD_DIR%\!CIRCUIT_NAME!_final.zkey" "%BUILD_DIR%\!CIRCUIT_NAME!_verifier.sol"
            echo OK Step 5: Solidity verifier exported
            
            echo OK Circuit !CIRCUIT_NAME! compiled successfully
            set /a SUCCESS_COUNT+=1
          )
        )
      )
    )
  )
)

echo.
echo ==========================================
echo === Compilation Summary ===
echo ==========================================
echo Successfully compiled: %SUCCESS_COUNT% circuits
if %FAIL_COUNT% gtr 0 (
  echo Failed: %FAIL_COUNT% circuits
)
echo Build directory: %BUILD_DIR%

echo.
echo === Generating Circuit Registry ===
(
  echo {
  echo   "version": "1.0.0",
  echo   "production": true,
  echo   "compiled_at": "%date% %time%",
  echo   "ptau": "pot12_final.ptau",
  echo   "ptau_power": 12,
  echo   "circuits": [
) > "%BUILD_DIR%\circuit_registry.json"

set first=true
for %%circuit in (authentication message_security forward_secrecy message_send message_delivery key_rotation group_message) do (
  if exist "%BUILD_DIR%\%%circuit_verification_key.json" (
    if "!first!"=="false" (
      echo, >> "%BUILD_DIR%\circuit_registry.json"
    )
    (
      echo     {
      echo       "id": "%%circuit",
      echo       "name": "%%circuit",
      echo       "wasm": "%%circuit.wasm",
      echo       "zkey": "%%circuit_final.zkey",
      echo       "verification_key": "%%circuit_verification_key.json",
      echo       "verifier_contract": "%%circuit_verifier.sol"
      echo     }
    ) >> "%BUILD_DIR%\circuit_registry.json"
    set first=false
  )
)

(
  echo.
  echo   ]
  echo }
) >> "%BUILD_DIR%\circuit_registry.json"

echo OK Circuit registry generated
type "%BUILD_DIR%\circuit_registry.json"

echo.
if %FAIL_COUNT% equ 0 (
  echo OK All production circuits compiled successfully!
  exit /b 0
) else (
  echo ERROR: Some circuits failed to compile
  exit /b 1
)
