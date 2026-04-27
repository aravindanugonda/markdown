let currentSession = "session";
let currentMessages = [];
let isLoading = false;
let isLoadingSession = false;

let DOM = {}; // Will be initialized in DOMContentLoaded

function initializeDOM() {
    DOM = {
        sessionList: document.getElementById("sessionList"),
        newSessionInput: document.getElementById("newSessionInput"),
        newSessionBtn: document.getElementById("newSessionBtn"),
        chatArea: document.getElementById("chatArea"),
        messageInput: document.getElementById("messageInput"),
        sendBtn: document.getElementById("sendBtn"),
        modelSelect: document.getElementById("modelSelect"),
        ignoreMemoryCheckbox: document.getElementById("ignoreMemoryCheckbox"),
        attachmentInput: document.getElementById("attachmentInput"),
        attachmentName: document.getElementById("attachmentName"),
        exportBtn: document.getElementById("exportBtn"),
        forgetMemoryBtn: document.getElementById("forgetMemoryBtn"),
        memoryFacts: document.getElementById("memoryFacts"),
        currentSessionName: document.getElementById("currentSessionName"),
    };

    // Verify all elements were found
    Object.keys(DOM).forEach(key => {
        if (!DOM[key]) {
            console.warn(`[WARN] DOM element not found: ${key}`);
        }
    });
}

function openMemoryModal() {
    const modal = document.getElementById("memoryModal");
    const editor = document.getElementById("memoryEditor");
    const factsDiv = document.getElementById("memoryFacts");

    // Extract current facts from display
    const facts = Array.from(factsDiv.querySelectorAll("div")).map(div => div.textContent.trim()).filter(f => f);
    editor.value = facts.join("\n");

    modal.style.display = "flex";
}

function closeMemoryModal() {
    const modal = document.getElementById("memoryModal");
    modal.style.display = "none";
}

async function saveMemoryEdits() {
    const editor = document.getElementById("memoryEditor");
    const saveBtn = document.getElementById("saveMemoryBtn");

    const facts = editor.value.split("\n").map(f => f.trim()).filter(f => f);

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const formData = new FormData();
    formData.append("file", "memory.json");
    formData.append("facts", JSON.stringify(facts));

    try {
        const resp = await fetch("/api/memory/update", { method: "POST", body: formData });
        const data = await resp.json();

        if (resp.ok) {
            closeMemoryModal();
            loadMemory();
            showSuccess("✨ Memory updated!");
        } else {
            showError("Failed to update memory: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        console.error("Failed to update memory:", err);
        showError("Error updating memory: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    initializeDOM();

    // Update session indicator on page load
    if (DOM.currentSessionName) {
        DOM.currentSessionName.textContent = currentSession;
    }

    try {
        await loadSessionList();
        await loadSession(currentSession);
        await loadMemory();
        // console.log("[DEBUG] Initial page load complete");
    } catch (err) {
        console.error("[ERROR] Initial load failed:", err);
    }

    DOM.newSessionBtn.addEventListener("click", createNewSession);
    DOM.newSessionInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") createNewSession();
    });

    DOM.sendBtn.addEventListener("click", sendMessage);
    DOM.messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    DOM.messageInput.addEventListener("input", autoResizeTextarea);

    DOM.exportBtn.addEventListener("click", exportSession);
    DOM.forgetMemoryBtn.addEventListener("click", forgetMemory);

    const editMemoryBtn = document.getElementById("editMemoryBtn");
    if (editMemoryBtn) {
        editMemoryBtn.addEventListener("click", openMemoryModal);
    }

    DOM.attachmentInput.addEventListener("change", updateAttachmentName);

    // Close modal when clicking outside
    const modal = document.getElementById("memoryModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeMemoryModal();
        });
    }
});

function autoResizeTextarea() {
    DOM.messageInput.style.height = "44px";
    const height = Math.min(DOM.messageInput.scrollHeight, 140);
    DOM.messageInput.style.height = height + "px";
}

async function loadSessionList() {
    try {
        const resp = await fetch("/api/sessions");
        const data = await resp.json();

        DOM.sessionList.innerHTML = "";

        if (data.sessions && data.sessions.length > 0) {
            data.sessions.forEach((name) => {
                const item = document.createElement("div");
                item.className = "session-item" + (name === currentSession ? " active" : "");
                item.innerHTML = `
                    <span class="session-item-name" role="button" tabindex="0" onclick="switchSession('${name}')" onkeypress="if(event.key==='Enter')switchSession('${name}')">${escapeHtml(name)}</span>
                    <span class="session-item-delete" role="button" tabindex="0" onclick="deleteSessionConfirm('${name}')" onkeypress="if(event.key==='Enter')deleteSessionConfirm('${name}')">✕</span>
                `;
                DOM.sessionList.appendChild(item);
            });
        }
    } catch (err) {
        console.error("Failed to load sessions:", err);
    }
}

