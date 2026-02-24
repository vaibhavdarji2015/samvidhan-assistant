import io
import requests
from pypdf import PdfReader
from google.cloud import vision

def extract_text_from_document(file_url: str) -> str:
    """Extracts text from either an Image (via Cloud Vision) or a PDF (via pypdf)."""
    file_url_lower = file_url.lower()

    # --- 1. Handle Video Files Safely ---
    video_extensions = [".mp4", ".webm", ".mov", ".avi", ".quicktime"]
    if any(ext in file_url_lower for ext in video_extensions):
        print("Video detected. Bypassing Image OCR...")
        return "[SYSTEM NOTE: The user has securely uploaded a VIDEO file as evidence. Acknowledge this video in the chat and ensure it is included as an Annexure if you draft a formal document.]"
    
    # --- 2. Handle PDF Documents ---
    if ".pdf" in file_url_lower:
        try:
            print("PDF detected. Downloading into memory for extraction...")
            response = requests.get(file_url)
            response.raise_for_status()
            
            # Read PDF directly from RAM to maintain high performance
            reader = PdfReader(io.BytesIO(response.content))
            extracted_text = ""
            for page in reader.pages:
                extracted_text += page.extract_text() + "\n"
                
            return extracted_text.strip()
        except Exception as e:
            print(f"PDF Extraction failed: {e}")
            return ""

    # --- 3. Handle Images ---
    try:
        print("Image detected. Running Cloud Vision OCR...")
        client = vision.ImageAnnotatorClient()
        
        if "storage.googleapis.com" in file_url:
            parts = file_url.split("storage.googleapis.com/")
            gs_uri = f"gs://{parts[1]}"
            image = vision.Image()
            image.source.image_uri = gs_uri
        else:
            image = vision.Image()
            image.source.image_uri = file_url
            
        response = client.text_detection(image=image)
        
        if response.error.message:
            print(f"Vision API Error: {response.error.message}")
            return ""
            
        texts = response.text_annotations
        return texts[0].description if texts else ""
        
    except Exception as e:
        print(f"Image OCR failed: {e}")
        return ""