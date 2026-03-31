from cognee.infrastructure.databases.vector.embeddings.config import EmbeddingConfig


def test_embedding_config_parses_multiple_api_keys_from_string():
    config = EmbeddingConfig(
        embedding_provider="gemini",
        embedding_api_keys=" key-one , key-two\nkey-three ",
    )

    assert config.embedding_api_keys == ("key-one", "key-two", "key-three")


def test_embedding_config_strips_quotes_from_single_api_key():
    config = EmbeddingConfig(embedding_api_key='"quoted-key"')

    assert config.embedding_api_key == "quoted-key"
