"""
FixMyCode — FastAPI Backend
Ultra-fast code readability analysis powered by Groq + Python AST.
"""
import os
import uuid
import time
import json
import zipfile
import io
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, HTTPException, WebSocket, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load .env from backend dir OR project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

from analyzer.static import compute_metrics, compute_readability_score, detect_language
from analyzer.rules import evaluate_rules
from analyzer.dna import generate_dna_svg
from analyzer.groq_client import (
    analyze_with_groq_async,
    analyze_image_code,
    stream_quick_analysis,
)
from db.mongo import (
    init_db,
    save_session,
    get_sessions,
    get_session,
    delete_session,
    get_leaderboard,
    submit_leaderboard,
    save_chat_message,
    get_chat_history,
)
from db.models import AnalyzeRequest, ChatRequest, LeaderboardEntry, ImageAnalyzeRequest
from websocket.stream import handle_stream

# Local Groq client for chat
from groq import Groq
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

# ─── App Setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ANTIGRAVITY API",
    description="AI-Powered Code Readability Evaluation Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    print("[START] ANTIGRAVITY API started")


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "service": "ANTIGRAVITY"}


# ─── Core Analysis ─────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    start = time.monotonic()

    code = req.code.strip()
    if not code:
        raise HTTPException(400, "Code cannot be empty")

    # Language detection
    if req.language == "auto":
        language, confidence = detect_language(code)
    else:
        language = req.language
        confidence = 1.0

    # Static metrics
    metrics = compute_metrics(code, language)
    score, dimension_scores, grade = compute_readability_score(metrics)

    # Rule tips
    rule_tips = evaluate_rules(metrics)

    # Code DNA
    dna_svg = generate_dna_svg(metrics, score)

    # AI Analysis (optional)
    ai_analysis = None
    if req.enable_ai:
        try:
            ai_analysis = await analyze_with_groq_async(code, language, metrics)
        except Exception as e:
            ai_analysis = {
                "executive_summary": f"AI analysis unavailable: {str(e)[:80]}",
                "developer_insights": [],
                "refactored_snippet": {"function_name": "", "before": "", "after": "", "improvement_pct": 0},
                "cognitive_map": [],
                "quick_wins": [],
            }

    session_id = str(uuid.uuid4())
    elapsed_ms = int((time.monotonic() - start) * 1000)

    result = {
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "language": language,
        "language_confidence": confidence,
        "session_tag": req.session_tag,
        "metrics": metrics,
        "readability_score": score,
        "grade": grade,
        "dimension_scores": dimension_scores,
        "rule_tips": rule_tips,
        "ai_analysis": ai_analysis,
        "code_dna": dna_svg,
        "processing_time_ms": elapsed_ms,
        "code_snippet": code[:500],  # Store first 500 chars
    }

    # Save to MongoDB
    await save_session(result)

    return JSONResponse(content=result)


# ─── File Upload Analysis ──────────────────────────────────────────────────────

@app.post("/api/analyze/file")
async def analyze_file(
    file: UploadFile = File(...),
    enable_ai: bool = Form(default=True),
    language: str = Form(default="auto"),
):
    content = await file.read()
    try:
        code = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded text")

    req = AnalyzeRequest(code=code, language=language, enable_ai=enable_ai)
    return await analyze(req)


# ─── Image / Screenshot Analysis ──────────────────────────────────────────────

@app.post("/api/analyze/image")
async def analyze_image(req: ImageAnalyzeRequest):
    """Extract code from screenshot, then analyze it."""
    vision_result = await analyze_image_code(req.image_base64, req.mime_type)
    if not vision_result.get("success"):
        raise HTTPException(422, f"Could not extract code from image: {vision_result.get('error')}")

    extracted_code = vision_result["code"]
    analyze_req = AnalyzeRequest(
        code=extracted_code,
        language=req.language,
        enable_ai=req.enable_ai,
    )
    result = await analyze(analyze_req)
    result_dict = result.body if hasattr(result, "body") else {}
    return result


# ─── Batch Analysis ────────────────────────────────────────────────────────────

@app.post("/api/analyze/batch")
async def analyze_batch(file: UploadFile = File(...)):
    """Analyze all source files in a ZIP archive."""
    content = await file.read()
    results = []
    worst_score = 101
    best_score = -1
    worst_file = best_file = ""

    SUPPORTED_EXTS = {".py", ".js", ".ts", ".java", ".cpp", ".c", ".go", ".rs", ".rb", ".php"}

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(400, "Invalid ZIP file")

    for name in zf.namelist():
        ext = os.path.splitext(name)[1].lower()
        if ext not in SUPPORTED_EXTS:
            continue
        try:
            code = zf.read(name).decode("utf-8", errors="ignore")
            if len(code.strip()) < 10:
                continue
            lang, conf = detect_language(code)
            metrics = compute_metrics(code, lang)
            score, dims, grade = compute_readability_score(metrics)
            tips = evaluate_rules(metrics)
            file_result = {
                "filename": name,
                "language": lang,
                "score": score,
                "grade": grade,
                "metrics": metrics,
                "dimension_scores": dims,
                "top_tips": tips[:2],
            }
            results.append(file_result)
            if score < worst_score:
                worst_score = score
                worst_file = name
            if score > best_score:
                best_score = score
                best_file = name
        except Exception:
            continue

    if not results:
        raise HTTPException(422, "No supported source files found in ZIP")

    avg_score = int(sum(r["score"] for r in results) / len(results))
    return {
        "file_count": len(results),
        "project_health_score": avg_score,
        "best_file": {"name": best_file, "score": best_score},
        "worst_file": {"name": worst_file, "score": worst_score},
        "files": sorted(results, key=lambda x: x["score"]),
    }


