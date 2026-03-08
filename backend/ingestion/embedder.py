# Voyage AI embedding pipeline — voyage-4, dim=1024

import logging
import os
import threading
from typing import Optional

import voyageai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_client: Optional[voyageai.Client] = None
_client_lock: threading.Lock = threading.Lock()
_VOYAGE_MODEL: str = os.getenv("VOYAGE_MODEL", "voyage-4")


def _get_client() -> voyageai.Client:
    """Thread-safe lazy Voyage AI client initialisation."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:  # double-checked locking
                api_key = os.getenv("VOYAGE_API_KEY")
                if not api_key:
                    raise RuntimeError("VOYAGE_API_KEY is not set in environment")
                _client = voyageai.Client(api_key=api_key)
                logger.info("Voyage AI client initialised")
    return _client


def embed_texts(
    texts: list[str],
    input_type: Optional[str] = None,
) -> list[list[float]]:
    """
    Batch embed a list of texts using Voyage AI voyage-4 model.
    Returns a list of 1024-dimensional float vectors.
    Preserves input order.

    Args:
        texts: Texts to embed.
        input_type: Optional. Use 'document' when embedding stored content,
            'query' when embedding a search query. Improves retrieval accuracy.
    """
    if not texts:
        return []

    client = _get_client()
    # Voyage AI accepts up to 128 texts per call; we cap at 50 for safety
    batch_size = 50
    all_embeddings: list[list[float]] = []

    kwargs = {}
    if input_type is not None:
        kwargs["input_type"] = input_type

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        result = client.embed(batch, model=_VOYAGE_MODEL, **kwargs)
        all_embeddings.extend(result.embeddings)
        logger.debug(f"Embedded batch {i // batch_size + 1}: {len(batch)} texts")

    logger.info(
        f"Embedded {len(texts)} texts with Voyage AI {_VOYAGE_MODEL} (dim=1024, input_type={input_type!r})"
    )
    return all_embeddings


def embed_single(text: str, input_type: Optional[str] = None) -> list[float]:
    """Embed a single text and return its 1024-dim vector."""
    return embed_texts([text], input_type=input_type)[0]
