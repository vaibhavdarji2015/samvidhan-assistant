import os
import pickle
import numpy as np
from typing import Optional, Tuple
from langchain_huggingface import HuggingFaceEmbeddings

CACHE_FILE = "semantic_cache.pkl"
SIMILARITY_THRESHOLD = 0.95


class SemanticCache:
    """A simple local semantic cache using vector similarity."""

    def __init__(self, model_name: str = "BAAI/bge-large-en-v1.5"):
        self.embeddings = HuggingFaceEmbeddings(model_name=model_name)
        self.cache = []  # List of (vector, answer, sources)
        self.load()

    def load(self):
        """Loads cache from disk."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "rb") as f:
                    self.cache = pickle.load(f)
                print(f"✅ Semantic Cache loaded with {len(self.cache)} entries.")
            except Exception as e:
                print(f"⚠️ Failed to load semantic cache: {e}")
                self.cache = []

    def save(self):
        """Saves cache to disk."""
        try:
            with open(CACHE_FILE, "wb") as f:
                pickle.dump(self.cache, f)
        except Exception as e:
            print(f"⚠️ Failed to save semantic cache: {e}")

    def lookup(self, query: str) -> Optional[Tuple[str, str]]:
        """Returns (answer, sources) if a similar query exists in cache."""
        if not self.cache:
            return None

        query_vector = np.array(self.embeddings.embed_query(query))
        
        best_score = -1
        best_match = None

        for cached_vector, answer, sources in self.cache:
            # Cosine similarity
            dot_product = np.inner(query_vector, cached_vector)
            norm_q = np.linalg.norm(query_vector)
            norm_c = np.linalg.norm(cached_vector)
            similarity = dot_product / (norm_q * norm_c)

            if similarity > best_score:
                best_score = similarity
                best_match = (answer, sources)

        if best_score >= SIMILARITY_THRESHOLD:
            print(f"🎯 Semantic Cache HIT! (Similarity: {best_score:.4f})")
            return best_match
        
        return None

    def store(self, query: str, answer: str, sources: str):
        """Stores a new query-answer pair in the cache."""
        query_vector = np.array(self.embeddings.embed_query(query))
        self.cache.append((query_vector, answer, sources))
        # Keep cache size reasonable (last 1000 entries)
        if len(self.cache) > 1000:
            self.cache.pop(0)
        self.save()
