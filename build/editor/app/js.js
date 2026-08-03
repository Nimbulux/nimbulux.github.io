// ---------- 全局状态 ----------
let currentSelectedNode = null;
let currentPath = "";
let currentNodeType = "";
let saveTimer = null;
let syncScrollActive = false;

// 展开状态集合（存储节点路径）
let expandedPaths = new Set();

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
    setupResizeHandles();
    setupInfoResize();
    setupEditorEvents();
    setupSyncScroll();
    setupInfoPanelEvents();
    document.addEventListener('click', hideContextMenu);

    const selectBtn = document.getElementById('select-dir-btn');
    const dirPathSpan = document.getElementById('current-dir-path');
    const darkBtn = document.getElementById('dark-mode-toggle');

    selectBtn.addEventListener('click', async () => {
        const selected = await pywebview.api.select_directory();
        if (selected) {
            dirPathSpan.textContent = selected;
            expandedPaths.clear();
            await loadTree();
        }
    });

    darkBtn.addEventListener('click', async () => {
        const isDark = document.body.classList.toggle('dark-mode');
        darkBtn.textContent = isDark ? '☀️ 亮色模式' : '🌙 暗色模式';
        await pywebview.api.set_dark_mode(isDark);
    });

    loadInitialConfig();
});

async function loadInitialConfig() {
    const dirPathSpan = document.getElementById('current-dir-path');
    const darkBtn = document.getElementById('dark-mode-toggle');
    try {
        const config = await pywebview.api.get_config();
        if (config.dark_mode) {
            document.body.classList.add('dark-mode');
            darkBtn.textContent = '☀️ 亮色模式';
        }
        if (config.expanded_paths) {
            expandedPaths = new Set(config.expanded_paths);
        }
        if (config.posts_dir) {
            dirPathSpan.textContent = config.posts_dir;
            try {
                await loadTree();  // 渲染时根据 expandedPaths 展开
            } catch (e) {
                console.log('上次目录可能已失效');
            }
        }
    } catch (e) {
        console.log('加载配置失败', e);
    }
}

// 持久化展开路径
function saveExpandedPaths() {
    pywebview.api.save_expanded_paths(Array.from(expandedPaths));
}

// ========== 树结构构建 ==========
async function loadTree() {
    const treeRoot = document.getElementById('tree-root');
    treeRoot.innerHTML = '';
    const data = await pywebview.api.get_tree();
    renderTreeNode(treeRoot, data);
}

function renderTreeNode(parentUl, node) {
    const li = document.createElement('li');
    li.dataset.path = node.path;
    li.dataset.type = node.type;
    li.dataset.hasPage = node.hasPage ? '1' : '0';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'node-content';
    contentDiv.addEventListener('click', (e) => selectNode(node, li, e));
    contentDiv.addEventListener('contextmenu', (e) => onContextMenu(e, node, li));
    contentDiv.draggable = true;
    contentDiv.addEventListener('dragstart', onDragStart);
    contentDiv.addEventListener('dragover', onDragOver);
    contentDiv.addEventListener('drop', onDrop);
    
    const toggle = document.createElement('span');
    toggle.className = 'toggle-icon';
    if (node.children && node.children.length > 0) {
        toggle.textContent = '▶';
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const childUl = li.querySelector(':scope > .children');
            if (childUl) {
                const isNowOpen = childUl.classList.toggle('open');
                toggle.textContent = isNowOpen ? '▼' : '▶';
                if (isNowOpen) {
                    expandedPaths.add(node.path);
                } else {
                    expandedPaths.delete(node.path);
                }
                saveExpandedPaths();
            }
        });
    } else {
        toggle.style.visibility = 'hidden';
    }
    contentDiv.appendChild(toggle);

    const typeIcon = document.createElement('span');
    typeIcon.className = 'type-icon';
    if (node.type === 'directory') {
        typeIcon.textContent = '📁';
    } else if (node.type === 'mixed') {
        typeIcon.textContent = '📄📁';
    } else {
        typeIcon.textContent = '📄';
    }
    contentDiv.appendChild(typeIcon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    nameSpan.textContent = node.name;
    contentDiv.appendChild(nameSpan);

    li.appendChild(contentDiv);

    if (node.children && node.children.length > 0) {
        const childUl = document.createElement('ul');
        childUl.className = 'children';
        // 根据 expandedPaths 判断是否初始打开
        if (expandedPaths.has(node.path)) {
            childUl.classList.add('open');
            toggle.textContent = '▼';
        }
        node.children.forEach(child => renderTreeNode(childUl, child));
        li.appendChild(childUl);
    }

    parentUl.appendChild(li);
}

