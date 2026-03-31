from cognee.infrastructure.databases.vector.embeddings.LiteLLMEmbeddingEngine import (
    LiteLLMEmbeddingEngine,
)


def test_litellm_embedding_engine_rotates_api_keys_round_robin():
    engine = LiteLLMEmbeddingEngine(
        provider="gemini",
        model="gemini/gemini-embedding-001",
        dimensions=768,
        api_keys=("key-one", "key-two", "key-three"),
    )

    assert engine._get_api_key() == "key-one"
    assert engine._get_api_key() == "key-two"
    assert engine._get_api_key() == "key-three"
    assert engine._get_api_key() == "key-one"


def test_litellm_embedding_engine_uses_single_api_key_when_no_pool_configured():
    engine = LiteLLMEmbeddingEngine(
        provider="gemini",
        model="gemini/gemini-embedding-001",
        dimensions=768,
        api_key="single-key",
    )

    assert engine._get_api_key() == "single-key"
