import os
from google.cloud import storage

# Tell Google to use your local Service Account key
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcp-credentials.json"

def download_from_gcs(bucket_name, prefix, local_dir):
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=prefix)

    for blob in blobs:
        # Ignore empty directory markers
        if blob.name.endswith("/"):
            continue

        # Create the relative path removing the 'database/' prefix
        rel_path = blob.name.replace("database/", "")
        local_path = os.path.join(local_dir, rel_path)

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        print(f"Downloading {blob.name} to {local_path}...")
        blob.download_to_filename(local_path)

bucket = "samvidhan-evidence-bucket"
print(f"Starting download from {bucket}...")

download_from_gcs(bucket, "database/bm25_index.pkl", ".")
download_from_gcs(bucket, "database/chroma_db", ".")

print("\n✅ Download Complete! You can now run the app locally.")
