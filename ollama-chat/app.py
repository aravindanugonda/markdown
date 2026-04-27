from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import json

from config import (
    SESSION_DIR,
    MD_READER_DOCS_DIR,
    DEFAULT_MODEL,
    EXTRACTION_MODEL,
    MODEL_SHORTCUTS,
    OLLAMA_API_URL,
    OLLAMA_API_KEY,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    SECRET_KEY,
)
from chat.ollama_client import OllamaClient
from chat import session_manager, memory_manager

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB

client = OllamaClient(OLLAMA_API_URL, OLLAMA_API_KEY)


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/sessions")
def api_sessions():
    sessions = session_manager.list_sessions(SESSION_DIR)
    return jsonify({"sessions": sessions})


@app.get("/api/session/<name>")
def api_session(name):
    name = secure_filename(name)
    try:
        messages = session_manager.load_session(SESSION_DIR, name)
        return jsonify({"session": name, "messages": messages})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.delete("/api/session/<name>")
def api_delete_session(name):
    name = secure_filename(name)
    try:
        session_manager.clear_session(SESSION_DIR, name)
        return jsonify({"deleted": name})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/memory")
def api_memory():
    memory_file = request.args.get("file", "memory.json")
    memory_file = secure_filename(memory_file)

    try:
        memory = memory_manager.load_memory(SESSION_DIR, memory_file)
        return jsonify(memory)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.post("/api/memory/forget")
def api_forget_memory():
    memory_file = request.form.get("file", "memory.json")
    memory_file = secure_filename(memory_file)

    try:
        memory_manager.save_memory(SESSION_DIR, memory_file, [])
        return jsonify({"cleared": memory_file})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.post("/api/memory/update")
def api_update_memory():
    memory_file = request.form.get("file", "memory.json")
    memory_file = secure_filename(memory_file)
    facts_json = request.form.get("facts", "[]")

    try:
        facts = json.loads(facts_json)
        if not isinstance(facts, list):
            return jsonify({"error": "Facts must be an array"}), 400

        # Filter out empty strings
        facts = [str(f).strip() for f in facts if f and str(f).strip()]

        memory_manager.save_memory(SESSION_DIR, memory_file, facts)
        return jsonify({"facts": facts})
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.post("/api/chat")
def api_chat():
    try:
        prompt = request.form.get("prompt", "").strip()
        session_name = request.form.get("session", "session")
        session_name = secure_filename(session_name)
        model = request.form.get("model", DEFAULT_MODEL).strip()
        memory_file = request.form.get("memory_file", "memory.json")
        memory_file = secure_filename(memory_file)
        ignore_memory = request.form.get("ignore_memory", "false").lower() == "true"

        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400

        if not OLLAMA_API_KEY:
            return jsonify({"error": "OLLAMA_API_KEY not set"}), 500

        model = MODEL_SHORTCUTS.get(model, model)

        file_content = ""
        attachment = request.files.get("attachment")
        if attachment:
            filename = secure_filename(attachment.filename or "")
            if filename and Path(filename).suffix.lower() in ALLOWED_ATTACHMENT_EXTENSIONS:
                try:
                    file_content = attachment.read().decode('utf-8', errors='ignore')
                except Exception:
                    pass

        history = session_manager.load_session(SESSION_DIR, session_name)

        memory_context = ""
        if not ignore_memory:
            memory = memory_manager.load_memory(SESSION_DIR, memory_file)
            learned_facts = memory.get("learned_facts", [])
            if learned_facts:
                memory_context = "Previously learned about you (remember these for future responses):\n"
                memory_context += "\n".join(learned_facts)
                memory_context += "\n\n---\n"

        full_prompt = prompt
        if file_content:
            filename = attachment.filename if attachment else "attachment"
            full_prompt = f"Context from {filename}:\n{file_content}\n\n{memory_context}Question: {prompt}"
        elif memory_context:
            full_prompt = f"{memory_context}{prompt}"

        user_msg = {"role": "user", "content": full_prompt}
        messages = history + [user_msg]

        response_content = client.chat(model, messages)
        response_content = OllamaClient.strip_think_blocks(response_content)

        # Try to format JSON responses nicely
        try:
            import json as json_module
            parsed = json_module.loads(response_content)
            response_content = f"```json\n{json_module.dumps(parsed, indent=2)}\n```"
        except (json_module.JSONDecodeError, ValueError):
            # Not JSON, keep as is
            pass

        assistant_msg = {"role": "assistant", "content": response_content}
        updated_history = messages + [assistant_msg]

        session_manager.save_session(SESSION_DIR, session_name, updated_history)

        memory_updated = False
        if not ignore_memory:
            try:
                new_facts = memory_manager.extract_facts(updated_history, client, EXTRACTION_MODEL)
                if new_facts and len(new_facts) > 0:
                    memory_manager.merge_and_save(SESSION_DIR, memory_file, new_facts)
                    memory_updated = True
                    print(f"[Memory] Extracted {len(new_facts)} new facts: {new_facts[:2]}")
            except Exception as e:
                print(f"[Memory] Extraction failed: {str(e)}")
                import traceback
                traceback.print_exc()

        return jsonify({
            "content": response_content,
            "session": session_name,
            "memory_updated": memory_updated,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/export/<name>")
def api_export(name):
    name = secure_filename(name)

    try:
        messages = session_manager.load_session(SESSION_DIR, name)

        if not messages:
            return jsonify({"error": "Session not found"}), 404

        lines = ["# Conversation Export", ""]
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            content = OllamaClient.strip_think_blocks(content)
            lines.append(f"**{role.capitalize()}:** {content}")
            lines.append("")

        markdown = "\n".join(lines)

        filename = f"{name}.md"
        export_path = MD_READER_DOCS_DIR / filename

        try:
            with open(export_path, 'w', encoding='utf-8') as f:
                f.write(markdown)
        except OSError as e:
            return jsonify({"error": f"Failed to save export: {str(e)}"}), 500

        return jsonify({
            "filename": filename,
            "path": str(export_path),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)
