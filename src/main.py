from fastapi import FastAPI, UploadFile, File, Form, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from embed import INDEX_PATH, META_PATH, build_faiss_index
from decision import get_decision, summarize_clause
import os
import uvicorn
import json
from typing import List, Dict, Any

app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not (os.path.exists(INDEX_PATH) and os.path.exists(META_PATH)):
    print("Building FAISS index...")
    build_faiss_index()
else:
    print("FAISS index found.")

@app.post("/query")
async def query_endpoint(query: str = Form(...), file: UploadFile = File(None)):
    # If file is provided, you can add logic to process it here
    # For now, just use the query
    result = get_decision(query)
    return JSONResponse(result)

@app.post("/chat")
async def chat_endpoint(request: Request):
    data = await request.json()
    # Simulate a chat response (replace with your LLM logic if needed)
    messages = data.get("messages", [])
    # For now, just echo the last user message
    user_message = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    response = f"Echo: {user_message}"
    return {"response": response}

@app.post("/summarize")
async def summarize_endpoint(body: dict = Body(...)):
    text = body.get("text", "")
    if not text or len(text.strip()) < 5:
        return {"summary": "Please provide a legal or policy clause to summarize.", "confidence": 0, "flag": True}
    result = summarize_clause(text)
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 