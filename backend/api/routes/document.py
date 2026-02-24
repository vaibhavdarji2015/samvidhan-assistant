from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from schemas.chat import Message
from services.extractor import extract_legal_document_data
from services.pdf_generator import generate_legal_document_pdf

router = APIRouter(prefix="/api", tags=["Legal Documents"])

class AutoDraftRequest(BaseModel):
    user_name: str
    chat_history: List[Message]

class DocumentResponse(BaseModel):
    pdf_download_url: str

@router.post("/auto-draft", response_model=DocumentResponse)
async def auto_draft_document(req: AutoDraftRequest):
    try:
        # 1. AI reads the chat and figures out the Indian legal context
        legal_data = extract_legal_document_data(
            chat_history=req.chat_history, 
            user_name=req.user_name
        )
        
        # 2. Pass the AI-extracted data directly into our PDF generator
        pdf_url = generate_legal_document_pdf(
            document_type=legal_data.get("document_type", "Formal Legal Representation"),
            addressee_title=legal_data.get("addressee_title", "To the Concerned Authority"),
            addressee_address=legal_data.get("addressee_address", "Appropriate Government Office"),
            subject=legal_data.get("subject", "Formal Representation regarding Violation of Rights"),
            body_text=legal_data.get("body_text", "Please find the details of my grievance enclosed."),
            applicant_name=legal_data.get("applicant_name"),
            evidence_url=legal_data.get("evidence_url")
        )
        
        if not pdf_url:
            raise HTTPException(status_code=500, detail="Failed to generate the PDF file.")
            
        return DocumentResponse(pdf_download_url=pdf_url)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))