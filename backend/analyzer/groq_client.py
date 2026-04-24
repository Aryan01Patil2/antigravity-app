"""
Groq API client for ANTIGRAVITY — AI narrative analysis.
Supports both text analysis (llama3-70b) and image analysis (via OpenAI vision for Kimi-K2).
"""
import os
import json
import re
import asyncio
from typing import Any
from groq import Groq
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Try primary model, fall back automatically
PRIMARY_MODEL = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "mixtral-8x7b-32768"

client = Groq(api_key=GROQ_API_KEY)

GROQ_SYSTEM_PROMPT = """
You are ANTIGRAVITY, an elite code readability analyst and senior staff engineer.
You receive pre-computed static metrics and source code.

Your job is to generate a JSON response with EXACTLY this structure:
{
  "executive_summary": "3-sentence non-technical summary of code quality for stakeholders",
  "developer_insights": [
    {
      "issue": "short title of issue",
      "line_ref": "e.g. Lines 12-18 or function foo()",
      "severity": "critical|warning|info",
      "reasoning": "specific technical explanation with engineering context"
    }
  ],
  "refactored_snippet": {
    "function_name": "name of refactored function",
    "before": "original code block",
    "after": "refactored code block",
    "improvement_pct": 25
  },
  "cognitive_map": [
    {
      "function_name": "function name",
      "load_score": 7,
      "reason": "why this function has this cognitive load score"
    }
  ],
  "quick_wins": [
    {
      "title": "short action title",
      "action": "specific action to take",
      "time_estimate": "2 minutes"
    }
  ]
}

Rules:
- developer_insights: exactly 5 items, sorted by severity (critical first)
- cognitive_map: one entry per function found, load_score 1-10
- quick_wins: exactly 3 items, each truly actionable in under 5 minutes
- refactored_snippet: pick the WORST function and show concrete before/after
- Respond ONLY with valid JSON — no markdown fences, no preamble, no explanation
- Be specific: reference actual variable/function names, actual line numbers if possible
"""


def _extract_json(text: str) -> dict:
    """Robustly extract JSON from model response that might have extra text."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find JSON block
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Return safe fallback
    return {
        "executive_summary": "Analysis could not be parsed from AI response. Please retry.",
        "developer_insights": [],
        "refactored_snippet": {"function_name": "", "before": "", "after": "", "improvement_pct": 0},
        "cognitive_map": [],
        "quick_wins": [],
    }


def analyze_with_groq(code: str, language: str, metrics: dict[str, Any]) -> dict:
    """Synchronous Groq API call for full analysis."""
    user_content = (
        f"LANGUAGE: {language}\n\n"
        f"PRE-COMPUTED METRICS:\n{json.dumps(metrics, indent=2)}\n\n"
        f"SOURCE CODE:\n```{language}\n{code[:6000]}\n```"
    )

    models = [PRIMARY_MODEL, FALLBACK_MODEL]
    for model in models:
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.2,
                max_tokens=2000,
                stream=False,
            )
            raw = completion.choices[0].message.content
            return _extract_json(raw)
        except Exception as e:
            if model == models[-1]:
                return {
                    "executive_summary": f"AI analysis failed: {str(e)[:100]}",
                    "developer_insights": [],
                    "refactored_snippet": {"function_name": "", "before": "", "after": "", "improvement_pct": 0},
                    "cognitive_map": [],
                    "quick_wins": [],
                }


async def analyze_with_groq_async(code: str, language: str, metrics: dict[str, Any]) -> dict:
    """Async wrapper for Groq call (runs in thread pool)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, analyze_with_groq, code, language, metrics)


async def analyze_image_code(image_base64: str, mime_type: str = "image/png") -> dict:
    """
    Analyze a screenshot of code using vision model.
    Uses OpenAI-compatible API with Kimi-K2 or GPT-4V.
    """
    try:
        # Try using OpenAI client with vision
        from openai import OpenAI as OpenAIClient
        vision_client = OpenAIClient(api_key=OPENAI_API_KEY)
        response = vision_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the code from this screenshot and return ONLY the raw code text, no explanation."
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{image_base64}"},
                        },
                    ],
                }
            ],
            max_tokens=3000,
        )
        extracted_code = response.choices[0].message.content
        return {"success": True, "code": extracted_code}
    except Exception as e:
        return {"success": False, "code": "", "error": str(e)}


def stream_quick_analysis(code: str, language: str) -> list[dict]:
    """
    Fast lightweight analysis for WebSocket streaming.
    Returns per-line cognitive load scores using static analysis only.
    No LLM call — pure heuristic for real-time.
    """
    lines = code.splitlines()
    result = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            result.append({"line": i + 1, "load": 0, "color": "transparent"})
            continue

        load = 1  # base

        # Nesting via indentation
        indent = (len(line) - len(line.lstrip())) // 4
        load += indent * 1.5

        # Branch keywords
        branches = len(re.findall(r'\b(if|elif|else|for|while|try|except|catch|case)\b', stripped))
        load += branches * 2

        # Long lines
        if len(stripped) > 80:
            load += 1.5

        # Magic numbers
        magics = len(re.findall(r'(?<!\w)\d{2,}(?!\w)', stripped))
        load += magics * 0.5

        # Normalize 0-10
        load = min(10, round(load, 1))

        if load <= 2:
            color = "rgba(52,199,89,0.12)"   # green
        elif load <= 5:
            color = "rgba(255,159,10,0.15)"  # amber
        else:
            color = "rgba(255,59,48,0.20)"   # red

        result.append({"line": i + 1, "load": load, "color": color})

    return result
