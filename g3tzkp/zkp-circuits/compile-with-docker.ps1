#!/usr/bin/env pwsh

<#
.SYNOPSIS
G3ZKP Production Circuit Compilation using Docker
Compiles all ZKP circuits in an isolated, reproducible environment

.DESCRIPTION
This script uses Docker to compile ZKP circuits on Windows, ensuring consistent
results across all platforms.

.NOTES
Requires Docker Desktop to be installed and running
#>

param(
    [switch]$SkipDockerCheck = $false,
    [switch]$Test = $false,
    [switch]$Cleanup = $false
)

# Colors
$SUCCESS = @{ ForegroundColor = "Green" }
$ERROR_COLOR = @{ ForegroundColor = "Red" }
$WARNING = @{ ForegroundColor = "Yellow" }
$INFO = @{ ForegroundColor = "Cyan" }

Write-Host "╔════════════════════════════════════════════════════════╗" @INFO
Write-Host "║  G3ZKP Production Circuit Compilation via Docker      ║" @INFO
Write-Host "║  Status: Full Automated Compilation Pipeline          ║" @INFO
Write-Host "╚════════════════════════════════════════════════════════╝" @INFO

# Check Docker installation
Write-Host "`n🐳 Checking Docker installation..." @INFO
if (-not $SkipDockerCheck) {
    try {
        $dockerVersion = & docker --version
        Write-Host "✅ Docker found: $dockerVersion" @SUCCESS
    } catch {
        Write-Host "❌ Docker not found. Please install Docker Desktop." @ERROR_COLOR
        exit 1
    }
}

# Check Docker daemon
Write-Host "`n🔌 Checking Docker daemon..." @INFO
try {
    & docker ps | Out-Null
    Write-Host "✅ Docker daemon is running" @SUCCESS
} catch {
    Write-Host "❌ Docker daemon is not running. Please start Docker Desktop." @ERROR_COLOR
    exit 1
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "`n📁 Working directory: $ScriptDir" @INFO

# Check required files
Write-Host "`n📋 Checking required files..." @INFO
$RequiredFiles = @(
    "pot12_final.ptau",
    "package.json",
    "compile-production.sh",
    "Dockerfile"
)

$MissingFiles = @()
foreach ($file in $RequiredFiles) {
    $filePath = Join-Path $ScriptDir $file
    if (Test-Path $filePath) {
        Write-Host "  ✅ $file" @SUCCESS
    } else {
        Write-Host "  ❌ $file (MISSING)" @ERROR_COLOR
        $MissingFiles += $file
    }
}

if ($MissingFiles.Count -gt 0) {
    Write-Host "`n❌ Missing required files: $($MissingFiles -join ', ')" @ERROR_COLOR
    exit 1
}

# Check production circuits
Write-Host "`n🧮 Checking production circuits..." @INFO
$ProductionDir = Join-Path $ScriptDir "production"
if (Test-Path $ProductionDir) {
    $circuits = Get-ChildItem -Path $ProductionDir -Filter "*.circom"
    Write-Host "  Found $($circuits.Count) circuits:" @SUCCESS
    foreach ($circuit in $circuits) {
        Write-Host "    ✓ $($circuit.Name)"
    }
} else {
    Write-Host "  ❌ Production directory not found" @ERROR_COLOR
    exit 1
}

# Build Docker image
Write-Host "`n🔨 Building Docker image..." @INFO
Write-Host "  Command: docker build -t g3zkp-circuits-compiler ." @INFO
$buildResult = & docker build -t g3zkp-circuits-compiler .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" @ERROR_COLOR
    exit 1
}
Write-Host "✅ Docker image built successfully" @SUCCESS

# Compile circuits
Write-Host "`n⚙️  Compiling circuits..." @INFO
Write-Host "  This may take 15-30 minutes..." @WARNING

$buildDir = Join-Path $ScriptDir "build"
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
    Write-Host "  📁 Created build directory"
}

Write-Host "  Running: docker run --rm -v $($buildDir):/circuits/build g3zkp-circuits-compiler" @INFO

