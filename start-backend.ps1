# ANTIGRAVITY Backend Launcher
Write-Host "🚀 Starting ANTIGRAVITY Backend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\backend"
& "d:\ArduinoData\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
