const viewerEl = document.getElementById('viewer');
const viewerHeaderEl = document.getElementById('viewerHeader');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const uploadBtn = document.getElementById('uploadBtn');
const uploadInput = document.getElementById('uploadInput');
const themeToggle = document.getElementById('themeToggle');

window.loadMarkdown = async function loadMarkdown(path) {
  const response = await fetch(`/api/view?path=${encodeURIComponent(path)}`);
  const data = await response.json();
  viewerEl.innerHTML = data.html || `<p>${data.error || 'Failed to render file'}</p>`;
  attachCopyButtons();
};

function attachCopyButtons() {
  document.querySelectorAll('#viewer pre code').forEach((codeEl) => {
    const pre = codeEl.closest('pre');
    if (!pre || pre.dataset.copyReady === 'true') return;
    pre.dataset.copyReady = 'true';

    const button = document.createElement('button');
    button.className = 'copy-btn';
    button.type = 'button';
    button.textContent = 'Copy';
    button.addEventListener('click', () => {
      const source = codeEl.textContent || '';
      navigator.clipboard.writeText(source).then(() => {
        button.textContent = 'Copied';
        setTimeout(() => (button.textContent = 'Copy'), 1000);
      });
    });
    pre.appendChild(button);
  });
}

uploadBtn?.addEventListener('click', () => uploadInput?.click());

uploadInput?.addEventListener('change', async () => {
  const files = Array.from(uploadInput.files || []);
  if (!files.length) return;

  const formData = new FormData();
  for (const file of files) formData.append('files', file);

  const currentPath = typeof window.getCurrentTreePath === 'function' ? window.getCurrentTreePath() : '';
  if (currentPath) formData.append('path', currentPath);

  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await response.json();
  uploadInput.value = '';

  if (!response.ok) {
    alert(data.error || 'Upload failed');
    return;
  }

  if (typeof window.refreshTree === 'function') await window.refreshTree();
  const [firstUploaded] = data.uploaded || [];
  if (firstUploaded) {
    viewerHeaderEl.textContent = firstUploaded;
    await window.loadMarkdown(firstUploaded);
  }
});

let debounce;
searchInput?.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(runSearch, 150);
});

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.innerHTML = '';
    return;
  }
  const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const data = await response.json();
  searchResults.innerHTML = '';
  for (const result of data.results) {
    const el = document.createElement('div');
    el.className = 'search-item';
    el.innerHTML = `<strong>${result.filename}</strong><br><small>${result.path}</small><br>${result.snippet}`;
    el.addEventListener('click', () => window.loadMarkdown(result.path));
    searchResults.appendChild(el);
  }
}

themeToggle?.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.dataset.theme = saved;
})();