# ─── Sessions ──────────────────────────────────────────────────────────────────

@app.get("/api/sessions")
async def list_sessions(limit: int = 50):
    sessions = await get_sessions(limit=limit)
    # Return only summary fields
    summaries = [
        {
            "session_id": s.get("session_id"),
            "timestamp": s.get("timestamp"),
            "language": s.get("language"),
            "readability_score": s.get("readability_score"),
            "grade": s.get("grade"),
            "session_tag": s.get("session_tag"),
            "code_snippet": s.get("code_snippet", "")[:100],
        }
        for s in sessions
    ]
    return {"sessions": summaries, "total": len(summaries)}


@app.get("/api/sessions/{session_id}")
async def get_session_detail(session_id: str):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@app.delete("/api/sessions/{session_id}")
async def delete_session_route(session_id: str):
    deleted = await delete_session(session_id)
    if not deleted:
        raise HTTPException(404, "Session not found")
    return {"deleted": True, "session_id": session_id}


# ─── Leaderboard ───────────────────────────────────────────────────────────────

@app.get("/api/leaderboard/{room}")
async def get_room_leaderboard(room: str):
    entries = await get_leaderboard(room)
    return {"room": room, "entries": entries}


@app.post("/api/leaderboard/{room}")
async def post_leaderboard(room: str, entry: LeaderboardEntry):
    await submit_leaderboard(room, entry.model_dump())
    return {"submitted": True}


# ─── Chat ──────────────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    session = await get_session(req.session_id)
    history = await get_chat_history(req.session_id) if req.include_history else []

    # Build context
    system_content = "You are ANTIGRAVITY, an expert code quality engineer. You have analyzed some code and are answering follow-up questions. Be specific, cite function/variable names, and give actionable advice."
    if session:
        system_content += f"\n\nCODE CONTEXT:\nLanguage: {session.get('language')}\nScore: {session.get('readability_score')}/100 (Grade: {session.get('grade')})\nMetrics: {json.dumps(session.get('metrics', {}), indent=2)[:800]}"

    messages = [{"role": "system", "content": system_content}]
    for h in history[-10:]:  # Last 10 messages
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.message})

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.3,
            max_tokens=1000,
        )
        response_text = completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(500, f"Chat failed: {str(e)}")

    # Save conversation
    await save_chat_message(req.session_id, "user", req.message)
    await save_chat_message(req.session_id, "assistant", response_text)

    return {
        "session_id": req.session_id,
        "response": response_text,
        "history_length": len(history) + 2,
    }


@app.get("/api/chat/{session_id}/history")
async def get_chat(session_id: str):
    history = await get_chat_history(session_id)
    return {"session_id": session_id, "messages": history}


# ─── GitHub Repo Analyzer ──────────────────────────────────────────────────────

SUPPORTED_EXTS = {".py", ".js", ".ts", ".java", ".cpp", ".c", ".go", ".rs", ".rb", ".php"}
GITHUB_RAW = "https://raw.githubusercontent.com"
GITHUB_API = "https://api.github.com"

def _gh_api_get(url: str, token: str = "") -> dict:
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "FixMyCode-Analyzer/1.0")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def _parse_github_url(url: str) -> tuple[str, str]:
    """Extract owner/repo from any GitHub URL format."""
    url = url.strip().rstrip("/")
    url = url.replace("https://github.com/", "").replace("http://github.com/", "")
    parts = url.split("/")
    if len(parts) < 2:
        raise ValueError("Invalid GitHub URL — expected https://github.com/owner/repo")
    return parts[0], parts[1]