// ---------- 选中节点 ----------
async function selectNode(node, li, event) {
    document.querySelectorAll('.node-content.selected').forEach(el => el.classList.remove('selected'));
    li.querySelector('.node-content').classList.add('selected');
    currentSelectedNode = li;
    currentPath = node.path;
    currentNodeType = node.type;

    const infoPanel = document.getElementById('info-panel');
    const infoHandle = document.getElementById('info-resize-handle');
    const editor = document.getElementById('markdown-editor');
    const preview = document.getElementById('preview-content');
    
    if (node.type === 'directory') {
        infoPanel.style.display = 'none';
        infoHandle.style.display = 'none';
        editor.value = '';
        preview.innerHTML = '';
        editor.setAttribute('disabled', 'true');
        return;
    }

    editor.removeAttribute('disabled');
    infoPanel.style.display = 'flex';
    infoHandle.style.display = 'block';

    const mdContent = await pywebview.api.read_file(currentPath, 'page.md');
    editor.value = mdContent;
    renderPreview(mdContent);

    const info = await pywebview.api.read_info(currentPath);
    populateInfoForm(info);

    clearSaveStatus();
}

// ---------- 预览渲染 ----------
function renderPreview(mdText) {
    if (typeof marked !== 'undefined') {
        document.getElementById('preview-content').innerHTML = marked.parse(mdText);
    } else {
        document.getElementById('preview-content').innerText = mdText;
    }
    document.getElementById('preview-area').scrollTop = 0;
}

// ---------- 编辑器事件 ----------
function setupEditorEvents() {
    const editor = document.getElementById('markdown-editor');
    editor.addEventListener('input', () => {
        renderPreview(editor.value);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveCurrentArticle, 1000);
    });
}

async function saveCurrentArticle() {
    if (!currentPath || currentNodeType === 'directory') return;
    const content = document.getElementById('markdown-editor').value;
    await pywebview.api.write_file(currentPath, content, 'page.md');
}

function setupSyncScroll() {
    const editor = document.getElementById('markdown-editor');
    const preview = document.getElementById('preview-area');
    editor.addEventListener('scroll', () => {
        if (syncScrollActive) return;
        syncScrollActive = true;
        const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        if (isNaN(ratio)) ratio = 0;
        preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
        setTimeout(() => { syncScrollActive = false; }, 10);
    });
}

// ---------- 信息面板 ----------
function populateInfoForm(info) {
    document.getElementById('info-title').value = info.title || '';
    document.getElementById('info-excerpt').value = info.excerpt || '';
    document.getElementById('info-date').value = formatDateForInput(info.date);
    document.getElementById('info-updated').value = formatDateForInput(info.updated);
    document.getElementById('info-tags').value = info.tags ? info.tags.join(', ') : '';
    document.getElementById('info-reading-time').value = info.reading_time || '';
}

