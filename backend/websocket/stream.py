"""
WebSocket real-time streaming analysis handler.
Sends live per-line cognitive load scores as user types.
"""
import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from analyzer.groq_client import stream_quick_analysis
from analyzer.static import compute_metrics, compute_readability_score


async def handle_stream(websocket: WebSocket):
    await websocket.accept()
    last_code = ""
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                # Send ping to keep alive
                await websocket.send_json({"type": "ping"})
                continue

            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            code = payload.get("code", "")
            language = payload.get("language", "auto")

            if code == last_code:
                continue
            last_code = code

            if not code.strip():
                await websocket.send_json({
                    "type": "clear",
                    "line_data": [],
                    "score": 0,
                    "metrics": {},
                })
                continue

            # Fast static analysis (no LLM)
            metrics = compute_metrics(code, language)
            score, dimension_scores, grade = compute_readability_score(metrics)

            # Per-line cognitive load
            line_data = stream_quick_analysis(code, language)

            await websocket.send_json({
                "type": "update",
                "score": score,
                "grade": grade,
                "dimension_scores": dimension_scores,
                "metrics": {
                    "line_count": metrics.get("line_count", 0),
                    "function_count": metrics.get("function_count", 0),
                    "max_nesting_depth": metrics.get("max_nesting_depth", 0),
                    "cyclomatic_complexity": metrics.get("cyclomatic_complexity", 0),
                    "comment_ratio": metrics.get("comment_ratio", 0),
                },
                "line_data": line_data,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
