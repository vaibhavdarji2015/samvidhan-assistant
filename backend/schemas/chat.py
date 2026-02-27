from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str
    content: str
    evidence_urls: Optional[List[str]] = []

class QueryRequest(BaseModel):
    query_text: str
    target_language: str
    chat_history: List[Message] = []

class QueryResponse(BaseModel):
    answer: str
    source_english: str
    audio_base64: Optional[str] = None
    transcribed_text: Optional[str] = None

class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str

class UploadUrlResponse(BaseModel):
    signed_url: str
    public_url: str