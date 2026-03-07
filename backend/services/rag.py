import os
import re
import json
import asyncio
import pickle
from typing import List, Tuple
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_classic.retrievers.contextual_compression import ContextualCompressionRetriever
from langchain_community.document_compressors.flashrank_rerank import FlashrankRerank
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.tools import tool
from langchain_chroma import Chroma

from core.config import SARVAM_HEADERS, SARVAM_API_KEY
from schemas.chat import Message
from services.vision import extract_text_from_document
from services.sarvam import translate_text
from services.pdf_generator import generate_legal_document_pdf
from services.zip_generator import create_and_upload_zip

# Global state
ensemble_retriever = None
_llm_instance = None  # Reusable LLM instance


def _get_llm():
    """Returns a shared LLM instance for memory summarization and queries."""
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatOpenAI(
            model="sarvam-m",
            api_key=SARVAM_API_KEY,
            base_url="https://api.sarvam.ai/v1",
            temperature=0.3
        )
    return _llm_instance


# --- LangChain Native Tool for Document Drafting ---
@tool
def draft_legal_document(
    document_type: str,
    subject: str,
    addressee_title: str,
    addressee_address: str,
    applicant_name: str,
    body_text: str
) -> str:
    """Draft a formal legal document (RTI, FIR, Consumer Grievance, Legal Notice, etc.) for the citizen.
    Use this tool ONLY when the user explicitly asks you to draft/generate a formal complaint or document
    AND you have enough details (company/department name, location, and core issue).
    """
    pdf_url = generate_legal_document_pdf(
        document_type=document_type,
        addressee_title=addressee_title,
        addressee_address=addressee_address,
        subject=subject,
        body_text=body_text,
        applicant_name=applicant_name,
    )
    if pdf_url:
        return f"SUCCESS: Document generated at {pdf_url}"
    return "FAILED: Could not generate the document."


def init_vector_store():
    """Lightweight startup: loads ChromaDB + BM25 indexes from disk."""
    global ensemble_retriever
    
    chroma_dir = "chroma_db"
    bm25_path = "bm25_index.pkl"
    
    if os.path.exists(chroma_dir) and os.path.exists(bm25_path):
        print("Loading Hybrid Search databases (ChromaDB + BM25)...")
        embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-large-en-v1.5")
        
        # 1. Load ChromaDB (Semantic Vector Search)
        vector_store = Chroma(
            persist_directory=chroma_dir,
            embedding_function=embeddings
        )
        chroma_retriever = vector_store.as_retriever(search_kwargs={"k": 15})
        
        # 2. Load BM25 (Exact Keywords)
        with open(bm25_path, "rb") as f:
            bm25_retriever = pickle.load(f)
            bm25_retriever.k = 15
            
        # 3. Ensemble: combine semantic + keyword search
        base_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, chroma_retriever], weights=[0.4, 0.6]
        )
        
        # 4. FlashRank reranks ensemble candidates down to the best 4
        compressor = FlashrankRerank(top_n=4)
        ensemble_retriever = ContextualCompressionRetriever(
            base_compressor=compressor, base_retriever=base_retriever
        )
        
        count = vector_store._collection.count()
        print(f"✅ Hybrid Search ready! ChromaDB: {count} vectors, BM25: loaded.")
    else:
        print("⚠️ CRITICAL WARNING: Database files not found!")
        print("Please run 'python build_db.py' to generate the indexes.")
        ensemble_retriever = None


def cleanup_vector_store():
    """Releases memory on shutdown."""
    global ensemble_retriever, _llm_instance
    ensemble_retriever = None
    _llm_instance = None


async def _summarize_old_history(old_messages: List[Message]) -> str:
    """Summarizes older chat messages to keep context without exceeding token limits."""
    if not old_messages:
        return ""
    
    history_text = "\n".join([f"{m.role}: {m.content}" for m in old_messages])
    
    try:
        summary_response = await _get_llm().ainvoke([
            SystemMessage(content="Summarize this conversation history in 2-3 sentences, focusing on the legal issues discussed and key facts mentioned."),
            HumanMessage(content=history_text)
        ])
        return summary_response.content
    except Exception as e:
        print(f"History summarization failed: {e}")
        # Fallback: just take the last message content
        return f"Previous context: {old_messages[-1].content[:200]}"


