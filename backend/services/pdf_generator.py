import os
import re  # <-- NEW: Required for aggressive text sanitization
from fpdf import FPDF
from datetime import datetime
from google.cloud import storage
from core.config import GCS_BUCKET_NAME

def generate_legal_document_pdf(
    document_type: str, 
    addressee_title: str, 
    addressee_address: str, 
    subject: str, 
    body_text: str, 
    applicant_name: str, 
    evidence_url: str = None
) -> str:
    """
    Generates a universal formal legal document (RTI, FIR draft, Grievance, etc.) 
    and securely uploads it to Google Cloud Storage.
    """
    try:
        def safe_str(s: str) -> str:
            if not s: return ""
            return s.encode('latin-1', 'replace').decode('latin-1')

        pdf = FPDF()
        pdf.add_page()
        
        # --- Header ---
        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, txt=safe_str(document_type).upper(), ln=True, align='C')
        pdf.set_font("Arial", 'I', 9)
        pdf.cell(0, 10, txt="Drafted via Samvidhan Assistant (Constitutional Rights Portal)", ln=True, align='C')
        pdf.ln(8)

        # --- Addressee ---
        pdf.set_font("Arial", 'B', 11)
        pdf.cell(0, 6, txt="To,", ln=True)
        pdf.cell(0, 6, txt=safe_str(addressee_title), ln=True)
        pdf.set_font("Arial", size=11)
        pdf.multi_cell(0, 6, txt=safe_str(addressee_address))
        pdf.ln(6)

        # --- Subject ---
        pdf.set_font("Arial", 'B', 11)
        pdf.multi_cell(0, 6, txt=f"Subject: {safe_str(subject)}")
        pdf.ln(4)

        # --- Body ---
        pdf.set_font("Arial", size=11)
        pdf.multi_cell(0, 6, txt=f"Respected Sir/Madam,\n\n{safe_str(body_text)}")
        pdf.ln(6)

        # --- Evidence Section ---
        if evidence_url:
            pdf.ln(10)
            pdf.set_font("Arial", 'B', 11)
            pdf.cell(0, 6, txt="Enclosures:", ln=True)
            pdf.set_font("Arial", size=11)
            pdf.cell(0, 6, txt="1. Attached Evidence (Annexure - A)", ln=True)
            pdf.ln(8)

        # --- Footer ---
        pdf.set_font("Arial", size=11)
        pdf.cell(0, 6, txt=f"Date: {datetime.now().strftime('%d-%m-%Y')}", ln=True)
        pdf.cell(0, 6, txt="Sincerely,", ln=True)
        pdf.set_font("Arial", 'B', 11)
        pdf.cell(0, 6, txt=safe_str(applicant_name), ln=True)

        # --- EXTREME FILENAME SANITIZATION ---
        # 1. Replace anything that is NOT a letter or number with an underscore
        safe_doc_type = re.sub(r'[^a-zA-Z0-9]', '_', str(document_type))
        # 2. Collapse multiple underscores into a single one and strip edges
        safe_doc_type = re.sub(r'_+', '_', safe_doc_type).strip('_')
        
        # Fallback just in case the AI returned weird empty formatting
        if not safe_doc_type:
            safe_doc_type = "Legal_Document"

        filename = f"{safe_doc_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        filepath = f"/tmp/{filename}"
        
        pdf.output(filepath)

        # --- Save and Upload ---
        storage_client = storage.Client()
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(f"generated_documents/{filename}")
        blob.upload_from_filename(filepath)
        
        if os.path.exists(filepath):
            os.remove(filepath)

        return f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/generated_documents/{filename}"

    except Exception as e:
        print(f"PDF Generation Failed: {e}")
        return ""