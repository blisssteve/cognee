import asyncio
import os
from typing import Any, List, Optional, Tuple, Type
from cognee.infrastructure.llm.LLMGateway import LLMGateway
from cognee.infrastructure.llm.prompts import render_prompt, read_query_prompt
from cognee.modules.observability import new_span, COGNEE_RESULT_SUMMARY


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

    with new_span("cognee.llm.completion") as span:
        span.set_attribute("cognee.llm.prompt_path", system_prompt_path)
        span.set_attribute("cognee.llm.context_length", len(context))
        span.set_attribute("cognee.llm.query_length", len(query))
        result = await LLMGateway.acreate_structured_output(
            text_input=user_prompt,
            system_prompt=system_prompt,
            response_model=response_model,
        )
        if isinstance(result, str):
            span.set_attribute("cognee.llm.response_length", len(result))
        span.set_attribute(COGNEE_RESULT_SUMMARY, "LLM completion generated")
        return result


async def generate_completion_batch(
    query_batch: List[str],
    context: List[str],
    user_prompt_path: str,
    system_prompt_path: str,
    system_prompt: Optional[str] = None,
    conversation_history: Optional[str] = "",
    response_model: Type = str,
) -> List[Any]:
    """Generates completions for a batch of queries in parallel."""
    return await asyncio.gather(
        *[
            generate_completion(
                query=q,
                context=c,
                user_prompt_path=user_prompt_path,
                system_prompt_path=system_prompt_path,
                system_prompt=system_prompt,
                conversation_history=conversation_history,
                response_model=response_model,
            )
            for q, c in zip(query_batch, context)
        ]
    )


async def generate_session_completion_with_optional_summary(
    *,
    query: str,
    context: str,
    conversation_history: str,
    user_prompt_path: str,
    system_prompt_path: str,
    system_prompt: Optional[str] = None,
    response_model: Type = str,
    summarize_context: bool = False,
    run_feedback_detection: bool = False,
) -> Tuple[Any, str, Any]:
    """
    Run LLM completion (and optionally summarization) for the session-manager flow.
    Returns (completion, context_to_store, feedback_result).
    When summarize_context is True, context_to_store is the summarized context; otherwise "".
    When run_feedback_detection is True, runs feedback detection in parallel; feedback_result
    is the detection result, otherwise None.
    """
    from cognee.infrastructure.session.feedback_detection import detect_feedback

    if summarize_context:
        if run_feedback_detection:
            context_summary, completion, feedback_result = await asyncio.gather(
                summarize_text(context),
                generate_completion(
                    query=query,
                    context=context,
                    user_prompt_path=user_prompt_path,
                    system_prompt_path=system_prompt_path,
                    system_prompt=system_prompt,
                    conversation_history=conversation_history,
                    response_model=response_model,
                ),
                detect_feedback(query),
            )
            return (completion, context_summary, feedback_result)
        context_summary, completion = await asyncio.gather(
            summarize_text(context),
            generate_completion(
                query=query,
                context=context,
                user_prompt_path=user_prompt_path,
                system_prompt_path=system_prompt_path,
                system_prompt=system_prompt,
                conversation_history=conversation_history,
                response_model=response_model,
            ),
        )
        return (completion, context_summary, None)

    if run_feedback_detection:
        completion, feedback_result = await asyncio.gather(
            generate_completion(
                query=query,
                context=context,
                user_prompt_path=user_prompt_path,
                system_prompt_path=system_prompt_path,
                system_prompt=system_prompt,
                conversation_history=conversation_history,
                response_model=response_model,
            ),
            detect_feedback(query),
        )
        return (completion, "", feedback_result)
    completion = await generate_completion(
        query=query,
        context=context,
        user_prompt_path=user_prompt_path,
        system_prompt_path=system_prompt_path,
        system_prompt=system_prompt,
        conversation_history=conversation_history,
        response_model=response_model,
    )
    return (completion, "", None)


async def batch_llm_completion(
    user_prompts: List[str],
    system_prompt: str,
    response_model: Type = str,
) -> List[Any]:
    """Run a batch of pre-built prompts through the LLM in parallel."""
    return list(
        await asyncio.gather(
            *[
                LLMGateway.acreate_structured_output(
                    text_input=prompt, system_prompt=system_prompt, response_model=response_model
                )
                for prompt in user_prompts
            ]
        )
    )


async def summarize_text(
    text: str,
    system_prompt_path: str = "summarize_search_results.txt",
    system_prompt: str = None,
) -> str:
    """Summarizes text using LLM with the specified prompt."""
    system_prompt = system_prompt if system_prompt else read_query_prompt(system_prompt_path)

    with new_span("cognee.llm.summarize") as span:
        span.set_attribute("cognee.llm.input_length", len(text))
        result = await LLMGateway.acreate_structured_output(
            text_input=text,
            system_prompt=system_prompt,
            response_model=str,
        )
        if isinstance(result, str):
            span.set_attribute("cognee.llm.response_length", len(result))
        span.set_attribute(COGNEE_RESULT_SUMMARY, "Text summarized")
        return result
