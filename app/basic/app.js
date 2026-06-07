// ==================== 应用状态 ====================
const APP_STATE = {
    postsData: null,
    currentPageId: null,
    currentRouteType: 'home',
    isInIframe: false,
    tocObserver: null,
    visibleHeadings: new Set(),
    tocItemsMap: new Map(),
};

// ==================== DOM 缓存 ====================
const DOM = {
    sidebar: null,
    sidebarOverlay: null,
    hamburgerBtn: null,
    mobileTitle: null,
    mainContent: null,
    contentContainer: null,
    navList: null,
    pageNavItems: null,
    docsNavItems: null,
    searchInput: null,
    backToTop: null,
    blogTitle: null,
    blogDesc: null,
};

// ==================== 初始化 ====================
function initApp() {
    DOM.sidebar = document.getElementById('sidebar');
    DOM.sidebarOverlay = document.getElementById('sidebarOverlay');
    DOM.hamburgerBtn = document.getElementById('hamburgerBtn');
    DOM.mobileTitle = document.getElementById('mobileTitle');
    DOM.mainContent = document.getElementById('mainContent');
    DOM.contentContainer = document.getElementById('contentContainer');
    DOM.navList = document.getElementById('navList');
    DOM.pageNavItems = document.getElementById('pageNavItems');
    DOM.docsNavItems = document.getElementById('docsNavItems');
    DOM.searchInput = document.getElementById('searchInput');
    DOM.backToTop = document.getElementById('backToTop');
    DOM.blogTitle = document.getElementById('blogTitle');
    DOM.blogDesc = document.getElementById('blogDesc');

    APP_STATE.isInIframe = window.parent !== window;

    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');

    if (pageParam) {
        if (pageParam.startsWith('docs/')) {
            APP_STATE.currentPageId = pageParam;
            APP_STATE.currentRouteType = 'docs';
        } else {
            APP_STATE.currentPageId = pageParam;
            APP_STATE.currentRouteType = 'page';
        }
    } else {
        APP_STATE.currentPageId = null;
        APP_STATE.currentRouteType = 'home';
    }

    loadPostsData()
        .then(() => {
            renderSidebar();
            renderContent();
            bindEvents();
            setupBackToTop();

            if (APP_STATE.isInIframe) {
                sendToParent({ type: 'ready' });
                sendToParent({ type: 'setTitle', title: getPageTitle() });
            }
            document.title = getPageTitle();
        })
        .catch((err) => {
            console.error(err);
            DOM.contentContainer.innerHTML = `<div class="not-found-inner">⚠️ 数据加载失败</div>`;
        });
}

