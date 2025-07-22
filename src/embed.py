import os
import pickle
import numpy as np
from langchain_openai.embeddings import OpenAIEmbeddings
from sentence_transformers import SentenceTransformer
import faiss
from ingest import ingest_documents

EMBED_DIM = 1536  # OpenAI embedding size
INDEX_PATH = os.path.join(os.path.dirname(__file__), 'faiss.index')
META_PATH = os.path.join(os.path.dirname(__file__), 'faiss_meta.pkl')


def get_embedding_model():
    try:
        return OpenAIEmbeddings()
    except Exception:
        return SentenceTransformer('all-MiniLM-L6-v2')


def embed_chunks(chunks, model):
    if isinstance(model, OpenAIEmbeddings):
        texts = [c['text'] for c in chunks]
        vectors = model.embed_documents(texts)
    else:
        vectors = model.encode([c['text'] for c in chunks])
    return vectors


def build_faiss_index():
    docs = ingest_documents()
    model = get_embedding_model()
    vectors = embed_chunks(docs, model)
    index = faiss.IndexFlatL2(len(vectors[0]))
    index.add(np.array(vectors).astype('float32'))
    with open(META_PATH, 'wb') as f:
        pickle.dump(docs, f)
    faiss.write_index(index, INDEX_PATH)
    print(f"FAISS index built with {len(docs)} chunks.")

if __name__ == "__main__":
    build_faiss_index() 