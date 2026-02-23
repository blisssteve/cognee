import base64
import litellm
import logging
import instructor
from typing import Type
from openai import OpenAI
from pydantic import BaseModel

from cognee.infrastructure.llm.structured_output_framework.litellm_instructor.llm.llm_interface import (
    LLMInterface,
)
from cognee.infrastructure.files.utils.open_data_file import open_data_file
from cognee.shared.logging_utils import get_logger
from cognee.shared.rate_limiting import llm_rate_limiter_context_manager
from tenacity import (
    retry,
    stop_after_delay,
    wait_exponential_jitter,
    retry_if_not_exception_type,
    before_sleep_log,
)

logger = get_logger()


class OllamaAPIAdapter(LLMInterface):
    """
    Adapter for a Generic API LLM provider using instructor with an OpenAI backend.

    Public methods:

    - acreate_structured_output
    - create_transcript
    - transcribe_image

    Instance variables:

    - name
    - model
    - api_key
    - endpoint
    - max_completion_tokens
    - aclient
    """

    default_instructor_mode = "json_mode"

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        model: str,
        name: str,
        max_completion_tokens: int,
        instructor_mode: str = None,
        vision_model: str = None,
        vision_endpoint: str = None,
        vision_api_key: str = None,
    ):
        self.name = name
        self.model = model
        self.api_key = api_key
        self.endpoint = endpoint
        self.max_completion_tokens = max_completion_tokens
        self.vision_model = vision_model if vision_model else model
        self.vision_endpoint = vision_endpoint if vision_endpoint else endpoint
        self.vision_api_key = vision_api_key if vision_api_key else api_key

        self.instructor_mode = instructor_mode if instructor_mode else self.default_instructor_mode

        self.aclient = instructor.from_openai(
            OpenAI(base_url=self.endpoint, api_key=self.api_key),
            mode=instructor.Mode(self.instructor_mode),
        )

    @retry(
        stop=stop_after_delay(128),
        wait=wait_exponential_jitter(8, 128),
        retry=retry_if_not_exception_type(litellm.exceptions.NotFoundError),
        before_sleep=before_sleep_log(logger, logging.DEBUG),
        reraise=True,
    )
    async def acreate_structured_output(
        self, text_input: str, system_prompt: str, response_model: Type[BaseModel], **kwargs
    ) -> BaseModel:
        """
        Generate a structured output from the LLM using the provided text and system prompt.

        This asynchronous method sends a request to the API with the user's input and the system
        prompt, and returns a structured response based on the specified model.

        Parameters:
        -----------

            - text_input (str): The input text provided by the user.
            - system_prompt (str): The system prompt that guides the response generation.
            - response_model (Type[BaseModel]): The model type that the response should conform
              to.

        Returns:
        --------

            - BaseModel: A structured output that conforms to the specified response model.
        """
        async with llm_rate_limiter_context_manager():
            response = self.aclient.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": f"{text_input}",
                    },
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                ],
                max_retries=2,
                response_model=response_model,
            )

        return response

    @retry(
        stop=stop_after_delay(128),
        wait=wait_exponential_jitter(8, 128),
        retry=retry_if_not_exception_type(litellm.exceptions.NotFoundError),
        before_sleep=before_sleep_log(logger, logging.DEBUG),
        reraise=True,
    )
    async def create_transcript(self, input: str, **kwargs) -> str:
        """
        Generate an audio transcript from a user query.

        This synchronous method takes an input audio file and returns its transcription. Raises
        a FileNotFoundError if the input file does not exist, and raises a ValueError if
        transcription fails or returns no text.

        Parameters:
        -----------

            - input (str): The path to the audio file to be transcribed.

        Returns:
        --------

            - str: The transcription of the audio as a string.
        """

        async with open_data_file(input, mode="rb") as audio_file:
            transcription = self.aclient.audio.transcriptions.create(
                model="whisper-1",  # Ensure the correct model for transcription
                file=audio_file,
                language="en",
            )

        # Ensure the response contains a valid transcript
        if not hasattr(transcription, "text"):
            raise ValueError("Transcription failed. No text returned.")

        return transcription.text

    @retry(
        stop=stop_after_delay(128),
        wait=wait_exponential_jitter(2, 128),
        retry=retry_if_not_exception_type(litellm.exceptions.NotFoundError),
        before_sleep=before_sleep_log(logger, logging.DEBUG),
        reraise=True,
    )
    async def transcribe_image(self, input: str, **kwargs) -> str:
        """
        Transcribe content from an image using base64 encoding.

        When a separate vision model is configured (e.g. on OpenRouter), this method
        routes through litellm to the external vision API instead of local Ollama.
        Falls back to local Ollama if no separate vision model is set.

        Parameters:
        -----------

            - input (str): The path to the image file to be transcribed.

        Returns:
        --------

            - str: The transcription of the image's content as a string.
        """

        async with open_data_file(input, mode="rb") as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

        # Use litellm for external vision model (e.g. OpenRouter)
        # This avoids calling local Ollama for vision when a separate vision API is configured
        async with llm_rate_limiter_context_manager():
            response = await litellm.acompletion(
                model=self.vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "What's in this image?"},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{encoded_image}"},
                            },
                        ],
                    }
                ],
                api_key=self.vision_api_key,
                api_base=self.vision_endpoint,
                max_tokens=300,
                **kwargs,
            )

        return response.choices[0].message.content
