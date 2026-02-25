import os
import requests
from typing import List, Tuple
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.config import SARVAM_HEADERS
from schemas.chat import Message
from services.vision import extract_text_from_document
from services.sarvam import translate_text
from services.extractor import extract_legal_document_data
from services.pdf_generator import generate_legal_document_pdf
from services.zip_generator import create_and_upload_zip

# Global state for vector db
vector_store = None

def init_vector_store():
    """Initializes the FAISS index on startup."""
    global vector_store
    index_path = "faiss_index"
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    if os.path.exists(index_path):
        vector_store = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    else:
        pdf_path = "indian_constitution_2024.pdf"
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"Required document '{pdf_path}' not found.")

        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=250)
        split_chunks = text_splitter.split_documents(docs)
        vector_store = FAISS.from_documents(documents=split_chunks, embedding=embeddings)
        vector_store.save_local(index_path)

def cleanup_vector_store():
    """Releases memory on shutdown."""
    global vector_store
    vector_store = None

def process_rag_pipeline(english_query: str, target_language: str, chat_history: List[Message], user_name: str = "Concerned Citizen") -> Tuple[str, str]:
    """Orchestrates RAG, OCR, Conversational Memory, and LLM Generation."""
    
    # 1. OCR Check: Did the user attach evidence?
    extracted_text = ""
    latest_message = chat_history[-1] if chat_history else None
    
    if latest_message and getattr(latest_message, 'evidence_urls', None):
        extracted_texts = []
        for url in latest_message.evidence_urls:
            print(f"Evidence URL detected: {url}")
            extracted_texts.append(f"--- Document {url} ---\n{extract_text_from_document(url)}")
        extracted_text = "\n\n".join(extracted_texts)
        print(f"--- EXTRACTED OCR TEXT ---\n{extracted_text}\n--------------------------")
        
    # 2. Retrieve Legal Context
    search_query = english_query
    if extracted_text and len(english_query) < 20:
        search_query += " " + extracted_text[:200]
    
    docs = vector_store.similarity_search(search_query, k=5)
    context = "\n".join([doc.page_content for doc in docs])

    # 3. Format Chat History (Memory)
    formatted_history = ""
    if chat_history:
        recent_history = chat_history[-6:]
        history_lines = []
        for msg in recent_history:
            line = f"{msg.role.capitalize()}: {msg.content}"
            if getattr(msg, 'evidence_urls', None):
                urls_str = ', '.join(msg.evidence_urls)
                line += f"\n[SYSTEM NOTE: User attached evidence located at: {urls_str}]"
            history_lines.append(line)
        formatted_history = "\n".join(history_lines)

    # 4. The Agentic Prompt (Personalized for your app)
    system_prompt = f"""You are the Samvidhan Assistant, an empathetic legal advisor for Indian Constitutional Law and Civic Rights.
You are currently speaking to a citizen named: {user_name}. 

CRITICAL FORMATTING RULES - YOU MUST OBEY THESE:
1. Speak exclusively in flowing, conversational paragraphs. 
2. ABSOLUTELY NO LISTS. You are strictly forbidden from using bullet points, numbered lists, or dashes.
3. ABSOLUTELY NO BOLDING. Do not use asterisks (**) for formatting. 
4. DO NOT ask the user for a checklist of items (e.g., do not say "Please provide: Location, Date, Name"). 
5. Instead, ask ONE natural question at the end to keep the conversation going, like a real human.

HOW TO ANSWER:
Read the LEGAL CONTEXT. Weave the exact Articles or laws naturally into your sentences. Empathize with their situation first, explain the law as a story, and then ask how you can help them take action.

AUTO-DRAFTING:
If the user asks you to draft a formal complaint/document, evaluate if you have enough basic details (like the company/department name, location, and the core issue). 
- If you DO NOT have enough details, ask the user for them naturally in a paragraph. CRITICAL: DO NOT include the [ACTION: DRAFT_DOCUMENT] tag if you are still asking for details.
- ONLY include the [ACTION: DRAFT_DOCUMENT] tag at the very end of your response IF the user has already provided the details and you are ready to generate the final file.

PREVIOUS CONVERSATION:
{formatted_history}

LEGAL CONTEXT: 
{context}
"""

    if extracted_text:
        system_prompt += f"\n\n[SYSTEM OCR ALERT: User attached an image. Raw text:\n\"\"\"{extracted_text}\"\"\"\nAnalyze this text immediately.]"
    
    # Forcefully inject the OCR text into the user's message
    final_user_content = english_query
    if extracted_text:
        final_user_content += f"\n\n[USER UPLOADED DOCUMENT TEXT:]\n\"\"\"{extracted_text}\"\"\"\n[INSTRUCTION: Read the document text above and answer my query based ONLY on the details found inside it.]"

    # 5. Generate English Response
    chat_url = "https://api.sarvam.ai/v1/chat/completions"
    chat_payload = {
        "model": "sarvam-m",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": final_user_content}
        ]
    }
    
    chat_response = requests.post(chat_url, json=chat_payload, headers=SARVAM_HEADERS)
    chat_response.raise_for_status()
    english_answer = chat_response.json().get("choices")[0].get("message").get("content")

    # --- AGENTIC ACTION INTERCEPTOR ---
    pdf_link_markdown = ""
    if "[ACTION: DRAFT_DOCUMENT]" in english_answer:
        print("Agent triggered document generation implicitly!")
        
        # 1. Remove the secret tag so the user doesn't see it
        english_answer = english_answer.replace("[ACTION: DRAFT_DOCUMENT]", "").strip()

        # 2. Gather ALL evidence the user uploaded during the conversation
        evidence_links = []
        for msg in chat_history:
            if getattr(msg, 'evidence_urls', None):
                for url in msg.evidence_urls:
                    if url not in evidence_links:
                        evidence_links.append(url)
        
        # 3. Automatically run the extractor and PDF generator
        try:
            legal_data = extract_legal_document_data(chat_history, user_name)
            pdf_url = generate_legal_document_pdf(
                document_type=legal_data.get("document_type", "Formal Legal Representation"),
                addressee_title=legal_data.get("addressee_title", "To the Concerned Authority"),
                addressee_address=legal_data.get("addressee_address", "Appropriate Government Office"),
                subject=legal_data.get("subject", "Formal Representation regarding Violation of Rights"),
                body_text=legal_data.get("body_text", "Please find the details of my grievance enclosed."),
                applicant_name=legal_data.get("applicant_name", user_name),
                evidence_url=evidence_links[0] if evidence_links else None
            )
            if pdf_url:
                generated_filename = pdf_url.split('/')[-1]
                pdf_link_markdown = f"\n\n📄 Your Legal Documents:\n[{generated_filename}]({pdf_url})"
                
                if evidence_links:
                    pdf_link_markdown += f"\n\n📎 Annexures (Evidence):"
                    for i, link in enumerate(evidence_links, 1):
                        evidence_name = link.split('/')[-1]
                        clean_evidence_name = evidence_name.split('-', 5)[-1] if '-' in evidence_name else evidence_name
                        pdf_link_markdown += f"\n[{clean_evidence_name}]({link})"
                    
                    try:
                        zip_url = create_and_upload_zip(pdf_url, evidence_links)
                        if zip_url:
                            pdf_link_markdown += f"\n\n[Download Entire Case Bundle (.zip)]({zip_url})"
                    except Exception as zip_e:
                        print(f"Agent failed to bundle ZIP: {zip_e}")

        except Exception as e:
            print(f"Agent failed to auto-draft: {e}")
    
    final_answer = translate_text(text=english_answer, source_language="en-IN", target_language=target_language)
    
    if pdf_link_markdown:
        final_answer += pdf_link_markdown
        english_answer += pdf_link_markdown
    
    return final_answer, english_answer