import os
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
if not SARVAM_API_KEY:
    raise RuntimeError("SARVAM_API_KEY not found.")

SARVAM_HEADERS = {
    "API-Subscription-Key": SARVAM_API_KEY,
    "Content-Type": "application/json"
}

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "samvidhan-evidence-bucket")