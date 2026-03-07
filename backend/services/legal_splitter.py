"""
Custom Legal Document Splitter for Indian legislation.

Detects structural boundaries in Indian legal acts (Parts, Chapters, Sections, Articles)
and splits at those natural boundaries instead of arbitrary character counts.
Falls back to RecursiveCharacterTextSplitter for documents without detectable structure.
"""

import re
from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


# Patterns that indicate structural boundaries in Indian legal documents
LEGAL_BOUNDARY_PATTERNS = [
    # PART headings: "PART I", "PART II", "PART III" etc.
    r'^\s*PART\s+[IVXLCDM]+\b',
    # CHAPTER headings: "CHAPTER I", "CHAPTER II" etc.
    r'^\s*CHAPTER\s+[IVXLCDM0-9]+\b',
    # Section headings: "Section 1.", "1.", "Section 12A."
    r'^\s*(?:Section\s+)?\d+[A-Z]?\.\s',
    # Article headings: "Article 14", "Article 21" etc.
    r'^\s*Article\s+\d+[A-Z]?\b',
    # Schedule headings
    r'^\s*(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH)\s+SCHEDULE\b',
    r'^\s*SCHEDULE\s+[IVXLCDM0-9]+\b',
]

# Combined pattern for splitting
SPLIT_PATTERN = re.compile(
    '|'.join(LEGAL_BOUNDARY_PATTERNS),
    re.IGNORECASE | re.MULTILINE
)


class LegalDocumentSplitter:
    """
    Splits legal documents at structural boundaries (Parts, Chapters, Sections, Articles).
    
    If a document has detectable legal structure, it splits at those natural boundaries
    and merges small adjacent sections to maintain a target chunk size.
    If no structure is detected, falls back to RecursiveCharacterTextSplitter.
    """
    
    def __init__(self, chunk_size: int = 2000, chunk_overlap: int = 200, min_chunk_size: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
        self.fallback_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
    
    def _has_legal_structure(self, text: str) -> bool:
        """Check if the text has detectable legal document structure."""
        matches = SPLIT_PATTERN.findall(text)
        # Need at least 3 structural markers to consider it structured
        return len(matches) >= 3
    
    def _split_at_boundaries(self, text: str) -> List[str]:
        """Split text at legal structural boundaries."""
        # Find all boundary positions
        boundaries = []
        for match in SPLIT_PATTERN.finditer(text):
            boundaries.append(match.start())
        
        if not boundaries:
            return [text]
        
        # Split at boundaries
        chunks = []
        for i, start in enumerate(boundaries):
            end = boundaries[i + 1] if i + 1 < len(boundaries) else len(text)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
        
        # Also capture any text before the first boundary
        if boundaries[0] > 0:
            preamble = text[:boundaries[0]].strip()
            if preamble:
                chunks.insert(0, preamble)
        
        return chunks
    
    def _merge_small_chunks(self, chunks: List[str]) -> List[str]:
        """Merge chunks that are too small with adjacent chunks."""
        if not chunks:
            return chunks
        
        merged = []
        current = chunks[0]
        
        for chunk in chunks[1:]:
            if len(current) < self.min_chunk_size:
                current += "\n\n" + chunk
            elif len(current) + len(chunk) <= self.chunk_size:
                current += "\n\n" + chunk
            else:
                merged.append(current)
                current = chunk
        
        if current:
            merged.append(current)
        
        return merged
    
    def _split_oversized_chunks(self, chunks: List[str]) -> List[str]:
        """Split chunks that exceed the max chunk size."""
        result = []
        for chunk in chunks:
            if len(chunk) <= self.chunk_size:
                result.append(chunk)
            else:
                # Use fallback splitter for oversized chunks
                sub_chunks = self.fallback_splitter.split_text(chunk)
                result.extend(sub_chunks)
        return result
    
    def split_text(self, text: str) -> List[str]:
        """Split a single text string into chunks."""
        if not self._has_legal_structure(text):
            return self.fallback_splitter.split_text(text)
        
        chunks = self._split_at_boundaries(text)
        chunks = self._merge_small_chunks(chunks)
        chunks = self._split_oversized_chunks(chunks)
        
        return chunks
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split a list of Documents, preserving metadata."""
        result = []
        
        for doc in documents:
            if not self._has_legal_structure(doc.page_content):
                # Fallback for unstructured documents
                fallback_docs = self.fallback_splitter.split_documents([doc])
                result.extend(fallback_docs)
                continue
            
            chunks = self.split_text(doc.page_content)
            
            for i, chunk in enumerate(chunks):
                # Try to extract section/article number from the chunk
                section_match = re.search(
                    r'(?:Section|Article)\s+(\d+[A-Z]?)', 
                    chunk[:200], 
                    re.IGNORECASE
                )
                
                new_metadata = doc.metadata.copy()
                new_metadata["chunk_index"] = i
                if section_match:
                    new_metadata["section"] = section_match.group(1)
                
                result.append(Document(
                    page_content=chunk,
                    metadata=new_metadata
                ))
        
        return result