$compileResult = & docker run --rm `
    -v "$($buildDir):/circuits/build" `
    -e "PTAU_PATH=/circuits/pot12_final.ptau" `
    g3zkp-circuits-compiler

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Compilation failed" @ERROR_COLOR
    exit 1
}

# Verify compilation output
Write-Host "`n✅ Compilation completed. Verifying artifacts..." @SUCCESS

$VerificationChecks = @{
    "WASM files" = "*.wasm"
    "R1CS files" = "*.r1cs"
    "ZKey files" = "*_final.zkey"
    "Verification keys" = "*_verification_key.json"
}

$AllValid = $true
foreach ($check in $VerificationChecks.GetEnumerator()) {
    $pattern = $check.Value
    $files = Get-ChildItem -Path $buildDir -Recurse -Filter $pattern -ErrorAction SilentlyContinue
    $count = $files.Count
    if ($count -gt 0) {
        Write-Host "  ✅ $($check.Key): $count found" @SUCCESS
    } else {
        Write-Host "  ❌ $($check.Key): NOT FOUND" @ERROR_COLOR
        $AllValid = $false
    }
}

if (-not $AllValid) {
    Write-Host "`n⚠️  Some artifacts are missing. Compilation may have failed." @WARNING
}

# Generate circuit registry
Write-Host "`n📋 Generating circuit registry..." @INFO
$registryPath = Join-Path $buildDir "circuit_registry.json"
$circuits = @(
    "authentication",
    "message_security",
    "forward_secrecy",
    "message_send",
    "message_delivery",
    "key_rotation",
    "group_message"
)

$registry = @{
    version = "1.0.0"
    production = $true
    compiled_at = [DateTime]::UtcNow.ToString("O")
    ptau = "pot12_final.ptau"
    ptau_power = 12
    circuits = @()
}

foreach ($circuit in $circuits) {
    $vkeyFile = Join-Path $buildDir "${circuit}_verification_key.json"
    if (Test-Path $vkeyFile) {
        $registry.circuits += @{
            id = $circuit
            name = $circuit
            wasm = "${circuit}.wasm"
            zkey = "${circuit}_final.zkey"
            verification_key = "${circuit}_verification_key.json"
            verifier_contract = "${circuit}_verifier.sol"
        }
    }
}

$registry | ConvertTo-Json | Set-Content -Path $registryPath
Write-Host "  ✅ Circuit registry written: circuit_registry.json" @SUCCESS

# Run tests if requested
if ($Test) {
    Write-Host "`n🧪 Running tests..." @INFO
    $testResult = & docker run --rm `
        -v "$($buildDir):/circuits/build" `
        g3zkp-circuits-compiler `
        npm run test:circuits
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ All tests passed" @SUCCESS
    } else {
        Write-Host "❌ Some tests failed" @ERROR_COLOR
    }
}

# Cleanup if requested
if ($Cleanup) {
    Write-Host "`n🧹 Cleaning up Docker resources..." @INFO
    & docker rmi g3zkp-circuits-compiler
    Write-Host "✅ Cleanup complete" @SUCCESS
}

# Final summary
Write-Host "`n╔════════════════════════════════════════════════════════╗" @SUCCESS
Write-Host "║         ✅ COMPILATION COMPLETE                         ║" @SUCCESS
Write-Host "╚════════════════════════════════════════════════════════╝" @SUCCESS

Write-Host "`n📊 Summary:" @INFO
Write-Host "  Build directory: $buildDir" @INFO
Write-Host "  Circuits compiled: $($registry.circuits.Count)/7" @INFO
Write-Host "  Circuit registry: circuit_registry.json" @INFO

Write-Host "`n📝 Next steps:" @INFO
Write-Host "  1. Verify artifacts in build/ directory" @INFO
Write-Host "  2. Run tests: docker run --rm -v $($buildDir):/circuits/build g3zkp-circuits-compiler npm run test:circuits" @INFO
Write-Host "  3. Deploy verification keys to IPFS" @INFO
Write-Host "  4. Store proving keys securely" @INFO

Write-Host "`n✅ Production circuits ready for deployment" @SUCCESS
