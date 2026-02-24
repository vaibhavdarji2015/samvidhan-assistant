import json
import re
import requests
from typing import List, Dict, Any
from core.config import SARVAM_HEADERS
from schemas.chat import Message

def extract_legal_document_data(chat_history: List[Message], user_name: str = "Concerned Citizen") -> Dict[str, Any]:
    """
    Analyzes the chat history using an LLM to automatically draft a formal Indian legal document.
    Uses Regex to safely extract JSON even if the LLM adds conversational padding.
    """
    
    # 1. Format the conversation so the LLM has full context
    formatted_history = ""
    evidence_urls = []
    for msg in chat_history:
        formatted_history += f"{msg.role.capitalize()}: {msg.content}\n"
        if getattr(msg, 'evidence_urls', None):
            evidence_urls.extend(msg.evidence_urls)
            formatted_history += f"[EVIDENCE ATTACHED: {', '.join(msg.evidence_urls)}]\n"

    # 2. Separate System Instructions and User Prompt
    system_prompt = """You are the drafting engine for the 'Samvidhan Assistant', an Indian Constitutional Rights platform.
Your task is to analyze the user's conversation and draft a formal, legally sound document based on Indian Law. 
Note: The conversation may be in an Indic language (like Gujarati). You must comprehend it, but draft the final legal document in FORMAL ENGLISH.

INSTRUCTIONS:
1. Identify the 'document_type' (e.g., "Consumer Grievance Notice").
2. Identify the 'addressee_title' (e.g., "The President, District Consumer Disputes Redressal Commission").
3. Determine the 'addressee_address' based on the location mentioned.
4. Draft a formal 'body_text' explaining the issue clearly in ENGLISH. Do NOT include the greeting or sign-off.

CRITICAL: You MUST respond ONLY with a raw JSON object. Do NOT include any introductory text, markdown formatting, or explanations. 
REQUIRED JSON SCHEMA:
{
  "document_type": "string",
  "addressee_title": "string",
  "addressee_address": "string",
  "subject": "string",
  "body_text": "string"
}
"""

    user_prompt = f"Here is the conversation history. Extract the details and output ONLY the JSON:\n\n{formatted_history}"

    # 3. Call the LLM with BOTH System and User roles
    chat_url = "https://api.sarvam.ai/v1/chat/completions"
    chat_payload = {
        "model": "sarvam-m",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1 
    }
    
    try:
        response = requests.post(chat_url, json=chat_payload, headers=SARVAM_HEADERS)
        response.raise_for_status()
        llm_response = response.json().get("choices")[0].get("message").get("content")
        
        # 4. ROBUST JSON EXTRACTION: Find the JSON block using Regex
        match = re.search(r'\{[\s\S]*\}', llm_response)
        if not match:
            raise ValueError("No JSON object could be found in the LLM response.")
            
        clean_json_str = match.group(0)
        extracted_data = json.loads(clean_json_str)
        
        # Add the known variables
        extracted_data["applicant_name"] = user_name
        extracted_data["evidence_urls"] = evidence_urls
        
        return extracted_data
        
    except Exception as e:
        print(f"Extraction Failed: {e}\nLLM Response was: {llm_response if 'llm_response' in locals() else 'None'}")
        raise ValueError("Failed to extract valid legal data from the conversation.")