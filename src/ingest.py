import os
from pypdf import PdfReader

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PDF_EXTENSIONS = ['.pdf']


def extract_text_by_page(pdf_path):
    reader = PdfReader(pdf_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            pages.append((i + 1, text))  # 1-indexed page number
    return pages


def chunk_text_with_page_numbers(pages, chunk_size=500):
    # pages: list of (page_number, text)
    chunks = []
    for page_number, text in pages:
        paragraphs = text.split('\n')
        current_chunk = ""
        for para in paragraphs:
            if len(current_chunk) + len(para) < chunk_size:
                current_chunk += para + " "
            else:
                if current_chunk.strip():
                    chunks.append({
                        'text': current_chunk.strip(),
                        'page_number': page_number
                    })
                current_chunk = para + " "
        if current_chunk.strip():
            chunks.append({
                'text': current_chunk.strip(),
                'page_number': page_number
            })
    return chunks


def ingest_documents():
    documents = []
    for fname in os.listdir(DATA_DIR):
        if any(fname.lower().endswith(ext) for ext in PDF_EXTENSIONS):
            pdf_path = os.path.join(DATA_DIR, fname)
            pages = extract_text_by_page(pdf_path)
            chunks = chunk_text_with_page_numbers(pages)
            for i, chunk in enumerate(chunks):
                documents.append({
                    'source': fname,
                    'chunk_id': i,
                    'text': chunk['text'],
                    'page_number': chunk['page_number']
                })
    return documents

if __name__ == "__main__":
    docs = ingest_documents()
    print(f"Extracted {len(docs)} chunks from PDFs.")
    print(docs[0] if docs else "No chunks found.") 