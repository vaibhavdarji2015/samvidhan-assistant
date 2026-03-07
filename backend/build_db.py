import os
import gc
from langchain_community.document_loaders import PyPDFLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.retrievers import BM25Retriever
from langchain_chroma import Chroma
from services.legal_splitter import LegalDocumentSplitter
import pickle

# Paths
CHROMA_DIR = "chroma_db"
BM25_PATH = "bm25_index.pkl"
LIBRARY_PATH = "legal_library"


def build_hybrid_database():
    if not os.path.exists(LIBRARY_PATH):
        print(f"Error: Folder '{LIBRARY_PATH}' not found.")
        return

    pdf_files = [f for f in os.listdir(LIBRARY_PATH) if f.lower().endswith('.pdf')]
    print(f"Found {len(pdf_files)} PDFs. Starting processing...")

    # Embedding model — BAAI/bge-large-en-v1.5 (1024-dim, top-tier English retrieval)
    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-large-en-v1.5")

    # Parent splitter: Legal-structure-aware splitting for larger context chunks
    parent_splitter = LegalDocumentSplitter(chunk_size=2000, chunk_overlap=200)
    
    # Child splitter: semantic chunking is too slow without a GPU
    # Falling back to fast character-based splitting
    child_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
    print("Using RecursiveCharacterTextSplitter for fast child chunk splitting.")
    all_parent_chunks = []
    all_child_chunks = []

    # Process exactly one PDF at a time to prevent RAM overload
    for i, filename in enumerate(pdf_files, 1):
        print(f"Processing {i}/{len(pdf_files)}: {filename}")
        file_path = os.path.join(LIBRARY_PATH, filename)
        act_name = filename.replace(".pdf", "").replace("-", " ").title()
        
        try:
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            
            # Inject Metadata (Act Name) into every page/chunk for future filtering
            for doc in docs:
                doc.metadata["act_name"] = act_name
            
            # Create parent chunks
            parents = parent_splitter.split_documents(docs)
            for p in parents:
                p.metadata["act_name"] = act_name
            all_parent_chunks.extend(parents)
            
            # Create child chunks (for vector + BM25)
            try:
                children = child_splitter.split_documents(docs)
            except Exception:
                # Fallback for documents where semantic chunking fails
                fallback = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
                children = fallback.split_documents(docs)
            
            for c in children:
                c.metadata["act_name"] = act_name
            all_child_chunks.extend(children)
            
        except Exception as e:
            print(f"Failed to read {filename}: {e}")
            
        gc.collect()

    # --- Build ChromaDB Vector Store (replaces FAISS) ---
    print(f"\nBuilding ChromaDB vector store with {len(all_child_chunks)} child chunks...")
    
    # Delete old ChromaDB directory if it exists (clean rebuild)
    if os.path.exists(CHROMA_DIR):
        import shutil
        shutil.rmtree(CHROMA_DIR)
    
    # Initialize empty Chroma DB
    vector_store = Chroma(
        embedding_function=embeddings,
        persist_directory=CHROMA_DIR,
        collection_metadata={"hnsw:space": "cosine"}
    )
    
    # Add documents in batches WITH A PROGRESS BAR
    try:
        from tqdm.auto import tqdm
        BATCH_SIZE = 1000
        total = len(all_child_chunks)
        print("Generating Embeddings. This is the heavy part...")
        for start in tqdm(range(0, total, BATCH_SIZE), desc="Embedding Chunks"):
            end = min(start + BATCH_SIZE, total)
            vector_store.add_documents(all_child_chunks[start:end])
    except ImportError:
        # Fallback if tqdm is not installed
        print("tqdm not installed. Running without progress bar...")
        vector_store = Chroma.from_documents(
            documents=all_child_chunks,
            embedding=embeddings,
            persist_directory=CHROMA_DIR,
            collection_metadata={"hnsw:space": "cosine"}
        )
        
    print(f"ChromaDB saved to '{CHROMA_DIR}' with {vector_store._collection.count()} vectors.")

    # --- Build BM25 index over child chunks ---
    print(f"Building BM25 keyword index over {len(all_child_chunks)} chunks...")
    bm25_retriever = BM25Retriever.from_documents(all_child_chunks)
    bm25_retriever.k = 4
    with open(BM25_PATH, "wb") as f:
        pickle.dump(bm25_retriever, f)
        
    print("\n✅ Hybrid Database (ChromaDB + BM25) successfully built and saved to disk!")
    print(f"   ChromaDB: {CHROMA_DIR}/")
    print(f"   BM25:     {BM25_PATH}")
    print(f"   Total child chunks: {len(all_child_chunks)}")
    print(f"   Total parent chunks: {len(all_parent_chunks)}")


if __name__ == "__main__":
    build_hybrid_database()