"""
Service for detecting plagiarism using Google Custom Search API and TF-IDF similarity.
Also cross-checks against an optional internal corpus.
"""

import os
import string
import logging
import httpx
from typing import Optional, List, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

async def check_plagiarism(report_text: str, corpus: Optional[List[str]] = None) -> Tuple[float, str]:
    """
    Checks the report text for plagiarism using Google Search snippets and similarity against a local corpus.
    
    Args:
        report_text: The student's submitted text.
        corpus: Optional list of previous report texts to cross-check.
        
    Returns:
        A tuple of (max_score, details_message).
    """
    try:
        # Step 1: Preprocessing
        text_lower = report_text.lower()
        # Strip punctuation
        translator = str.maketrans('', '', string.punctuation)
        text_clean = text_lower.translate(translator)
        words = text_clean.split()
        
        if not words:
            return 0.0, "Empty text provided."
            
        # Step 2: Chunking (window of 60, overlap 20 -> stride 40)
        chunks = []
        window_size = 60
        stride = 40
        for i in range(0, len(words), stride):
            chunk_words = words[i:i + window_size]
            chunks.append(" ".join(chunk_words))
            if i + window_size >= len(words):
                break
                
        # Select up to 5 evenly spaced chunks
        if len(chunks) > 5:
            step = len(chunks) / 5
            selected_chunks = [chunks[int(i * step)] for i in range(5)]
        else:
            selected_chunks = chunks
            
        # Step 3: Web search for each chunk
        api_key = os.getenv("GOOGLE_CSE_API_KEY")
        cx = os.getenv("GOOGLE_CSE_ID")
        snippets = []
        
        if not api_key or not cx:
            logger.warning("GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID missing. Skipping web search.")
        else:
            async with httpx.AsyncClient(timeout=8.0) as client:
                for chunk in selected_chunks:
                    try:
                        url = "https://www.googleapis.com/customsearch/v1"
                        params = {
                            "key": api_key,
                            "cx": cx,
                            "q": f'"{chunk}"',
                            "num": 5
                        }
                        response = await client.get(url, params=params)
                        if response.status_code == 200:
                            data = response.json()
                            items = data.get("items", [])
                            for item in items:
                                snippet = item.get("snippet", "")
                                if snippet:
                                    snippets.append(snippet)
                        else:
                            logger.error(f"Search API error status: {response.status_code}")
                    except Exception as e:
                        logger.error(f"Error calling Search API: {e}")
                        # Never crash on API failure
                        
        # Step 4: TF-IDF Cosine Similarity for web snippets
        max_score = 0.0
        
        if snippets:
            try:
                vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
                # Group all chunk vs snippets logic
                for chunk in selected_chunks:
                    docs = [chunk] + snippets
                    tfidf_matrix = vectorizer.fit_transform(docs)
                    sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
                    if len(sims) > 0:
                        chunk_max = float(max(sims))
                        if chunk_max > max_score:
                            max_score = chunk_max
            except ValueError as ve:
                logger.warning(f"Vectorizer error (possibly due to empty/stop-words): {ve}")
            except Exception as e:
                logger.error(f"Error computing web similarity: {e}")
                
        # Step 5: Internal corpus cross-check
        corpus_max_score = 0.0
        if corpus and len(corpus) > 0:
            try:
                vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
                docs = [report_text] + corpus
                tfidf_matrix = vectorizer.fit_transform(docs)
                sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
                if len(sims) > 0:
                    corpus_max_score = float(max(sims))
                    if corpus_max_score > max_score:
                        max_score = corpus_max_score
            except ValueError as ve:
                logger.warning(f"Corpus vectorizer error: {ve}")
            except Exception as e:
                logger.error(f"Error computing corpus similarity: {e}")
                
        # Step 6: Return
        details_msg = f"Similarity Score: {max_score:.2f} (Web max, Corpus max)."
        
        return max_score, details_msg

    except Exception as e:
        logger.error(f"Unhandled exception in check_plagiarism: {e}")
        return 0.0, f"Error running plagiarism check: {str(e)}"
