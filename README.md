# ANTIGRAVITY 🚀
**AI-Powered Code Readability Evaluation Tool**

---

## Quick Start

### 1. Start Backend
```powershell
cd d:\ArduinoData\antigravity
.\start-backend.ps1
```
Backend runs on: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### 2. Start Frontend
```powershell
cd d:\ArduinoData\antigravity\frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

---

## Tech Stack
- **Frontend**: React 18 + Vite + Monaco Editor + Recharts + Framer Motion
- **Backend**: FastAPI + Groq (llama3-70b) + Python AST + radon
- **Database**: MongoDB (in-memory fallback if unavailable)
- **Real-time**: WebSocket streaming analysis

## Features
- ⚡ Live Autopsy Heatmap — real-time line coloring as you type
- 📊 10 structural metrics via Python AST + radon
- 🤖 Groq AI narrative, refactoring, cognitive map
- 🧬 Unique Code DNA SVG fingerprint per codebase
- 🏆 Team Leaderboard with room codes
- 💬 AI Coach chat panel with session context
- 📁 Batch ZIP analysis
- 📜 Session history with trend chart

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Full analysis |
| `/api/analyze/file` | POST | File upload |
| `/api/analyze/batch` | POST | ZIP batch |
| `/api/sessions` | GET | List sessions |
| `/api/sessions/:id` | GET | Get session |
| `/api/leaderboard/:room` | GET/POST | Leaderboard |
| `/api/chat` | POST | AI chat |
| `/ws/analyze-stream` | WS | Live stream |
