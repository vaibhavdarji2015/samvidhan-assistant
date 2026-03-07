import os
from google.cloud import storage

def upload_to_gcs(bucket_name, local_path, gcs_path):
    client = storage.Client()
    bucket = client.bucket(bucket_name)

    if os.path.isfile(local_path):
        blob = bucket.blob(gcs_path)
        blob.upload_from_filename(local_path)
        print(f"Uploaded {local_path} to gs://{bucket_name}/{gcs_path}")
    elif os.path.isdir(local_path):
        for root, dirs, files in os.walk(local_path):
            if ".DS_Store" in files:
                files.remove(".DS_Store")
            for f in files:
                file_path = os.path.join(root, f)
                rel_path = os.path.relpath(file_path, local_path)
                blob_path = f"{gcs_path}/{rel_path}"
                blob = bucket.blob(blob_path)
                blob.upload_from_filename(file_path)
                print(f"Uploaded {file_path} to gs://{bucket_name}/{blob_path}")

bucket = "samvidhan-evidence-bucket"
print(f"Uploading databases to {bucket}...")
upload_to_gcs(bucket, "backend/bm25_index.pkl", "database/bm25_index.pkl")
upload_to_gcs(bucket, "backend/faiss_index", "database/faiss_index")
print("Done!")
