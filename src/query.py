import os
import pickle
import numpy as np
from langchain_openai.embeddings import OpenAIEmbeddings
from sentence_transformers import SentenceTransformer
import faiss

INDEX_PATH = os.path.join(os.path.dirname(__file__), 'faiss.index')
META_PATH = os.path.join(os.path.dirname(__file__), 'faiss_meta.pkl')


def get_embedding_model():
    try:
        return OpenAIEmbeddings()
    except Exception:
        return SentenceTransformer('all-MiniLM-L6-v2')


def embed_query(query, model):
    if isinstance(model, OpenAIEmbeddings):
        return np.array(model.embed_query(query)).reshape(1, -1)
    else:
        return np.array(model.encode([query]))


def search_faiss(query, top_k=5):
    model = get_embedding_model()
    qvec = embed_query(query, model)
    index = faiss.read_index(INDEX_PATH)
    with open(META_PATH, 'rb') as f:
        meta = pickle.load(f)
    D, I = index.search(qvec, top_k)
    results = [meta[i] for i in I[0]]
    return results

if __name__ == "__main__":
    q = "46-year-old male, knee surgery in Pune, 3-month-old insurance policy"
    results = search_faiss(q)
    for r in results:
        print(f"Source: {r['source']} | Chunk: {r['chunk_id']}\n{r['text'][:200]}\n---") 