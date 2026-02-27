import os
import pickle
import gc
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.retrievers import BM25Retriever

def build_hybrid_database():
    library_path = "legal_library"
    index_path = "faiss_index"
    bm25_path = "bm25_index.pkl"
    
    if not os.path.exists(library_path):
        print(f"Error: Folder '{library_path}' not found.")
        return

    pdf_files = [f for f in os.listdir(library_path) if f.lower().endswith('.pdf')]
    print(f"Found {len(pdf_files)} PDFs. Starting memory-safe processing...")

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=250)
    all_chunks = []

    # Process exactly one PDF at a time to prevent RAM overload
    for i, filename in enumerate(pdf_files, 1):
        print(f"Processing {i}/{len(pdf_files)}: {filename}")
        file_path = os.path.join(library_path, filename)
        
        try:
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            chunks = text_splitter.split_documents(docs)
            all_chunks.extend(chunks)
        except Exception as e:
            print(f"Failed to read {filename}: {e}")
            
        # Force garbage collection to free up RAM immediately
        del loader
        del docs
        del chunks
        gc.collect()

    print(f"\nSuccessfully extracted {len(all_chunks)} total chunks. Building FAISS vector math...")
    
    # Build and save Semantic Search (FAISS)
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    vector_store = FAISS.from_documents(documents=all_chunks, embedding=embeddings)
    vector_store.save_local(index_path)
    
    print("FAISS built! Now building exact-keyword index (BM25)...")
    
    # Build and save Keyword Search (BM25)
    bm25_retriever = BM25Retriever.from_documents(all_chunks)
    bm25_retriever.k = 4
    with open(bm25_path, "wb") as f:
        pickle.dump(bm25_retriever, f)
        
    print("\nHybrid Database successfully built and saved to disk!")

if __name__ == "__main__":
    build_hybrid_database()