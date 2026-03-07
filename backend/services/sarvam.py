import httpx
from core.config import SARVAM_HEADERS

import textwrap


async def translate_text(text: str, source_language: str, target_language: str) -> str:
    """Interacts with Sarvam Translation API, bypassing limits by safely chunking."""
    if source_language == target_language:
        return text

    url = "https://api.sarvam.ai/translate"
    limit = 950 # Safe buffer below 1000 limit
    
    paragraphs = text.split('\n')
    translated_paragraphs = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for para in paragraphs:
            if not para.strip():
                translated_paragraphs.append("")
                continue
                
            chunks = textwrap.wrap(para, width=limit) if len(para) > limit else [para]
            para_translation = ""
            
            for chunk in chunks:
                payload = {
                    "input": chunk,
                    "source_language_code": source_language,
                    "target_language_code": target_language,
                    "model": "mayura:v1"
                }
                try:
                    response = await client.post(url, json=payload, headers=SARVAM_HEADERS)
                    response.raise_for_status()
                    para_translation += response.json().get("translated_text", chunk) + " "
                except Exception as e:
                    print(f"Translation chunk error: {e}")
                    para_translation += chunk + " "
                    
            translated_paragraphs.append(para_translation.strip())
        
    return "\n".join(translated_paragraphs)

async def generate_audio(text: str, target_language: str) -> str | None:
    """Interacts with Sarvam Text-to-Speech API."""
    url = "https://api.sarvam.ai/text-to-speech"
    safe_audio_text = text[:2400]
    
    payload = {
        "text": safe_audio_text,
        "target_language_code": target_language,
        "speaker": "shubh",
        "model": "bulbul:v3"
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=SARVAM_HEADERS)
            response.raise_for_status()
            audios = response.json().get("audios", [])
            return audios[0] if audios else None
    except Exception as e:
        print(f"TTS Generation Warning (Non-Fatal): {e}")
        return None