from operator import index
import os
import requests
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Load environment variables
load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
if not SARVAM_API_KEY:
    raise RuntimeError("SARVAM_API_KEY not found.")

SARVAM_HEADERS = {
    "API-Subscription-Key": SARVAM_API_KEY,
    "Content-Type": "application/json"
}

# Global state for vector db
vector_store = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load vector store on startup
    global vector_store

    index_path = "faiss_index"
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    # Performance: Load existing FAISS index if available to save startup time
    print("Starting up: Initializing FAISS Vector Store...")
    if os.path.exists(index_path):
        vector_store = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    else:
        pdf_path = "indian_constitution_2024.pdf"
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"Required document '{pdf_path}' not found in the backend directory.")

        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        split_chunks = text_splitter.split_documents(docs)
        vector_store = FAISS.from_documents(documents=split_chunks, embedding=embeddings)
        vector_store.save_local(index_path)
    print("FAISS Vector Store initialized successfully.")
    yield
    print("Shutting down: Cleaning up memory resources...")
    vector_store = None

app = FastAPI(lifespan=lifespan)


# Configure CORS for local React development (Vite defaults to port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query_text: str
    target_language: str

class QueryResponse(BaseModel):
    answer: str
    source_english: str
    audio_base64: str | None = None

def translate_text(text: str, source_language: str, target_language: str) -> str:
    """Interacts with Sarvam Translation API."""
    url = "https://api.sarvam.ai/translate"
    
    safe_text = text if len(text) <= 990 else text[:987] + "..."
    
    payload = {
        "input": safe_text,
        "source_language_code": source_language,
        "target_language_code": target_language,
        "model": "mayura:v1"
    }
    response = requests.post(url, json=payload, headers=SARVAM_HEADERS)
    response.raise_for_status()
    return response.json().get("translated_text", text)


def generate_audio(text: str, target_language: str) -> str | None:
    """Interacts with Sarvam Text-to-Speech API."""
    url = "https://api.sarvam.ai/text-to-speech"
    
    # bulbul:v3 supports up to 2500 characters.
    safe_audio_text = text[:2400]
    
    payload = {
        "text": safe_audio_text,
        "target_language_code": target_language,
        "speaker": "shubh",
        "model": "bulbul:v3"
    }
    try:
        response = requests.post(url, json=payload, headers=SARVAM_HEADERS)
        response.raise_for_status()
        # The API returns a dictionary with an 'audios' array containing base64 strings
        audios = response.json().get("audios", [])
        return audios[0] if audios else None

    except requests.exceptions.HTTPError as e:
        # Better error logging to see exactly what Sarvam rejected if it fails again
        error_msg = e.response.text if e.response is not None else str(e)
        print(f"TTS Generation Warning (Non-Fatal): {error_msg}")
        return None

    except Exception as e:
        print(f"TTS Generation Warning (Non-Fatal): {e}")
        return None

def process_rag_pipeline(english_query: str, target_language: str) -> tuple[str, str]:
    """
    Centralized RAG logic to process a user's query and return the final answers.
    Returns a tuple containing: (final_indic_answer, english_llm_answer)
    """
    # 1. Retrieve relevant constitutional context
    docs = vector_store.similarity_search(english_query, k=3)
    context = "\n".join([doc.page_content for doc in docs])

    # 2. Generate English response using Sarvam Chat Completion
    system_prompt = (
        "You are a helpful legal assistant for the Indian Constitution. "
        "Please provide a clear, concise summary in exactly 3 to 4 short sentences (maximum 800 characters). "
        f"Use the following legal context to answer the query accurately: {context}"
    )
    chat_url = "https://api.sarvam.ai/v1/chat/completions"
    chat_payload = {
        "model": "sarvam-m",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": english_query}
        ]
    }
    chat_response = requests.post(chat_url, json=chat_payload, headers=SARVAM_HEADERS)
    chat_response.raise_for_status()
    english_answer = chat_response.json().get("choices")[0].get("message").get("content")

    # 3. Translate the English answer back to the requested Indic language
    final_answer = translate_text(
        text=english_answer,
        source_language="en-IN",
        target_language=target_language
    )
    
    return final_answer, english_answer


# ==========================================
# API ENDPOINTS
# ==========================================
@app.post("/api/ask", response_model=QueryResponse)
async def ask_constitution(req: QueryRequest):
    try:
        # 1. Translate Indic query to English
        english_query = translate_text(
            text=req.query_text, 
            source_language=req.target_language, 
            target_language="en-IN"
        )

        # 2. Run the centralized RAG pipeline
        final_answer, english_answer = process_rag_pipeline(english_query, req.target_language)
        
        return QueryResponse(
            answer=final_answer,
            source_english=english_answer
        )
    except requests.exceptions.HTTPError as e:
        # Structured error handling for external API failures
        error_detail = e.response.text if e.response is not None else str(e)
        raise HTTPException(status_code=502, detail=f"Sarvam API Error: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/api/ask-audio", response_model=QueryResponse)
async def ask_constitution_audio(
    audio_file: UploadFile = File(...),
    target_language: str = Form(...)
):
    try:
        # 1. Speech-to-Text: Get English translation directly from Indic audio
        stt_url = "https://api.sarvam.ai/speech-to-text-translate"
        files = {"file": (audio_file.filename, await audio_file.read(), audio_file.content_type)}
        
        # Audio uploads require multipart form boundaries, so we omit Content-Type here
        stt_headers = {"API-Subscription-Key": SARVAM_API_KEY}
        stt_response = requests.post(stt_url, files=files, headers=stt_headers)
        stt_response.raise_for_status()
        
        english_query = stt_response.json().get("transcript")
        
        if not english_query:
            raise HTTPException(status_code=400, detail="Could not transcribe audio. Please try speaking clearly.")

        # 2. Run the centralized RAG pipeline
        final_answer, english_answer = process_rag_pipeline(english_query, target_language)

        # 3. Generate Indic Audio from the final translated answer
        audio_base64 = generate_audio(text=final_answer, target_language=target_language)
        
        return QueryResponse(
            answer=final_answer,
            source_english=english_answer,
            audio_base64=audio_base64
        )

    except requests.exceptions.HTTPError as e:
        error_detail = e.response.text if e.response is not None else str(e)
        raise HTTPException(status_code=502, detail=f"Sarvam API Error: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