async def _hyde_transform(query: str) -> str:
    """HyDE: Generate a hypothetical legal document snippet for better retrieval.
    
    Instead of searching with the raw user query, we ask the LLM to generate
    a hypothetical answer. The embedding of this answer is closer to the 
    embeddings of relevant legal text in the database.
    """
    try:
        response = await _get_llm().ainvoke([
            SystemMessage(content="""You are an Indian legal expert. Given a question, write a short paragraph (3-4 sentences) 
that would appear in an Indian legal Act or Constitution that directly answers this question. 
Do not say 'the answer is' — write as if you are the actual legal text."""),
            HumanMessage(content=query)
        ])
        hypothetical_doc = response.content
        # Combine original query with hypothetical for balanced retrieval
        return f"{query}\n\n{hypothetical_doc}"
    except Exception as e:
        print(f"HyDE transformation failed, using original query: {e}")
        return query


async def _multi_query_retrieve(query: str) -> list:
    """Custom Multi-Query Retrieval: generates 3 query variations via LLM,
    retrieves for each, and deduplicates results for better recall.
    """
    if not ensemble_retriever:
        return []
    
    # Generate query variations
    queries = [query]  # Always include the original
    try:
        variation_response = await _get_llm().ainvoke([
            SystemMessage(content="""Generate 3 alternative versions of the given question to help retrieve relevant legal documents.
Each version should approach the topic from a different angle or use different legal terminology.
Output ONLY the 3 questions, one per line, no numbering or bullets."""),
            HumanMessage(content=query)
        ])
        variations = [q.strip() for q in variation_response.content.strip().split('\n') if q.strip()]
        queries.extend(variations[:3])
    except Exception as e:
        print(f"Multi-query generation failed, using original only: {e}")
    
    # Retrieve for each query variation in parallel
    retrieval_tasks = [ensemble_retriever.ainvoke(q) for q in queries]
    all_results = await asyncio.gather(*retrieval_tasks, return_exceptions=True)
    
    # Deduplicate by page_content
    seen_content = set()
    unique_docs = []
    for result in all_results:
        if isinstance(result, Exception):
            print(f"One retrieval variation failed: {result}")
            continue
        for doc in result:
            content_key = doc.page_content[:200]  # Use first 200 chars as dedup key
            if content_key not in seen_content:
                seen_content.add(content_key)
                unique_docs.append(doc)
    
    return unique_docs


