import os
import zipfile
import requests
from datetime import datetime
from google.cloud import storage
from core.config import GCS_BUCKET_NAME

def create_and_upload_zip(main_pdf_url: str, evidence_urls: list) -> str:
    """
    Downloads the generated PDF and all evidence files, bundles them into a ZIP archive,
    uploads it to Google Cloud Storage, and returns the public download URL.
    """
    if not main_pdf_url and not evidence_urls:
        return ""

    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    zip_filename = f"Legal_Case_Bundle_{timestamp}.zip"
    zip_filepath = f"/tmp/{zip_filename}"

    try:
        # Create a new ZIP file
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 1. Download and add the main drafted PDF
            if main_pdf_url:
                pdf_name = main_pdf_url.split('/')[-1]
                response = requests.get(main_pdf_url)
                if response.status_code == 200:
                    temp_pdf_path = f"/tmp/{pdf_name}"
                    with open(temp_pdf_path, 'wb') as f:
                        f.write(response.content)
                    # Put it in the root of the ZIP
                    zipf.write(temp_pdf_path, arcname=f"1_{pdf_name}")
                    os.remove(temp_pdf_path)
            # 2. Download and add all evidence files into an 'Annexures' folder
            for i, url in enumerate(evidence_urls, start=1):
                evidence_name = url.split('/')[-1]
                # Clean up the UUID prefix for a beautiful filename
                clean_name = evidence_name.split('-', 5)[-1] if '-' in evidence_name else evidence_name
                
                response = requests.get(url)
                if response.status_code == 200:
                    temp_ev_path = f"/tmp/{evidence_name}"
                    with open(temp_ev_path, 'wb') as f:
                        f.write(response.content)
                    # Put it inside an "Annexures" subfolder inside the ZIP
                    zipf.write(temp_ev_path, arcname=f"Annexures/Annexure_{i}_{clean_name}")
                    os.remove(temp_ev_path)
            # 3. Upload the ZIP to Google Cloud Storage
            storage_client = storage.Client()
            bucket = storage_client.bucket(GCS_BUCKET_NAME)
            blob = bucket.blob(f"generated_zips/{zip_filename}")
            blob.upload_from_filename(zip_filepath)
            # 4. Clean up local zip file to save server memory
        if os.path.exists(zip_filepath):
            os.remove(zip_filepath)

        return f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/generated_zips/{zip_filename}"

    except Exception as e:
        print(f"Zip Generation Failed: {e}")
        if os.path.exists(zip_filepath):
            os.remove(zip_filepath)
        return ""