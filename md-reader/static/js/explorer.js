const treeEl = document.getElementById('tree');
const viewerHeader = document.getElementById('viewerHeader');

async function fetchList(path = '') {
  const response = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
  return response.json();
}

async function loadTree(path = '', container = treeEl) {
  const data = await fetchList(path);
  container.innerHTML = '';

  for (const item of data.files) {
    const itemEl = document.createElement('div');
    itemEl.className = `tree-item ${item.type === 'directory' ? 'tree-folder' : ''}`;
    itemEl.textContent = `${item.type === 'directory' ? '📁' : '📄'} ${item.name}`;
    const fullPath = [path, item.name].filter(Boolean).join('/');

    if (item.type === 'directory') {
      const nested = document.createElement('div');
      nested.className = 'nested';
      let expanded = false;
      itemEl.addEventListener('click', async () => {
        expanded = !expanded;
        if (expanded) {
          await loadTree(fullPath, nested);
          nested.style.display = 'block';
        } else {
          nested.style.display = 'none';
        }
      });
      container.append(itemEl, nested);
    } else {
      itemEl.addEventListener('click', () => {
        viewerHeader.textContent = fullPath;
        window.loadMarkdown(fullPath);
      });
      container.appendChild(itemEl);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTree();
});