async def process_rag_pipeline(english_query: str, target_language: str, chat_history: List[Message], user_name: str = "Concerned Citizen") -> Tuple[str, str]:
    """Orchestrates RAG, OCR, Conversational Memory, and LLM Generation — fully async."""
    
    # 1. OCR Check: Did the user attach evidence?
    extracted_text = ""
    latest_message = chat_history[-1] if chat_history else None
    
    if latest_message and getattr(latest_message, 'evidence_urls', None):
        extracted_texts = []
        for url in latest_message.evidence_urls:
            print(f"Evidence URL detected: {url}")
            extracted_texts.append(f"--- Document {url} ---\n{extract_text_from_document(url)}")
        extracted_text = "\n\n".join(extracted_texts)
        
    # 2. Retrieve Legal Context with HyDE + Multi-Query
    search_query = english_query
    if extracted_text and len(english_query) < 20:
        search_query += " " + extracted_text[:200]
    
    # HyDE: transform query into a hypothetical legal answer for better embedding match
    hyde_query = await _hyde_transform(search_query)
    
    # Multi-Query: retrieve with multiple query variations for better recall
    docs = await _multi_query_retrieve(hyde_query)
    
    # Build context WITH source citations from metadata
    context_parts = []
    for doc in docs:
        act_name = doc.metadata.get("act_name", "Unknown Act")
        page = doc.metadata.get("page", "")
        source_tag = f"[Source: {act_name}"
        if page:
            source_tag += f", Page {page}"
        source_tag += "]"
        context_parts.append(f"{source_tag}\n{doc.page_content}")
    context = "\n\n".join(context_parts)

    # 3. Conversation Memory: summarize old messages, keep recent ones verbatim
    chat_messages = []
    if chat_history:
        if len(chat_history) > 6:
            # Summarize older messages, keep last 4 verbatim
            old_messages = chat_history[:-4]
            recent_messages = chat_history[-4:]
            
            summary = await _summarize_old_history(old_messages)
            if summary:
                chat_messages.append(SystemMessage(content=f"[CONVERSATION SUMMARY: {summary}]"))
        else:
            recent_messages = chat_history
        
        for msg in recent_messages:
            if msg.role == "user" or msg.role == "system":
                content = msg.content
                if getattr(msg, 'evidence_urls', None) and msg.evidence_urls:
                    urls_str = ', '.join(msg.evidence_urls)
                    content += f"\n[SYSTEM NOTE: User attached evidence located at: {urls_str}]"
                chat_messages.append(HumanMessage(content=content))
            else:
                chat_messages.append(AIMessage(content=msg.content))

    # 4. The Agentic Prompt
    system_prompt = f"""You are the Samvidhan Assistant, an empathetic legal advisor for Indian Constitutional Law and Civic Rights.
You are currently speaking to a citizen named: {user_name}. 

CRITICAL FORMATTING RULES - YOU MUST OBEY THESE:
1. Speak exclusively in flowing, conversational paragraphs. 
2. ABSOLUTELY NO LISTS. You are strictly forbidden from using bullet points, numbered lists, or dashes.
3. ABSOLUTELY NO BOLDING. Do not use asterisks (**) for formatting. 
4. DO NOT ask the user for a checklist of items (e.g., do not say "Please provide: Location, Date, Name"). 
5. Instead, ask ONE natural question at the end to keep the conversation going, like a real human.
6. When citing legal sources, naturally mention the Act name and Section/Article (e.g., "Under the Consumer Protection Act, 2019, Section 18...").

HOW TO ANSWER:
Read the LEGAL CONTEXT below. Each chunk is tagged with its source Act. Weave the exact Articles or laws naturally into your sentences. Empathize with their situation first, explain the law as a story, and then ask how you can help them take action.

AUTO-DRAFTING:
If the user asks you to draft a formal complaint/document, evaluate if you have enough basic details (like the company/department name, location, and the core issue). 
- If you DO NOT have enough details, ask the user for them naturally in a paragraph.
- If you DO have the details and are ready to generate, use the draft_legal_document tool.

LEGAL CONTEXT: 
{context}
"""

    if extracted_text:
        system_prompt += f"\n\n[SYSTEM OCR ALERT: User attached an image. Raw text:\n\"\"\"{extracted_text}\"\"\"\nAnalyze this text immediately.]"
    
    final_user_content = english_query
    if extracted_text:
        final_user_content += f"\n\n[USER UPLOADED DOCUMENT TEXT:]\n\"\"\"{extracted_text}\"\"\"\n[INSTRUCTION: Read the document text above and answer my query based ONLY on the details found inside it.]"

    # 5. Generate English Response via LangChain ChatOpenAI with Tool Binding
    chat = ChatOpenAI(
        model="sarvam-m", 
        api_key=SARVAM_API_KEY, 
        base_url="https://api.sarvam.ai/v1",
        max_tokens=1500
    )
    
    # Bind the document drafting tool to the LLM
    chat_with_tools = chat.bind_tools([draft_legal_document])
    
    # Strict API formatting: Sarvam requires exact alternating User/Assistant messages starting with User.
    # System messages and consecutive identical roles must be merged.
    raw_messages = [SystemMessage(content=system_prompt)] + chat_messages + [HumanMessage(content=final_user_content)]
    
    merged_messages = []
    current_role = None
    current_content = []
    
    for m in raw_messages:
        # Treat SystemMessages as UserMessages for the final API payload
        role = "user" if isinstance(m, (HumanMessage, SystemMessage)) else "assistant"
        
        if role == current_role:
            current_content.append(m.content)
        else:
            if current_role is not None:
                content_str = "\n\n".join(current_content)
                if current_role == "user":
                    merged_messages.append(HumanMessage(content=content_str))
                else:
                    merged_messages.append(AIMessage(content=content_str))
            current_role = role
            current_content = [m.content]
            
    if current_role is not None:
        content_str = "\n\n".join(current_content)
        if current_role == "user":
            merged_messages.append(HumanMessage(content=content_str))
        else:
            merged_messages.append(AIMessage(content=content_str))
            
    chat_response = None
    try:
        chat_response = await chat_with_tools.ainvoke(merged_messages)
        english_answer = chat_response.content or ""
    except Exception as e:
        print(f"Error calling Sarvam via LangChain ChatOpenAI: {e}")
        # Fallback: try without tools in case the model doesn't support tool calling
        try:
            chat_response = await chat.ainvoke(merged_messages)
            english_answer = chat_response.content or ""
        except Exception as fallback_e:
            print(f"Fallback LLM call also failed: {fallback_e}")
            english_answer = "I'm sorry, I am currently facing technical issues evaluating your request. Please try again later."

    # --- AGENTIC ACTION: Handle Tool Calls from LLM ---
    pdf_link_markdown = ""
    
    if chat_response and hasattr(chat_response, 'tool_calls') and chat_response.tool_calls:
        print("Agent triggered document generation via native Tool Call!")
        for tool_call in chat_response.tool_calls:
            if tool_call.get("name") == "draft_legal_document":
                try:
                    args = tool_call.get("args", {})
                    if not args.get("applicant_name"):
                        args["applicant_name"] = user_name
                    
                    tool_result = draft_legal_document.invoke(args)
                    
                    if "SUCCESS" in tool_result:
                        pdf_url = tool_result.split("SUCCESS: Document generated at ")[-1]
                        generated_filename = pdf_url.split('/')[-1]
                        pdf_link_markdown = f"\n\n📄 Your Legal Documents:\n[{generated_filename}]({pdf_url})"
                        
                        evidence_links = []
                        for msg in chat_history:
                            if getattr(msg, 'evidence_urls', None):
                                for url in msg.evidence_urls:
                                    if url not in evidence_links:
                                        evidence_links.append(url)
                        
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
                    print(f"Agent failed to execute tool call: {e}")
    else:
        # Fallback: check for JSON block in case the model doesn't support tool calling natively
        json_match = re.search(r"```json\s*(.*?)\s*```", english_answer, re.DOTALL)
        if json_match:
            print("Agent triggered document generation via JSON fallback!")
            try:
                tool_data = json.loads(json_match.group(1))
                if tool_data.get("action") == "draft_document":
                    english_answer = re.sub(r"```json\s*.*?\s*```", "", english_answer, flags=re.DOTALL).strip()
                    
                    evidence_links = []
                    for msg in chat_history:
                        if getattr(msg, 'evidence_urls', None):
                            for url in msg.evidence_urls:
                                if url not in evidence_links:
                                    evidence_links.append(url)
                    
                    pdf_url = generate_legal_document_pdf(
                        document_type=tool_data.get("document_type", "Formal Legal Representation"),
                        addressee_title=tool_data.get("addressee_title", "To the Concerned Authority"),
                        addressee_address=tool_data.get("addressee_address", "Appropriate Government Office"),
                        subject=tool_data.get("subject", "Formal Representation regarding Violation of Rights"),
                        body_text=tool_data.get("body_text", "Please find the details of my grievance enclosed."),
                        applicant_name=tool_data.get("applicant_name", user_name),
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
                print(f"Agent failed to auto-draft from JSON: {e}")
    
    # 6. Translate the answer back to user's language (async)
    final_answer = await translate_text(text=english_answer, source_language="en-IN", target_language=target_language)
    
    if pdf_link_markdown:
        final_answer += pdf_link_markdown
        english_answer += pdf_link_markdown
    
    return final_answer, english_answer