async function switchSession(name) {
    if (isLoadingSession) {
        // console.log("[DEBUG] Session switch already in progress, ignoring click");
        return;
    }

    isLoadingSession = true;
    // console.log(`[DEBUG] Switching to session: ${name}`);

    currentSession = name;
    currentMessages = [];

    if (DOM.messageInput) DOM.messageInput.value = "";
    autoResizeTextarea();
    if (DOM.attachmentName) DOM.attachmentName.textContent = "";
    if (DOM.attachmentInput) DOM.attachmentInput.value = "";

    // Update session indicator
    if (DOM.currentSessionName) {
        DOM.currentSessionName.textContent = name;
    }

    try {
        await loadSessionList();
        await loadSession(name);
        await loadMemory();
        // console.log(`[DEBUG] Session ${name} loaded successfully`);
    } catch (err) {
        console.error(`[ERROR] Failed to load session ${name}:`, err);
    } finally {
        isLoadingSession = false;
    }
}

async function loadSession(name) {
    try {
        // console.log(`[DEBUG] Loading session: ${name}`);
        const resp = await fetch(`/api/session/${name}`);

        if (!resp.ok) {
            console.error(`[DEBUG] Session load failed with status: ${resp.status}`);
            currentMessages = [];
            renderMessages();
            return;
        }

        const data = await resp.json();
        // console.log(`[DEBUG] Session data received:`, data);

        if (data.messages && Array.isArray(data.messages)) {
            currentMessages = data.messages;
            // console.log(`[DEBUG] Loaded ${currentMessages.length} messages`);
        } else {
            console.warn("[DEBUG] No messages in session or invalid format");
            currentMessages = [];
        }

        renderMessages();
    } catch (err) {
        console.error("[DEBUG] Failed to load session:", err);
        currentMessages = [];
        renderMessages();
    }
}

async function createNewSession() {
    if (isLoadingSession) {
        // console.log("[DEBUG] Session operation already in progress");
        return;
    }

    if (!DOM.newSessionInput) {
        console.error("[ERROR] newSessionInput DOM element not found");
        return;
    }

    const name = DOM.newSessionInput.value.trim();
    if (!name) {
        DOM.newSessionInput.focus();
        return;
    }

    if (name.length > 50) {
        alert("Session name too long (max 50 characters)");
        return;
    }

    isLoadingSession = true;
    // console.log(`[DEBUG] Creating new session: ${name}`);

    currentSession = name;
    currentMessages = [];
    DOM.newSessionInput.value = "";
    if (DOM.messageInput) DOM.messageInput.value = "";
    autoResizeTextarea();
    if (DOM.attachmentName) DOM.attachmentName.textContent = "";
    if (DOM.attachmentInput) DOM.attachmentInput.value = "";

    // Update session indicator
    if (DOM.currentSessionName) {
        DOM.currentSessionName.textContent = name;
    }

    try {
        await loadSessionList();
        renderMessages();
        if (DOM.messageInput) DOM.messageInput.focus();
        // console.log(`[DEBUG] New session ${name} created`);
    } finally {
        isLoadingSession = false;
    }
}

async function deleteSessionConfirm(name) {
    if (!confirm(`Delete session "${escapeHtml(name)}"?`)) return;

    try {
        const resp = await fetch(`/api/session/${name}`, { method: "DELETE" });
        if (resp.ok) {
            if (currentSession === name) {
                currentSession = "session";
                currentMessages = [];
                loadSession(currentSession);
            }
            loadSessionList();
        } else {
            alert("Failed to delete session");
        }
    } catch (err) {
        console.error("Failed to delete session:", err);
        alert("Error deleting session");
    }
}

async function loadMemory() {
    try {
        const resp = await fetch("/api/memory");
        const data = await resp.json();

        const facts = data.learned_facts || [];
        if (facts.length > 0) {
            DOM.memoryFacts.innerHTML = facts.map((f) => `<div>${escapeHtml(f)}</div>`).join("");
        } else {
            DOM.memoryFacts.innerHTML = "";
        }
    } catch (err) {
        console.error("Failed to load memory:", err);
    }
}

async function forgetMemory() {
    if (!confirm("Clear all learned facts?")) return;

    const formData = new FormData();
    formData.append("file", "memory.json");

    try {
        const resp = await fetch("/api/memory/forget", { method: "POST", body: formData });
        if (resp.ok) {
            loadMemory();
        } else {
            alert("Failed to forget memory");
        }
    } catch (err) {
        console.error("Failed to forget memory:", err);
        alert("Error forgetting memory");
    }
}

