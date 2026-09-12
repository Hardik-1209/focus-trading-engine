# install-service.ps1
# Registers the Focus Trading Engine as a Windows Service.
# Requires: npm install -g node-windows  (will be installed automatically)
#
# IMPORTANT: Run as Administrator

$EnginePath = "D:\Focus Trading Engine"

# Check admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ Please run this script as Administrator!" -ForegroundColor Red
    Write-Host "   Right-click PowerShell → 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔧 Setting up Focus Trading Engine as Windows Service..." -ForegroundColor Cyan

# ─── Set High Performance power plan ──────────────────────────────────────────
Write-Host "⚡ Setting power plan to High Performance (prevents CPU throttle)..."
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg /setactive SCHEME_MIN 2>$null
}
Write-Host "✅ Power plan set"

# ─── Disable sleep/hibernate ──────────────────────────────────────────────────
Write-Host "💤 Disabling sleep/hibernate..."
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 0
Write-Host "✅ Sleep disabled"

# ─── Build the project first ──────────────────────────────────────────────────
Write-Host "🔨 Building TypeScript project..."
Push-Location $EnginePath
npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Fix TypeScript errors first." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ Build successful"

# ─── Create service using node-windows ────────────────────────────────────────
Write-Host "📦 Installing node-windows locally..."
Push-Location $EnginePath
npm install node-windows 2>&1 | Out-Null
Write-Host "📦 Installing windows service..."
node .\scripts\install-service.js
Pop-Location

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ Focus Trading Engine is now a Windows Service!" -ForegroundColor Green
Write-Host "   → Starts automatically on boot" -ForegroundColor Green
Write-Host "   → Auto-restarts on crash" -ForegroundColor Green
Write-Host "   → Manage via: services.msc (search 'FocusTradingEngine')" -ForegroundColor Green
Write-Host "   → View logs in: $EnginePath\daemon\" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