@app.post("/api/analyze/github")
async def analyze_github(
    repo_url: str = Form(...),
    branch: str = Form(default="main"),
    file_paths: str = Form(default=""),  # comma-separated, empty = auto-select top files
    github_token: str = Form(default=""),
    enable_ai: bool = Form(default=False),
):
    """
    Fetch and analyze source files from a public GitHub repository.
    Automatically selects top 20 source files if file_paths is empty.
    """
    try:
        owner, repo = _parse_github_url(repo_url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Fetch repo tree
    tree_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    try:
        tree_data = _gh_api_get(tree_url, github_token)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(404, f"Repo '{owner}/{repo}' not found on branch '{branch}'. Try 'master' instead of 'main'.")
        raise HTTPException(502, f"GitHub API error: {e.code}")
    except Exception as e:
        raise HTTPException(502, f"Failed to reach GitHub: {str(e)[:100]}")

    all_files = [
        item for item in tree_data.get("tree", [])
        if item["type"] == "blob" and os.path.splitext(item["path"])[1].lower() in SUPPORTED_EXTS
    ]

    if not all_files:
        raise HTTPException(422, "No supported source files found in this repository.")

    # Select files
    if file_paths.strip():
        selected = [f for f in all_files if f["path"] in file_paths.split(",")]
    else:
        # Auto-select: sort by size desc, take top 20
        selected = sorted(all_files, key=lambda f: f.get("size", 0), reverse=True)[:20]

    results = []
    worst_score, best_score = 101, -1
    worst_file = best_file = ""

    for item in selected:
        raw_url = f"{GITHUB_RAW}/{owner}/{repo}/{branch}/{item['path']}"
        try:
            req = urllib.request.Request(raw_url)
            req.add_header("User-Agent", "FixMyCode-Analyzer/1.0")
            if github_token:
                req.add_header("Authorization", f"Bearer {github_token}")
            with urllib.request.urlopen(req, timeout=8) as resp:
                code = resp.read().decode("utf-8", errors="ignore")
        except Exception:
            continue

        if len(code.strip()) < 10:
            continue

        ext = os.path.splitext(item["path"])[1].lower()
        lang_map = {".py": "python", ".js": "javascript", ".ts": "typescript",
                    ".java": "java", ".cpp": "cpp", ".c": "c", ".go": "go",
                    ".rs": "rust", ".rb": "ruby", ".php": "php"}
        lang = lang_map.get(ext, "unknown")

        metrics = compute_metrics(code, lang)
        score, dims, grade = compute_readability_score(metrics)
        tips = evaluate_rules(metrics)

        file_result = {
            "filename": item["path"],
            "github_url": f"https://github.com/{owner}/{repo}/blob/{branch}/{item['path']}",
            "language": lang,
            "score": score,
            "grade": grade,
            "metrics": metrics,
            "dimension_scores": dims,
            "top_tips": tips[:3],
            "line_count": metrics.get("line_count", 0),
        }
        results.append(file_result)
        if score < worst_score:
            worst_score = score
            worst_file = item["path"]
        if score > best_score:
            best_score = score
            best_file = item["path"]

    if not results:
        raise HTTPException(422, "Could not read any source files from the repository.")

    avg_score = int(sum(r["score"] for r in results) / len(results))
    total_lines = sum(r["line_count"] for r in results)

    return {
        "repo": f"{owner}/{repo}",
        "branch": branch,
        "file_count": len(results),
        "total_files_in_repo": len(all_files),
        "project_health_score": avg_score,
        "total_lines_analyzed": total_lines,
        "best_file": {"name": best_file, "score": best_score},
        "worst_file": {"name": worst_file, "score": worst_score},
        "files": sorted(results, key=lambda x: x["score"]),
    }


@app.get("/api/repo/tree")
async def get_repo_tree(
    repo_url: str,
    branch: str = "main",
    github_token: str = "",
):
    """Return just the file tree for a GitHub repo (for the file picker UI)."""
    try:
        owner, repo = _parse_github_url(repo_url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    tree_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    try:
        tree_data = _gh_api_get(tree_url, github_token)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(404, f"Repo not found or branch '{branch}' doesn't exist.")
        raise HTTPException(502, f"GitHub API error: {e.code}")

    files = [
        {"path": item["path"], "size": item.get("size", 0)}
        for item in tree_data.get("tree", [])
        if item["type"] == "blob" and os.path.splitext(item["path"])[1].lower() in SUPPORTED_EXTS
    ]
    return {
        "repo": f"{owner}/{repo}",
        "branch": branch,
        "files": sorted(files, key=lambda f: f["size"], reverse=True),
        "total": len(files),
    }


# ─── User Stats ────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_user_stats(username: str = ""):
    """Aggregate statistics across all sessions (optionally filtered by username tag)."""
    sessions = await get_sessions(limit=200)

    if username:
        sessions = [s for s in sessions if username.lower() in (s.get("session_tag") or "").lower()]

    if not sessions:
        return {"total": 0}

    scores = [s["readability_score"] for s in sessions if s.get("readability_score") is not None]
    langs = {}
    for s in sessions:
        l = s.get("language", "unknown")
        langs[l] = langs.get(l, 0) + 1

    grade_counts = {}
    for s in sessions:
        g = s.get("grade", "?")
        grade_counts[g] = grade_counts.get(g, 0) + 1

    # Score over time (last 20)
    trend = [
        {"date": s.get("timestamp", "")[:10], "score": s.get("readability_score", 0)}
        for s in reversed(sessions[:20])
    ]

    return {
        "total": len(sessions),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "best_score": max(scores) if scores else 0,
        "worst_score": min(scores) if scores else 0,
        "languages": langs,
        "grade_distribution": grade_counts,
        "score_trend": trend,
    }


# ─── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/analyze-stream")
async def ws_analyze_stream(websocket: WebSocket):
    await handle_stream(websocket)


# ─── __init__ helpers ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

