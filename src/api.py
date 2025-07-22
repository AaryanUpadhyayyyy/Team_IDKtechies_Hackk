from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from decision import get_decision
import ollama

app = FastAPI()

# Allow all origins for development (fix CORS errors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/query")
async def query_endpoint(query: str = Form(...), file: UploadFile = File(None)):
    # You can add logic to process the file if needed
    result = get_decision(query)
    return result

@app.post("/chat")
async def chat_endpoint(request: Request):
    data = await request.json()
    messages = data.get("messages", [])
    # Use Ollama to get a conversational response
    response = ollama.chat(
        model='gemma:2b',
        messages=messages,
        temperature=0
    )
    return {"response": response['message']['content']} 