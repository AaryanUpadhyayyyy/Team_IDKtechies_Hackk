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
   py src/main.py
   ```
   - The first run will build the index from your PDFs.
   - Enter your query when prompted (e.g., `46-year-old male, knee surgery in Pune, 3-month-old insurance policy`).
   - The system will output a structured JSON response with decision, amount, justification, and clause mapping.

## Notes
- To re-index after adding new PDFs, delete `src/faiss.index` and `src/faiss_meta.pkl` and re-run the script.
- For troubleshooting, see error messages or ask for help. 