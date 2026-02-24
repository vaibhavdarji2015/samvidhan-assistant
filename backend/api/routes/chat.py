import json
import requests
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import List

from schemas.chat import QueryRequest, QueryResponse, Message
from services.rag import process_rag_pipeline
from services.sarvam import translate_text, generate_audio
from core.config import SARVAM_API_KEY
from core.auth import get_current_user

# Define the router with a prefix so all endpoints automatically start with /api
router = APIRouter(prefix="/api", tags=["Chat"])

@router.post("/ask", response_model=QueryResponse)
async def ask_constitution(req: QueryRequest, user: dict = Depends(get_current_user)):
    try:
        # 1. Translate Indic query to English
        english_query = translate_text(
            text=req.query_text, 
            source_language=req.target_language, 
            target_language="en-IN"
        )

        # 2. Run the centralized RAG pipeline WITH chat history
        final_answer, english_answer = process_rag_pipeline(
            english_query=english_query, 
            target_language=req.target_language,
            chat_history=req.chat_history,
            user_name=user.get("name") or user.get("email") or "Concerned Citizen"
        )
        
        return QueryResponse(
            answer=final_answer,
            source_english=english_answer
        )
    except requests.exceptions.HTTPError as e:
        error_detail = e.response.text if getattr(e, 'response', None) is not None else str(e)
        raise HTTPException(status_code=502, detail=f"Sarvam API Error: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/ask-audio", response_model=QueryResponse)
async def ask_constitution_audio(
    audio_file: UploadFile = File(...),
    target_language: str = Form(...),
    chat_history_str: str = Form("[]"),
    user: dict = Depends(get_current_user)
):
    try:
        # Parse the incoming stringified chat history array from React
        raw_history = json.loads(chat_history_str)
        chat_history = [Message(**msg) for msg in raw_history]

        # 1. Speech-to-Text: Get English translation directly from Indic audio
        stt_url = "https://api.sarvam.ai/speech-to-text-translate"
        files = {"file": (audio_file.filename, await audio_file.read(), audio_file.content_type)}
        stt_headers = {"API-Subscription-Key": SARVAM_API_KEY}
        
        stt_response = requests.post(stt_url, files=files, headers=stt_headers)
        stt_response.raise_for_status()
        
        english_query = stt_response.json().get("transcript")
        if not english_query:
            raise HTTPException(status_code=400, detail="Could not transcribe audio. Please try speaking clearly.")

        # 2. Run the centralized RAG pipeline
        final_answer, english_answer = process_rag_pipeline(
            english_query=english_query, 
            target_language=target_language,
            chat_history=chat_history,
            user_name=user.get("name") or user.get("email") or "Concerned Citizen"
        )

        # 3. Generate Indic Audio from the final translated answer
        audio_base64 = generate_audio(text=final_answer, target_language=target_language)
        
        return QueryResponse(
            answer=final_answer,
            source_english=english_answer,
            audio_base64=audio_base64
        )

    except requests.exceptions.HTTPError as e:
        error_detail = e.response.text if getattr(e, 'response', None) is not None else str(e)
        raise HTTPException(status_code=502, detail=f"Sarvam API Error: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")