async function sendMessage() {
    const prompt = DOM.messageInput.value.trim();
    if (!prompt || isLoading) return;

    const model = DOM.modelSelect.value;
    const ignoreMemory = DOM.ignoreMemoryCheckbox.checked;

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("session", currentSession);
    formData.append("model", model);
    formData.append("memory_file", "memory.json");
    formData.append("ignore_memory", ignoreMemory);

    if (DOM.attachmentInput.files.length > 0) {
        formData.append("attachment", DOM.attachmentInput.files[0]);
    }

    isLoading = true;
    DOM.sendBtn.disabled = true;
    DOM.sendBtn.innerHTML = '<span class="loading-spinner"></span> Analyzing';
    DOM.messageInput.readOnly = true;
    DOM.messageInput.value = "";
    autoResizeTextarea();
    DOM.attachmentName.textContent = "";
    DOM.attachmentInput.value = "";

    // Add user message immediately
    currentMessages.push({ role: "user", content: prompt });
    // Add thinking placeholder
    currentMessages.push({ role: "thinking", content: "Analyzing your question..." });
    renderMessages();

    try {
        const resp = await fetch("/api/chat", { method: "POST", body: formData });
        const data = await resp.json();

        // Remove thinking message
        currentMessages.pop();

        if (resp.ok && data.content) {
            currentMessages.push({ role: "assistant", content: data.content });
            renderMessages();

            if (data.memory_updated) {
                loadMemory();
                showSuccess("✨ New memory fact learned!");
            } else {
                // Still load memory in case it was updated
                setTimeout(() => {
                    loadMemory();
                }, 500);
            }
        } else {
            showError("Error: " + (data.error || "Unknown error"));
            console.error("API error:", data);
        }
    } catch (err) {
        // Remove thinking message on error
        currentMessages.pop();
        renderMessages();

        console.error("Failed to send message:", err);
        showError("Network error: " + err.message);
    } finally {
        isLoading = false;
        DOM.sendBtn.disabled = false;
        DOM.sendBtn.innerHTML = "Send";
        DOM.messageInput.readOnly = false;
        DOM.messageInput.focus();
    }
}

async function exportSession() {
    if (currentMessages.length === 0) {
        showError("No messages to export");
        return;
    }

    DOM.exportBtn.disabled = true;
    DOM.exportBtn.innerHTML = "📤 Exporting…";

    try {
        const resp = await fetch(`/api/export/${currentSession}`, { method: "POST" });
        const data = await resp.json();

        if (resp.ok && data.filename) {
            showSuccess(`Exported to: ${data.filename}`);
        } else {
            showError("Export failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        console.error("Export failed:", err);
        showError("Error exporting: " + err.message);
    } finally {
        DOM.exportBtn.disabled = false;
        DOM.exportBtn.innerHTML = "📤 Export";
    }
}

async function renderMessages() {
    DOM.chatArea.innerHTML = "";

    if (currentMessages.length === 0) {
        DOM.chatArea.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">Start a conversation or load an existing session</div>
            </div>
        `;
        return;
    }

    for (const msg of currentMessages) {
        const div = document.createElement("div");
        div.className = `message ${msg.role}`;

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        if (msg.role === "thinking") {
            bubble.className = "message-bubble thinking-bubble";
            bubble.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span> ' + escapeHtml(msg.content);
        } else if (msg.role === "assistant") {
            try {
                // Clean and format the response
                let content = msg.content.trim();

                // Format lists properly
                content = content.replace(/^[-•]\s+/gm, '• ');
                content = content.replace(/^(\d+)\.\s+/gm, '$1. ');

                // Ensure code blocks are properly formatted
                const codeBlockRegex = /```[\s\S]*?```/g;
                const codeBlocks = content.match(codeBlockRegex) || [];

                // Parse markdown
                const html = await marked.parse(content);
                bubble.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;

                // Highlight code blocks
                bubble.querySelectorAll('pre code').forEach((block) => {
                    try {
                        hljs.highlightElement(block);
                    } catch (e) {
                        // If language not detected, just leave as is
                    }
                });
            } catch (e) {
                console.error("Error rendering markdown:", e);
                // Fallback: render as preformatted text
                bubble.innerHTML = `<pre>${escapeHtml(msg.content)}</pre>`;
            }
        } else {
            bubble.textContent = msg.content;
        }

        div.appendChild(bubble);
        DOM.chatArea.appendChild(div);
    }

    setTimeout(() => {
        DOM.chatArea.scrollTop = DOM.chatArea.scrollHeight;
    }, 0);
}

function updateAttachmentName() {
    if (DOM.attachmentInput.files.length > 0) {
        const name = DOM.attachmentInput.files[0].name;
        const size = (DOM.attachmentInput.files[0].size / 1024).toFixed(1);
        DOM.attachmentName.textContent = `📎 ${name} (${size}KB)`;
    } else {
        DOM.attachmentName.textContent = "";
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatJsonResponse(text) {
    try {
        // Try to parse as JSON
        const json = JSON.parse(text);
        return JSON.stringify(json, null, 2);
    } catch (e) {
        // If not valid JSON, return as is
        return text;
    }
}

function showSuccess(message) {
    const notification = document.createElement("div");
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease-in-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}

function showError(message) {
    const notification = document.createElement("div");
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease-in-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}