function formatDateForInput(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

function setupInfoPanelEvents() {
    document.getElementById('save-info').addEventListener('click', async () => {
        if (!currentPath || currentNodeType === 'directory') return;
        const info = {
            title: document.getElementById('info-title').value,
            excerpt: document.getElementById('info-excerpt').value,
            date: document.getElementById('info-date').value,
            updated: document.getElementById('info-updated').value,
            tags: document.getElementById('info-tags').value.split(',').map(t => t.trim()).filter(t => t),
            reading_time: parseInt(document.getElementById('info-reading-time').value) || null
        };
        info.date = info.date ? new Date(info.date).toISOString() : '';
        info.updated = info.updated ? new Date(info.updated).toISOString() : '';

        try {
            await pywebview.api.write_info(currentPath, info);
            showSaveStatus('success');
            updateCurrentNodeTitle(info.title);
        } catch (error) {
            const errorMsg = error.message || String(error);
            showSaveStatus('error', errorMsg);
        }
    });

    document.getElementById('calc-reading-time').addEventListener('click', async () => {
        const md = document.getElementById('markdown-editor').value;
        const time = await pywebview.api.calculate_reading_time(md);
        document.getElementById('info-reading-time').value = time;
    });
}

function showSaveStatus(type, errorText = '') {
    const icon = document.getElementById('save-status-icon');
    const errorBox = document.getElementById('save-error-box');

    icon.style.display = 'inline-block';
    icon.classList.remove('success', 'error');
    errorBox.style.display = 'none';
    errorBox.textContent = '';

    if (type === 'success') {
        icon.textContent = '✓';
        icon.classList.add('success');
        setTimeout(() => {
            if (icon.classList.contains('success')) {
                icon.style.display = 'none';
            }
        }, 3000);
    } else if (type === 'error') {
        icon.textContent = '✗';
        icon.classList.add('error');
        errorBox.textContent = errorText || '保存失败，未知错误';
        errorBox.style.display = 'block';
    }
}

function clearSaveStatus() {
    const icon = document.getElementById('save-status-icon');
    const errorBox = document.getElementById('save-error-box');
    icon.style.display = 'none';
    icon.classList.remove('success', 'error');
    errorBox.style.display = 'none';
    errorBox.textContent = '';
}

function updateCurrentNodeTitle(newTitle) {
    if (!currentSelectedNode) return;
    const nameSpan = currentSelectedNode.querySelector('.node-content .node-name');
    if (nameSpan && newTitle) {
        nameSpan.textContent = newTitle;
    }
}

// ========== 右键菜单 ==========
function onContextMenu(event, node, li) {
    event.preventDefault();
    event.stopPropagation();
    hideContextMenu();

    const menu = document.getElementById('context-menu');
    const list = document.getElementById('context-menu-list');
    list.innerHTML = '';

    addMenuItem(list, '新建文件夹', () => {
        const name = prompt('输入文件夹名称：');
        if (name) {
            pywebview.api.create_folder(node.path, name).then(() => {
                loadTree();  // 重建后展开状态由 expandedPaths 恢复
            });
        }
    });
    addMenuItem(list, '新建文章', () => {
        const name = prompt('输入文章目录名称：');
        if (name) {
            pywebview.api.create_article(node.path, name).then(() => {
                loadTree();
            });
        }
    });

    if (node.hasPage) {
        addMenuItem(list, '删除文章条目', () => {
            if (confirm(`确定要删除“${node.name}”的文章内容吗？（仅删除 page.md 和 info.json）`)) {
                pywebview.api.delete_item(node.path, 'article').then(() => {
                    loadTree();
                    if (currentPath === node.path) {
                        clearEditor();
                    }
                });
            }
        });
    }
    if (node.type === 'directory' || node.type === 'mixed') {
        addMenuItem(list, '删除文件夹及其内容', () => {
            if (confirm(`确定要删除整个文件夹“${node.name}”及其所有内容吗？此操作不可恢复！`)) {
                pywebview.api.delete_item(node.path, 'directory').then(() => {
                    // 删除路径会连带其子节点，从 expandedPaths 中移除相关前缀
                    for (const p of expandedPaths) {
                        if (p === node.path || p.startsWith(node.path + '/')) {
                            expandedPaths.delete(p);
                        }
                    }
                    saveExpandedPaths();
                    loadTree();
                    if (currentPath === node.path || currentPath.startsWith(node.path + '/')) {
                        clearEditor();
                    }
                });
            }
        });
    }

    menu.style.display = 'block';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 0);
}

function clearEditor() {
    document.getElementById('markdown-editor').value = '';
    document.getElementById('preview-content').innerHTML = '';
    document.getElementById('info-panel').style.display = 'none';
    document.getElementById('info-resize-handle').style.display = 'none';
    currentPath = '';
    currentNodeType = '';
    clearSaveStatus();
}

function addMenuItem(list, text, callback) {
    const li = document.createElement('li');
    li.textContent = text;
    li.onclick = () => {
        hideContextMenu();
        callback();
    };
    list.appendChild(li);
}

function hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
}

// ========== 拖拽移动 ==========
let dragSrcPath = null;

function onDragStart(event) {
    const li = event.target.closest('li');
    if (!li) return;
    dragSrcPath = li.dataset.path;
    event.dataTransfer.setData('text/plain', dragSrcPath);
    event.dataTransfer.effectAllowed = 'move';
    event.stopPropagation();
}

function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

