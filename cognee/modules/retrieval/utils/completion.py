import os
from typing import Optional, Type, Any
from cognee.infrastructure.llm.LLMGateway import LLMGateway
from cognee.infrastructure.llm.prompts import render_prompt, read_query_prompt


def _get_search_llm_override():
    """Get search-specific LLM configuration override if set."""
    search_model = os.environ.get("SEARCH_LLM_MODEL")
    search_endpoint = os.environ.get("SEARCH_LLM_ENDPOINT")
    search_api_key = os.environ.get("SEARCH_LLM_API_KEY")

    if search_model and search_endpoint and search_api_key:
        return {
            "model": search_model,
            "endpoint": search_endpoint,
            "api_key": search_api_key,
        }
    return None


async def _generate_completion_with_override(
    text_input: str,
    system_prompt: str,
    response_model: Type,
    override_config: dict,
) -> Any:
    """Generate completion using a custom LLM configuration (bypasses BAML cache)."""
    try:
        from baml_py import ClientRegistry
        from cognee.infrastructure.llm.structured_output_framework.baml.baml_client import b
        from cognee.infrastructure.llm.structured_output_framework.baml.baml_src.extraction.create_dynamic_baml_type import (
            create_dynamic_baml_type,
        )
        from cognee.infrastructure.llm.structured_output_framework.baml.baml_client.type_builder import (
            TypeBuilder,
        )

        # Create a custom client registry for search
        registry = ClientRegistry()
        registry.add_llm_client(
            name="search_client",
            provider="openai",
            options={
                "model": override_config["model"],
                "base_url": override_config["endpoint"],
                "api_key": override_config["api_key"],
            },
        )
        registry.set_primary("search_client")

        # Create dynamic type for response
        tb = TypeBuilder()
        type_builder = create_dynamic_baml_type(tb, tb.ResponseModel, response_model)

        result = await b.AcreateStructuredOutput(
            text_input=text_input,
            system_prompt=system_prompt,
            baml_options={"client_registry": registry, "tb": type_builder},
        )

        if response_model is str:
            return str(result.text)
        return response_model.model_validate(result.dict())
    except Exception as e:
        # Fall back to default on error
        import logging
        logging.getLogger(__name__).warning(f"Search LLM override failed, using default: {e}")
        return await LLMGateway.acreate_structured_output(
            text_input=text_input,
            system_prompt=system_prompt,
            response_model=response_model,
        )


async def generate_completion(
    query: str,
    context: str,
    user_prompt_path: str,
    system_prompt_path: str,
    system_prompt: Optional[str] = None,
    conversation_history: Optional[str] = None,
    response_model: Type = str,
) -> Any:
    """Generates a completion using LLM with given context and prompts."""
    args = {"question": query, "context": context}
    user_prompt = render_prompt(user_prompt_path, args)
    system_prompt = system_prompt if system_prompt else read_query_prompt(system_prompt_path)

    if conversation_history:
        #:TODO: I would separate the history and put it into the system prompt but we have to test what works best with longer convos
        system_prompt = conversation_history + "\nTASK:" + system_prompt

    # Check for search-specific LLM override
    override_config = _get_search_llm_override()
    if override_config:
        return await _generate_completion_with_override(
            text_input=user_prompt,
            system_prompt=system_prompt,
            response_model=response_model,
            override_config=override_config,
        )

    return await LLMGateway.acreate_structured_output(
        text_input=user_prompt,
        system_prompt=system_prompt,
        response_model=response_model,
    )


async def summarize_text(
    text: str,
    system_prompt_path: str = "summarize_search_results.txt",
    system_prompt: str = None,
) -> str:
    """Summarizes text using LLM with the specified prompt."""
    system_prompt = system_prompt if system_prompt else read_query_prompt(system_prompt_path)

    return await LLMGateway.acreate_structured_output(
        text_input=text,
        system_prompt=system_prompt,
        response_model=str,
    )
