from fastapi import APIRouter, Depends
from schemas.chat import UploadUrlRequest, UploadUrlResponse
from services.storage import generate_v4_upload_url
from core.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Upload"])

@router.post("/generate-upload-url", response_model=UploadUrlResponse)
async def get_upload_url(req: UploadUrlRequest, user: dict = Depends(get_current_user)):
    # Call the service layer
    signed_url, public_url = generate_v4_upload_url(req.filename, req.content_type)
    return UploadUrlResponse(signed_url=signed_url, public_url=public_url)