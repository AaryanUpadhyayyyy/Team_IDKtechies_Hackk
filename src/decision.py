import json
import re
from query import search_faiss
# import ollama  # No longer needed
from langchain_ollama import ChatOllama

SYSTEM_PROMPT = """
You are an expert insurance claim processor. Given a user query and a list of relevant policy document clauses (numbered), you must:
- Parse the query for key details (age, procedure, location, policy duration, etc.)
- Evaluate the provided clauses to determine if the claim is approved, the payout amount (if any), and provide a justification.
- Reference the clause numbers in your justification (e.g., "as per Clause 2").
- Output a JSON with: decision (approved/rejected), amount (plain number, no commas), and justification (with clause references).
- Do NOT output clause_mapping; that will be handled by the backend.
- Respond ONLY with a valid JSON object, no explanation, no markdown, no extra text.
- Use only plain numbers (no commas, no currency symbols) for the amount field in the JSON.
"""

def build_prompt(query, chunks):
    context = "\n\n".join([f"Clause {i+1}: {c['text']}" for i, c in enumerate(chunks)])
    prompt = f"""
User Query: {query}

Relevant Clauses (numbered):
{context}

Respond ONLY in the following JSON format:
{{
  "decision": "approved/rejected",
  "amount": <number or null>,
  "justification": "..."
}}
Respond ONLY with a valid JSON object, no explanation, no markdown, no extra text. Use only plain numbers (no commas, no currency symbols) for the amount field in the JSON.
"""
    return prompt

def clean_json_string(text):
    def remove_commas_in_numbers(match):
        return match.group(0).replace(",", "")
    text = re.sub(r'\d{1,3}(,\d{2,3})+', remove_commas_in_numbers, text)
    return text

def extract_json(text):
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        cleaned = clean_json_string(match.group(0))
        try:
            return json.loads(cleaned)
        except Exception:
            return None
    return None

def get_llm_response(prompt):
    llm = ChatOllama(model="gemma:2b", temperature=0, seed=42)
    messages = [
        ("system", SYSTEM_PROMPT),
        ("user", prompt)
    ]
    response = llm.invoke(messages)
    return response.content

def summarize_clause(text):
    prompt = f"""
You are a legal language simplifier. Given the following legal or policy clause, rewrite it in clear, plain English so that a non-technical person can understand it. If the clause is already simple, say so. If you are unsure, say 'Model is unsure.'

Clause:
{text}

Respond ONLY in the following JSON format:
{{
  "summary": "...plain English summary...",
  "confidence": <number between 0 and 1>,
  "flag": <true/false if model is unsure>
}}
"""
    llm = ChatOllama(model="gemma:2b", temperature=0, seed=42)
    messages = [
        ("system", "You are a legal language simplifier. Always respond in JSON as instructed."),
        ("user", prompt)
    ]
    response = llm.invoke(messages)
    # Try to parse JSON
    try:
        data = json.loads(response.content)
    except Exception:
        # Fallback: try to extract JSON
        match = re.search(r'\{[\s\S]*\}', response.content)
        if match:
            try:
                data = json.loads(match.group(0))
            except Exception:
                data = {"summary": response.content, "confidence": 0.5, "flag": True}
        else:
            data = {"summary": response.content, "confidence": 0.5, "flag": True}
    return data

def get_decision(query, top_k=5):
    chunks = search_faiss(query, top_k=top_k)
    prompt = build_prompt(query, chunks)
    answer = get_llm_response(prompt)
    try:
        result = json.loads(clean_json_string(answer))
    except Exception:
        result = extract_json(answer)
        if result is None:
            result = {"error": "Could not parse LLM response", "raw": answer}
    # Deterministic clause mapping: always return the actual chunks with all metadata
    clause_mapping = []
    for i, c in enumerate(chunks):
        clause_mapping.append({
            "clause": c["text"],
            "source": c["source"],
            "chunk_id": c["chunk_id"],
            "page_number": c.get("page_number"),
            "context": c["text"]
        })
    result["clause_mapping"] = clause_mapping
    return result

if __name__ == "__main__":
    query = "46-year-old male, knee surgery in Pune, 3-month-old insurance policy"
    result = get_decision(query)
    print(json.dumps(result, indent=2)) 