"""
Pydantic models for ANTIGRAVITY API.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any


class AnalyzeRequest(BaseModel):
    code: str = Field(..., description="Source code to analyze")
    language: str = Field(default="auto", description="Language hint or 'auto'")
    enable_ai: bool = Field(default=True, description="Include Groq AI analysis")
    session_tag: Optional[str] = Field(default=None, description="Optional label for this session")


class ChatRequest(BaseModel):
    session_id: str
    message: str
    include_history: bool = Field(default=True)


class LeaderboardEntry(BaseModel):
    username: str
    score: int
    language: str
    session_id: Optional[str] = None


class ImageAnalyzeRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    language: str = "auto"
    enable_ai: bool = True