async function onDrop(event) {
    event.preventDefault();
    const targetLi = event.target.closest('li');
    if (!targetLi || !dragSrcPath) return;
    const destPath = targetLi.dataset.path;
    const destType = targetLi.dataset.type;

    if (dragSrcPath === destPath) return;
    if (destPath.startsWith(dragSrcPath + '/')) return;

    if (destType === 'article') {
        alert('不能将项目移动到纯文章目录中');
        return;
    }

    const tree = await pywebview.api.get_tree();
    const srcNode = findNodeByPath(tree, dragSrcPath);
    if (!srcNode) return;
    if (!confirm(`确定将“${srcNode.name}”移动到“${targetLi.querySelector('.node-name').textContent}”下吗？`)) return;

    try {
        await pywebview.api.move_item(dragSrcPath, destPath);
        // 移动后原路径可能改变，为简化处理，我们清理与被移动路径相关的展开状态，保留目标路径的展开状态
        // 更好的做法是递归更新所有包含原路径的 expandedPaths，但这里直接清除所有带原路径前缀的，然后添加目标路径前缀的。
        const newPaths = new Set();
        for (const p of expandedPaths) {
            if (p === dragSrcPath || p.startsWith(dragSrcPath + '/')) {
                // 替换为新的路径前缀
                const newPath = destPath + '/' + srcNode.name + p.substring(dragSrcPath.length);
                newPaths.add(newPath);
            } else {
                newPaths.add(p);
            }
        }
        expandedPaths = newPaths;
        saveExpandedPaths();
        await loadTree();
    } catch (e) {
        alert('移动失败：' + e);
    }
    dragSrcPath = null;
}

function findNodeByPath(tree, path) {
    if (tree.path === path) return tree;
    if (tree.children) {
        for (const child of tree.children) {
            const found = findNodeByPath(child, path);
            if (found) return found;
        }
    }
    return null;
}

// ========== 分隔条调整大小 ==========
function setupResizeHandles() {
    const mainHandle = document.getElementById('main-resize-handle');
    const leftPanel = document.getElementById('left-panel');

    let startX, startWidth;
    mainHandle.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;
        document.addEventListener('mousemove', onMainMouseMove);
        document.addEventListener('mouseup', onMainMouseUp);
    });

    function onMainMouseMove(e) {
        const newWidth = startWidth + (e.clientX - startX);
        if (newWidth > 200 && newWidth < window.innerWidth * 0.6) {
            leftPanel.style.width = newWidth + 'px';
        }
    }

    function onMainMouseUp() {
        document.removeEventListener('mousemove', onMainMouseMove);
        document.removeEventListener('mouseup', onMainMouseUp);
    }

    const previewHandle = document.getElementById('preview-resize-handle');
    const editorArea = document.getElementById('editor-area');
    const previewArea = document.getElementById('preview-area');
    const wrapper = document.getElementById('editor-preview-wrapper');

    let startX2, startWidth2;
    previewHandle.addEventListener('mousedown', (e) => {
        startX2 = e.clientX;
        startWidth2 = editorArea.offsetWidth;
        document.addEventListener('mousemove', onPreviewMouseMove);
        document.addEventListener('mouseup', onPreviewMouseUp);
    });

    function onPreviewMouseMove(e) {
        const wrapperWidth = wrapper.offsetWidth;
        const newEditorWidth = startWidth2 + (e.clientX - startX2);
        if (newEditorWidth > 200 && newEditorWidth < wrapperWidth - 200) {
            editorArea.style.flex = 'none';
            editorArea.style.width = newEditorWidth + 'px';
            previewArea.style.flex = '1';
        }
    }

    function onPreviewMouseUp() {
        document.removeEventListener('mousemove', onPreviewMouseMove);
        document.removeEventListener('mouseup', onPreviewMouseUp);
    }
}

function setupInfoResize() {
    const handle = document.getElementById('info-resize-handle');
    const infoPanel = document.getElementById('info-panel');
    let startY, startHeight;

    handle.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        startHeight = infoPanel.offsetHeight;
        document.addEventListener('mousemove', onInfoMouseMove);
        document.addEventListener('mouseup', onInfoMouseUp);
        e.preventDefault();
    });

    function onInfoMouseMove(e) {
        const newHeight = startHeight + (startY - e.clientY);
        if (newHeight >= 100 && newHeight <= 600) {
            infoPanel.style.height = newHeight + 'px';
        }
    }

    function onInfoMouseUp() {
        document.removeEventListener('mousemove', onInfoMouseMove);
        document.removeEventListener('mouseup', onInfoMouseUp);
    }
}