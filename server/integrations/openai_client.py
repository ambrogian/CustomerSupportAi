"""
Fastino (Pioneer AI) LLM client — uses Qwen3-32B via REST API.
Simple requests-based client, no special SDK needed.
"""
import os
import json
import time
import requests

FASTINO_URL = "https://api.pioneer.ai/inference"
MODEL_ID = os.getenv("FASTINO_MODEL", "base:Qwen/Qwen3-32B")


def _get_api_key():
    key = os.getenv("FASTINO_API_KEY")
    if not key:
        raise RuntimeError("FASTINO_API_KEY must be set in .env")
    return key


def call_llm(system_prompt: str, user_message: str, max_retries: int = 3) -> dict:
    """
    Call Fastino API with a system prompt and user message.
    Expects the model to return valid JSON matching the orchestrator schema.
    Includes retry logic for transient errors.
    Returns parsed dict.
    """
    api_key = _get_api_key()

    payload = {
        "model_id": MODEL_ID,
        "task": "generate",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 2000,
    }

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(FASTINO_URL, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()

            data = resp.json()

            # Extract the assistant message content from the response
            # Pioneer AI typically returns in OpenAI-compatible format
            raw_text = _extract_content(data)

            # Parse JSON from the response
            # The model might wrap JSON in markdown code blocks, so handle that
            cleaned = _clean_json_response(raw_text)

            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                return {
                    "action": "send_message",
                    "message": raw_text,
                    "creditAmount": 0,
                    "requiresHumanReview": False,
                    "reasoning": "LLM response was not valid JSON; returning raw text.",
                }

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else 0
            if status == 429 and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"[Fastino] Rate limited (429), retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                raise
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"[Fastino] Request error, retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                raise


def _extract_content(response_data: dict) -> str:
    """Extract the text content from the Fastino API response."""
    # Fastino returns the generated text in a 'completion' field
    if "completion" in response_data:
        return response_data["completion"]

    # Handle OpenAI-compatible format
    if "choices" in response_data:
        choices = response_data["choices"]
        if choices and "message" in choices[0]:
            return choices[0]["message"].get("content", "")
        if choices and "text" in choices[0]:
            return choices[0]["text"]

    # Handle direct content field
    if "content" in response_data:
        return response_data["content"]

    # Handle output field
    if "output" in response_data:
        return response_data["output"]

    # Fallback: return the whole thing as string
    return json.dumps(response_data)


def _clean_json_response(text: str) -> str:
    """
    Clean up LLM response to extract JSON.
    Models sometimes wrap JSON in ```json ... ``` blocks.
    """
    text = text.strip()

    # Remove markdown code block wrappers
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    # Handle thinking tags (Qwen3 may include <think>...</think>)
    if "<think>" in text:
        # Extract content after </think>
        think_end = text.find("</think>")
        if think_end != -1:
            text = text[think_end + 8:]

    return text.strip()
