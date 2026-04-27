import re
import requests
import json


class OllamaClient:
    def __init__(self, api_url, api_key):
        self.api_url = api_url
        self.api_key = api_key

    def chat(self, model: str, messages: list[dict]) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }

        try:
            response = requests.post(self.api_url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()

            data = response.json()
            content = data.get("message", {}).get("content", "")

            if not content:
                raise ValueError("No content in API response")

            return content
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API request failed: {str(e)}")
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse Ollama response: {str(e)}")

    @staticmethod
    def strip_think_blocks(text: str) -> str:
        return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
