const treeEl = document.getElementById('tree');
const viewerHeader = document.getElementById('viewerHeader');
let currentTreePath = '';

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (response.status === 404 && text.toLowerCase().includes('<!doctype')) {
    return { error: 'Delete API not found. Restart the Flask server and try again.' };
  }
  return { error: text || `Request failed (${response.status})` };
}

async function fetchList(path = '') {
  const response = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
  return response.json();
}

async function loadTree(path = '', container = treeEl) {
  const data = await fetchList(path);
  container.innerHTML = '';

  for (const item of data.files) {
    const fullPath = [path, item.name].filter(Boolean).join('/');

    if (item.type === 'directory') {
      const itemEl = document.createElement('div');
      itemEl.className = 'tree-item tree-folder';
      itemEl.textContent = `📁 ${item.name}`;
      const nested = document.createElement('div');
      nested.className = 'nested';
      let expanded = false;
      itemEl.addEventListener('click', async () => {
        expanded = !expanded;
        currentTreePath = fullPath;
        if (expanded) {
          await loadTree(fullPath, nested);
          nested.style.display = 'block';
        } else {
          nested.style.display = 'none';
        }
      });
      container.append(itemEl, nested);
    } else {
      const rowEl = document.createElement('div');
      rowEl.className = 'tree-row';

      const itemEl = document.createElement('div');
      itemEl.className = 'tree-item';
      itemEl.textContent = `📄 ${item.name}`;
      itemEl.addEventListener('click', () => {
        currentTreePath = path;
        viewerHeader.textContent = fullPath;
        window.loadMarkdown(fullPath);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'file-delete-btn';
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9Z"/></svg>';
      deleteBtn.title = `Delete ${item.name}`;
      deleteBtn.setAttribute('aria-label', `Delete ${item.name}`);
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const confirmed = window.confirm(`Delete "${item.name}"?`);
        if (!confirmed) return;

        const response = await fetch(`/api/file?path=${encodeURIComponent(fullPath)}`, {
          method: 'DELETE',
        });
        const result = await parseApiResponse(response);
        if (!response.ok) {
          alert(result.error || 'Delete failed');
          return;
        }

        if (viewerHeader.textContent === fullPath) {
          viewerHeader.textContent = 'Open a markdown file from the explorer.';
          const viewer = document.getElementById('viewer');
          if (viewer) viewer.innerHTML = '';
        }

        await loadTree(path, container);
      });

      rowEl.append(itemEl, deleteBtn);
      container.appendChild(rowEl);
    }
  }
}

window.refreshTree = async function refreshTree() {
  await loadTree();
};

window.getCurrentTreePath = function getCurrentTreePath() {
  return currentTreePath;
};

document.addEventListener('DOMContentLoaded', () => {
  loadTree();
});
