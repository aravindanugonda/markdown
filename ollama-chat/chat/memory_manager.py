import json
from pathlib import Path
from datetime import datetime
import re
from .ollama_client import OllamaClient


def load_memory(session_dir: Path, filename: str) -> dict:
    memory_file = session_dir / filename

    if not memory_file.exists():
        return {"learned_facts": [], "last_updated": ""}

    try:
        with open(memory_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {"learned_facts": [], "last_updated": ""}


def save_memory(session_dir: Path, filename: str, facts: list[str]) -> None:
    memory_file = session_dir / filename
    temp_file = session_dir / f"{filename}.tmp"

    data = {
        "learned_facts": facts,
        "last_updated": datetime.now().isoformat(),
    }

    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        temp_file.replace(memory_file)
    except IOError as e:
        raise Exception(f"Failed to save memory: {str(e)}")


def extract_facts(messages: list[dict], client: OllamaClient, extraction_model: str) -> list[str]:
    if len(messages) < 2:
        return []

    last_10 = messages[-10:]
    conversation_text = "\n".join([f"{m['role'].upper()}: {m['content'][:150]}" for m in last_10])

    extraction_prompt = f"""Extract facts about the user from this conversation. Return ONLY a JSON array of strings.

Examples of good facts:
- "User is a Python developer with 5 years experience"
- "User works with Flask and REST APIs"
- "User is interested in learning Kubernetes"
- "User prefers async programming"

Conversation:
{conversation_text}

Return ONLY a JSON array, nothing else. Even if there are no new facts, still return [].
Response:"""

    extraction_messages = [{"role": "user", "content": extraction_prompt}]

    try:
        raw_extracted = client.chat(extraction_model, extraction_messages)

        if not raw_extracted or not raw_extracted.strip():
            return []

        clean_extracted = raw_extracted.strip()

        # Remove think blocks
        clean_extracted = re.sub(r'<think>.*?</think>', '', clean_extracted, flags=re.DOTALL).strip()

        # Remove markdown code fences (including json language specifier)
        clean_extracted = re.sub(r'^```json\s*\n?', '', clean_extracted).strip()
        clean_extracted = re.sub(r'^```\s*\n?', '', clean_extracted).strip()
        clean_extracted = re.sub(r'\n?```\s*$', '', clean_extracted).strip()

        # Find JSON array in response (most reliable method)
        json_match = re.search(r'\[.*?\]', clean_extracted, re.DOTALL)
        if json_match:
            clean_extracted = json_match.group(0).strip()

        if not clean_extracted or clean_extracted == '[]':
            return []

        facts = json.loads(clean_extracted)
        if isinstance(facts, list):
            # Filter out empty strings and duplicates
            return [str(f).strip() for f in facts if f and str(f).strip()]
        return []
    except json.JSONDecodeError as e:
        print(f"[Memory] JSON parse error: {e}, got: {clean_extracted[:100]}")
        return []
    except Exception as e:
        print(f"[Memory] Extraction error: {e}")
        return []


def merge_and_save(session_dir: Path, filename: str, new_facts: list[str]) -> None:
    memory = load_memory(session_dir, filename)
    current_facts = memory.get("learned_facts", [])

    merged = list(dict.fromkeys(current_facts + new_facts))

    save_memory(session_dir, filename, merged)