// ==================== 数据加载 ====================
async function loadPostsData() {
    const res = await fetch('../posts/posts.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    APP_STATE.postsData = await res.json();
    if (!APP_STATE.postsData.posts) throw new Error('缺少 posts 数组');
    APP_STATE.postsData.posts.forEach((p, i) => {
        if (!p.id) p.id = 'post-' + i;
        if (!p.type) p.type = 'page';
    });
}

// ==================== 标题工具 ====================
function getPageTitle() {
    const blog = APP_STATE.postsData?.title || '博客';
    if (APP_STATE.currentRouteType === 'home') return blog;
    const post = findCurrentPost();
    return post ? `${post.title} - ${blog}` : blog;
}

function findCurrentPost() {
    if (!APP_STATE.postsData || !APP_STATE.currentPageId) return null;
    return APP_STATE.postsData.posts.find(
        p => p.id === APP_STATE.currentPageId && p.type === APP_STATE.currentRouteType
    );
}

// ==================== 侧边栏渲染 ====================
function renderSidebar(isArticle = false) {
    if (!APP_STATE.postsData) return;
    DOM.blogTitle.textContent = '📝 ' + (APP_STATE.postsData.title || '博客');
    DOM.blogDesc.textContent = APP_STATE.postsData.description || '';

    DOM.navList.innerHTML = '';

    const homeSection = document.createElement('div');
    homeSection.className = 'nav-section';
    homeSection.innerHTML = `<div class="nav-section-title">🏠 导航</div>`;
    const homeLink = document.createElement('a');
    homeLink.className = 'nav-item home-link';
    homeLink.dataset.path = '/home';
    homeLink.dataset.type = 'home';
    homeLink.href = '/home';
    homeLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="nav-icon"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> 返回首页`;
    homeSection.appendChild(homeLink);
    DOM.navList.appendChild(homeSection);

    if (isArticle) {
        const tocSection = document.createElement('div');
        tocSection.className = 'nav-section';
        tocSection.innerHTML = `<div class="nav-section-title">📑 目录</div>`;
        const tocContainer = document.createElement('div');
        tocContainer.id = 'tocContainer';
        tocContainer.className = 'toc-list';
        tocSection.appendChild(tocContainer);
        DOM.navList.appendChild(tocSection);
    } else {
        const pagePosts = APP_STATE.postsData.posts.filter(p => p.type === 'page');
        const docsPosts = APP_STATE.postsData.posts.filter(p => p.type === 'docs');

        if (pagePosts.length) {
            const sec = document.createElement('div');
            sec.className = 'nav-section';
            sec.innerHTML = `<div class="nav-section-title">📄 文章</div>`;
            pagePosts.forEach(p => sec.appendChild(createNavItem(p, 'page')));
            DOM.navList.appendChild(sec);
        }
        if (docsPosts.length) {
            const sec = document.createElement('div');
            sec.className = 'nav-section';
            sec.innerHTML = `<div class="nav-section-title">📚 文档</div>`;
            docsPosts.forEach(p => sec.appendChild(createNavItem(p, 'docs')));
            DOM.navList.appendChild(sec);
        }
    }

    highlightCurrentNav();
}

function createNavItem(post, type) {
    const a = document.createElement('a');
    a.className = 'nav-item';
    a.dataset.path = type === 'page' ? `/page/${post.id}` : `/docs/${post.id.replace('docs/', '')}`;
    a.dataset.postId = post.id;
    a.dataset.type = type;
    a.href = a.dataset.path;
    a.textContent = post.title;
    return a;
}

function highlightCurrentNav() {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (APP_STATE.currentRouteType === 'home') {
        document.querySelector('.home-link')?.classList.add('active');
    }
}

// ==================== 内容渲染 ====================
function renderContent() {
    if (APP_STATE.currentRouteType === 'home') {
        renderHomePage();
    } else {
        const post = findCurrentPost();
        if (post) {
            renderArticle(post);
            buildTableOfContents();
        } else {
            renderNotFound();
        }
    }

    if (DOM.mobileTitle) {
        DOM.mobileTitle.textContent =
            APP_STATE.currentRouteType === 'home'
                ? APP_STATE.postsData?.title || '博客'
                : findCurrentPost()?.title || '未找到';
    }
}

function renderHomePage() {
    if (!APP_STATE.postsData) return;
    const pagePosts = APP_STATE.postsData.posts.filter(p => p.type === 'page');
    const docsPosts = APP_STATE.postsData.posts.filter(p => p.type === 'docs');
    let html = `<div class="home-welcome"><span class="welcome-emoji">👋</span><h2>${APP_STATE.postsData.title||'欢迎'}</h2><p>${APP_STATE.postsData.description||''}</p></div>`;

    if (pagePosts.length) {
        html += `<div class="section-label">📄 文章</div><div class="post-list">`;
        pagePosts.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).forEach(p=> html += createPostListItem(p,'page'));
        html += `</div>`;
    }
    if (docsPosts.length) {
        html += `<div class="section-label">📚 文档</div><div class="post-list">`;
        docsPosts.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).forEach(p=> html += createPostListItem(p,'docs'));
        html += `</div>`;
    }
    DOM.contentContainer.innerHTML = html;
    DOM.contentContainer.querySelectorAll('.post-list-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(item.dataset.path, item.dataset.postId, item.dataset.type);
        });
    });
}

function createPostListItem(post, type) {
    const path = type === 'page' ? `/page/${post.id}` : `/docs/${post.id.replace('docs/', '')}`;
    return `<a class="post-list-item" data-path="${path}" data-post-id="${post.id}" data-type="${type}" href="${path}">
        <span class="post-title">${escapeHtml(post.title)}</span>
        ${post.tags?.[0]?`<span class="post-tag">${escapeHtml(post.tags[0])}</span>`:''}
        ${post.date?`<span class="post-date">${formatDate(post.date)}</span>`:''}
    </a>`;
}

function renderArticle(post) {
    DOM.contentContainer.innerHTML = `
        <div class="article-header">
            <h1 class="article-title">${escapeHtml(post.title)}</h1>
            <div class="article-meta">
                ${post.date?`<span>📅 ${formatDate(post.date)}</span>`:''}
                ${post.author?`<span>✍️ ${escapeHtml(post.author)}</span>`:''}
                ${post.tags?post.tags.map(t=>`<span class="article-tag">${escapeHtml(t)}</span>`).join(''):''}
            </div>
        </div>
        <div class="article-body">${renderMarkdown(post.content||'')}</div>`;
    DOM.contentContainer.querySelectorAll('.article-body a[href^="http"]').forEach(a => {
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener');
    });
}

function renderNotFound() {
    DOM.contentContainer.innerHTML = `<div class="not-found-inner">📭 文章未找到</div>`;
}

// ==================== 折叠 TOC 构建 ====================
function buildTableOfContents() {
    const tocContainer = document.getElementById('tocContainer');
    if (!tocContainer) return;

    const headings = DOM.contentContainer.querySelectorAll('.article-body h2, .article-body h3');
    if (headings.length === 0) {
        tocContainer.innerHTML = '<div class="toc-empty">暂无标题</div>';
        return;
    }

    headings.forEach((h, i) => { if (!h.id) h.id = 'toc-' + i; });

    APP_STATE.tocItemsMap.clear();
    APP_STATE.visibleHeadings.clear();

    let html = '';
    let currentH2 = null;
    let currentH3List = [];

    headings.forEach(heading => {
        if (heading.tagName === 'H2') {
            if (currentH2) {
                html += renderH2Group(currentH2, currentH3List);
            }
            currentH2 = heading;
            currentH3List = [];
        } else {
            currentH3List.push(heading);
        }
    });
    if (currentH2) {
        html += renderH2Group(currentH2, currentH3List);
    }

    tocContainer.innerHTML = html;

    // 绑定点击事件
    tocContainer.querySelectorAll('.toc-h2-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const group = this.closest('.toc-group');
            group.classList.toggle('open');
            // 点击 h2 时平滑滚动到对应标题
            const targetId = this.dataset.target;
            if (targetId) {
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    closeSidebar();
                }
            }
        });
    });

    tocContainer.querySelectorAll('.toc-h3-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.dataset.target;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                closeSidebar();
            }
        });
    });

    observeHeadings(headings);
}

function renderH2Group(h2Element, h3Elements) {
    const h2Id = h2Element.id;
    const h2Text = h2Element.textContent;
    const h2TocId = 'toc-h2-' + h2Id;
    APP_STATE.tocItemsMap.set(h2Id, h2TocId);

    let h3HTML = '';
    h3Elements.forEach(h3 => {
        const h3Id = h3.id;
        const h3Text = h3.textContent;
        const h3TocId = 'toc-h3-' + h3Id;
        APP_STATE.tocItemsMap.set(h3Id, h3TocId);
        h3HTML += `<a class="toc-item toc-h3-item" data-target="${h3Id}" id="${h3TocId}">${escapeHtml(h3Text)}</a>`;
    });

    return `
        <div class="toc-group">
            <div class="toc-item toc-h2-toggle" id="${h2TocId}" data-target="${h2Id}">
                <span class="toc-arrow"></span>
                <span class="toc-text">${escapeHtml(h2Text)}</span>
            </div>
            <div class="toc-h3-children">${h3HTML}</div>
        </div>
    `;
}

// ==================== 目光提示：基于视口观察 ====================
function observeHeadings(headings) {
    if (APP_STATE.tocObserver) APP_STATE.tocObserver.disconnect();

    const options = {
        root: null,                 // 使用视口作为根
        rootMargin: '-80px 0px 0px 0px', // 顶部减去 80px（导航栏高度），只要标题顶部进入该区域就算可见
        threshold: 0,
    };

    APP_STATE.tocObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.id;
            if (entry.isIntersecting) {
                APP_STATE.visibleHeadings.add(id);
            } else {
                APP_STATE.visibleHeadings.delete(id);
            }
        });
        updateTocVisibility();
    }, options);

    headings.forEach(h => APP_STATE.tocObserver.observe(h));
}

function updateTocVisibility() {
    // 移除所有高亮和展开状态
    document.querySelectorAll('.toc-item.visible').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.toc-group').forEach(group => group.classList.remove('open'));

    // 根据当前可见标题集合，点亮对应 TOC 项并展开所属分组
    APP_STATE.visibleHeadings.forEach(headingId => {
        const tocItemId = APP_STATE.tocItemsMap.get(headingId);
        if (!tocItemId) return;

        const tocEl = document.getElementById(tocItemId);
        if (tocEl) {
            tocEl.classList.add('visible');

            // 找到所属分组并展开
            const group = tocEl.closest('.toc-group');
            if (group) group.classList.add('open');
        }
    });
}

// ==================== 导航跳转 ====================
function navigateTo(path, postId, routeType) {
    APP_STATE.currentPageId = postId;
    APP_STATE.currentRouteType = routeType;

    const isArticle = (routeType === 'page' || routeType === 'docs');
    renderSidebar(isArticle);
    renderContent();

    DOM.mainContent.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (APP_STATE.isInIframe) {
        sendToParent({ type: 'navigate', path });
        sendToParent({ type: 'setTitle', title: getPageTitle() });
    }
    document.title = getPageTitle();

    closeSidebar();
    if (DOM.searchInput) DOM.searchInput.value = '';
}

// ==================== 事件绑定 ====================
function bindEvents() {
    DOM.navList.addEventListener('click', e => {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;
        e.preventDefault();
        const path = navItem.dataset.path;
        const postId = navItem.dataset.postId || null;
        const type = navItem.dataset.type || 'home';
        navigateTo(path, postId, type);
    });

    DOM.hamburgerBtn?.addEventListener('click', toggleSidebar);
    DOM.sidebarOverlay?.addEventListener('click', closeSidebar);

    DOM.searchInput?.addEventListener('input', debounce(handleSearch, 250));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeSidebar();
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            DOM.searchInput?.focus();
        }
    });

    window.addEventListener('message', event => {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (data?.type === 'popstate') {
            APP_STATE.currentPageId = data.pageParam;
            APP_STATE.currentRouteType = data.routeType || 'home';
            const isArticle = (data.routeType === 'page' || data.routeType === 'docs');
            renderSidebar(isArticle);
            renderContent();
            document.title = getPageTitle();
            closeSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeSidebar();
    });
}

function toggleSidebar() {
    DOM.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
}
function openSidebar() {
    DOM.sidebar.classList.add('open');
    DOM.sidebarOverlay.classList.add('active');
    DOM.hamburgerBtn?.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeSidebar() {
    DOM.sidebar.classList.remove('open');
    DOM.sidebarOverlay.classList.remove('active');
    DOM.hamburgerBtn?.classList.remove('active');
    document.body.style.overflow = '';
}

function handleSearch() {
    const query = DOM.searchInput.value.trim().toLowerCase();
    document.querySelectorAll('.nav-item:not(.home-link):not(.toc-item)').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
    });
}

function setupBackToTop() {
    DOM.mainContent.addEventListener('scroll', () => {
        DOM.backToTop.classList.toggle('visible', DOM.mainContent.scrollTop > 400);
    });
    DOM.backToTop.addEventListener('click', () => {
        DOM.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==================== 工具函数 ====================
function sendToParent(msg) { if (window.parent !== window) window.parent.postMessage(msg, window.location.origin); }
function formatDate(d) { try { return new Date(d).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' }); } catch { return d; } }
function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); }; }
function renderMarkdown(md) {
    if (!md) return '';
    if (typeof marked !== 'undefined') {
        marked.setOptions?.({ breaks: true, gfm: true, headerIds: true });
        return marked.parse(md);
    }
    return `<pre>${escapeHtml(md)}</pre>`;
}

document.addEventListener('DOMContentLoaded', initApp);