# Bajaj Hackathon LLM Document Query System

## Setup Instructions

1. **Install dependencies:**
   ```
   pip install -r requirements.txt
   ```

2. **Set up your OpenAI API key:**
   - Create a file named `.env` in the project root (same folder as your PDFs).
   - Add this line to `.env` (replace with your actual key):
     ```
     OPENAI_API_KEY=sk-...your-key-here...
     ```

3. **Run the system:**
   ```
  
   ```
  --Run backend :cd src; py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  --Run frontend : cd frontend ; npm start

## Notes
- To re-index after adding new PDFs, delete `src/faiss.index` and `src/faiss_meta.pkl` and re-run the script.
- For troubleshooting, see error messages or ask for help. 
