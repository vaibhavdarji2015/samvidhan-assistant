import datetime
from fastapi import HTTPException
from google.cloud import storage
from core.config import GCS_BUCKET_NAME

def generate_v4_upload_url(filename: str, content_type: str) -> tuple[str, str]:
    """
    Generates a V4 signed URL for uploading to Google Cloud Storage.
    Returns a tuple: (signed_url, public_url)
    """
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        
        # We store all evidence in the 'evidence/' folder in the bucket
        blob_path = f"evidence/{filename}"
        blob = bucket.blob(blob_path)

        # Generate a V4 signed URL strictly for uploading (PUT)
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="PUT",
            content_type=content_type,
        )
        
        # The URL where the file will live after the React app uploads it
        public_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_path}"
        
        return url, public_url
    
    except Exception as e:
        print(f"GCS Signed URL Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate secure upload URL: {str(e)}")