// ==================== 应用状态 ====================
const APP_STATE = {
    postsData: null,
    currentPageId: null,
    currentRouteType: 'home',
    isInIframe: false,
    basePath: '',
    tocObserver: null,   // IntersectionObserver 实例
};

// ==================== DOM 元素缓存 ====================
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
            renderSidebar();        // 初始侧边栏（首页或文章页）
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
            console.error('[博客应用] 加载失败:', err);
            DOM.contentContainer.innerHTML = `
                <div class="not-found-inner">
                    <div class="icon">⚠️</div>
                    <h3>数据加载失败</h3>
                    <p>无法加载文章数据，请检查 posts.json 文件是否存在。</p>
                    <p style="font-size:0.8rem;color:#94a3b8;">${err.message}</p>
                </div>
            `;
        });
}

// ==================== 加载 posts.json ====================
async function loadPostsData() {
    const response = await fetch('../posts/posts.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    APP_STATE.postsData = await response.json();
    if (!APP_STATE.postsData.posts || !Array.isArray(APP_STATE.postsData.posts)) {
        throw new Error('posts.json 格式错误：缺少 posts 数组');
    }
    APP_STATE.postsData.posts.forEach((post, index) => {
        if (!post.id) post.id = `post-${index}`;
        if (!post.type) post.type = 'page';
    });
}

// ==================== 标题获取 ====================
function getPageTitle() {
    const blogTitle = APP_STATE.postsData?.title || '博客';
    if (APP_STATE.currentRouteType === 'home') return blogTitle;
    const post = findCurrentPost();
    return post ? `${post.title} - ${blogTitle}` : blogTitle;
}

function findCurrentPost() {
    if (!APP_STATE.postsData || !APP_STATE.currentPageId) return null;
    return APP_STATE.postsData.posts.find(
        p => p.id === APP_STATE.currentPageId && p.type === APP_STATE.currentRouteType
    );
}

// ==================== 侧边栏渲染（核心） ====================
function renderSidebar(forArticle = false) {
    if (!APP_STATE.postsData) return;

    // 博客基本信息保持不变
    if (APP_STATE.postsData.title) DOM.blogTitle.textContent = '📝 ' + APP_STATE.postsData.title;
    if (APP_STATE.postsData.description) DOM.blogDesc.textContent = APP_STATE.postsData.description;

    // 清空导航列表
    DOM.navList.innerHTML = '';

    if (forArticle) {
        // 文章页：只显示首页链接 + TOC 占位区
        const homeSection = document.createElement('div');
        homeSection.className = 'nav-section';
        homeSection.innerHTML = `<div class="nav-section-title">🏠 导航</div>`;
        const homeLink = document.createElement('a');
        homeLink.className = 'nav-item home-link';
        homeLink.dataset.path = '/home';
        homeLink.dataset.type = 'home';
        homeLink.href = '/home';
        homeLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="nav-icon">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg> 返回首页`;
        homeSection.appendChild(homeLink);

        const tocSection = document.createElement('div');
        tocSection.className = 'nav-section';
        tocSection.innerHTML = `<div class="nav-section-title">📑 目录</div>`;
        const tocContainer = document.createElement('div');
        tocContainer.id = 'tocContainer';
        tocContainer.className = 'toc-list';
        tocSection.appendChild(tocContainer);

        DOM.navList.appendChild(homeSection);
        DOM.navList.appendChild(tocSection);
    } else {
        // 首页：保留原文章分类列表
        const pagePosts = APP_STATE.postsData.posts.filter(p => p.type === 'page');
        const docsPosts = APP_STATE.postsData.posts.filter(p => p.type === 'docs');

        const homeSection = document.createElement('div');
        homeSection.className = 'nav-section';
        homeSection.innerHTML = `<div class="nav-section-title">🏠 导航</div>`;
        const homeLink = document.createElement('a');
        homeLink.className = 'nav-item home-link';
        homeLink.dataset.path = '/home';
        homeLink.dataset.type = 'home';
        homeLink.href = '/home';
        homeLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="nav-icon">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg> 首页`;
        homeSection.appendChild(homeLink);
        DOM.navList.appendChild(homeSection);

        if (pagePosts.length > 0) {
            const section = document.createElement('div');
            section.className = 'nav-section';
            section.innerHTML = `<div class="nav-section-title">📄 文章</div>`;
            pagePosts.forEach(post => section.appendChild(createNavItem(post, 'page')));
            DOM.navList.appendChild(section);
        }

        if (docsPosts.length > 0) {
            const section = document.createElement('div');
            section.className = 'nav-section';
            section.innerHTML = `<div class="nav-section-title">📚 文档</div>`;
            docsPosts.forEach(post => section.appendChild(createNavItem(post, 'docs')));
            DOM.navList.appendChild(section);
        }
    }

    // 高亮当前页（仅首页有效）
    highlightCurrentNav();
}

function createNavItem(post, type) {
    const link = document.createElement('a');
    link.className = 'nav-item';
    link.dataset.path = type === 'page' ? `/page/${post.id}` : `/docs/${post.id.replace('docs/', '')}`;
    link.dataset.postId = post.id;
    link.dataset.type = type;
    link.href = link.dataset.path;
    link.title = post.title;
    link.textContent = post.title;
    if (post.tags && post.tags.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.textContent = post.tags[0];
        link.appendChild(badge);
    }
    return link;
}

function highlightCurrentNav() {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (APP_STATE.currentRouteType === 'home') {
        const homeLink = document.querySelector('.home-link');
        if (homeLink) homeLink.classList.add('active');
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
            // 渲染完文章后构建 TOC
            buildTableOfContents();
        } else {
            renderNotFound();
        }
    }

    if (DOM.mobileTitle) {
        DOM.mobileTitle.textContent = 
            APP_STATE.currentRouteType === 'home' ? 
            (APP_STATE.postsData?.title || '博客') : 
            (findCurrentPost()?.title || '未找到');
    }
}

function renderHomePage() {
    // 保持不变，省略...（与之前相同）
    if (!APP_STATE.postsData) return;
    const pagePosts = APP_STATE.postsData.posts.filter(p => p.type === 'page');
    const docsPosts = APP_STATE.postsData.posts.filter(p => p.type === 'docs');

    let html = `
        <div class="home-welcome">
            <span class="welcome-emoji">👋</span>
            <h2>${APP_STATE.postsData.title || '欢迎'}</h2>
            <p style="color:#64748b;">${APP_STATE.postsData.description || ''}</p>
        </div>`;

    if (pagePosts.length) {
        html += `<div class="section-label">📄 最新文章</div><div class="post-list">`;
        pagePosts.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
                 .forEach(post => html += createPostListItem(post, 'page'));
        html += `</div>`;
    }
    if (docsPosts.length) {
        html += `<div class="section-label">📚 文档</div><div class="post-list">`;
        docsPosts.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
                 .forEach(post => html += createPostListItem(post, 'docs'));
        html += `</div>`;
    }
    if (!pagePosts.length && !docsPosts.length) {
        html += `<div style="text-align:center;padding:2rem;color:#94a3b8;"><p>还没有文章</p></div>`;
    }
    DOM.contentContainer.innerHTML = html;
    DOM.contentContainer.querySelectorAll('.post-list-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo(this.dataset.path, this.dataset.postId, this.dataset.type);
        });
    });
}

function createPostListItem(post, type) {
    const path = type === 'page' ? `/page/${post.id}` : `/docs/${post.id.replace('docs/', '')}`;
    const dateStr = post.date ? formatDate(post.date) : '';
    const tagStr = post.tags?.[0] || '';
    return `<a class="post-list-item" data-path="${path}" data-post-id="${post.id}" data-type="${type}" href="${path}">
        <span class="post-title">${escapeHtml(post.title)}</span>
        ${tagStr ? `<span class="post-tag">${escapeHtml(tagStr)}</span>` : ''}
        ${dateStr ? `<span class="post-date">${dateStr}</span>` : ''}
    </a>`;
}

function renderArticle(post) {
    let html = `
        <div class="article-header">
            <h1 class="article-title">${escapeHtml(post.title)}</h1>
            <div class="article-meta">
                ${post.date ? `<span>📅 ${formatDate(post.date)}</span>` : ''}
                ${post.author ? `<span>✍️ ${escapeHtml(post.author)}</span>` : ''}
                ${post.tags ? post.tags.map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('') : ''}
            </div>
        </div>
        <div class="article-body">
            ${renderMarkdown(post.content || '')}
        </div>`;
    DOM.contentContainer.innerHTML = html;

    // 外部链接新窗口打开
    DOM.contentContainer.querySelectorAll('.article-body a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }
    });
}

function renderNotFound() {
    DOM.contentContainer.innerHTML = `
        <div class="not-found-inner">
            <div class="icon">📭</div>
            <h3>文章未找到</h3>
            <p>「${escapeHtml(APP_STATE.currentPageId || '')}」不存在。</p>
            <p><a href="/home" class="btn-home-inline" data-path="/home">← 返回首页</a></p>
        </div>`;
    DOM.contentContainer.querySelector('.btn-home-inline').addEventListener('click', e => {
        e.preventDefault();
        navigateTo('/home', null, 'home');
    });
}

// ==================== TOC (目录) 构建与监听 ====================
function buildTableOfContents() {
    const tocContainer = document.getElementById('tocContainer');
    if (!tocContainer) return;

    // 获取文章内所有 h2, h3
    const headings = DOM.contentContainer.querySelectorAll('.article-body h2, .article-body h3');
    if (headings.length === 0) {
        tocContainer.innerHTML = '<div style="padding:0.5rem 1.25rem;color:#64748b;font-size:0.85rem;">暂无标题</div>';
        return;
    }

    // 确保每个标题有 id（marked 默认会生成，但可加强）
    headings.forEach((heading, idx) => {
        if (!heading.id) {
            heading.id = 'toc-' + idx;
        }
    });

    // 生成 TOC HTML
    let tocHTML = '';
    headings.forEach((heading) => {
        const level = heading.tagName.toLowerCase(); // h2 或 h3
        const text = heading.textContent;
        const id = heading.id;
        tocHTML += `<a class="toc-item toc-${level}" href="#${id}" data-target="${id}">${escapeHtml(text)}</a>`;
    });
    tocContainer.innerHTML = tocHTML;

    // 绑定点击事件（平滑滚动）
    tocContainer.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.dataset.target;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // 移动端关闭侧边栏
                closeSidebar();
            }
        });
    });

    // 启动 IntersectionObserver 监听标题
    observeHeadings(headings);
}

function observeHeadings(headings) {
    // 清除旧的 observer
    if (APP_STATE.tocObserver) {
        APP_STATE.tocObserver.disconnect();
    }

    const tocItems = document.querySelectorAll('.toc-item');
    if (tocItems.length === 0) return;

    const options = {
        root: DOM.mainContent,        // 监视主内容区滚动
        rootMargin: '-80px 0px -60% 0px', // 顶部留80px，底部只保留40%区域判定
        threshold: 0
    };

    APP_STATE.tocObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.id;
            const tocItem = document.querySelector(`.toc-item[data-target="${id}"]`);
            if (entry.isIntersecting) {
                // 移除所有高亮
                tocItems.forEach(item => item.classList.remove('active'));
                if (tocItem) {
                    tocItem.classList.add('active');
                    // 滚动侧边栏使可见
                    tocItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        });
    }, options);

    headings.forEach(heading => APP_STATE.tocObserver.observe(heading));
}

// ==================== 导航跳转 ====================
function navigateTo(path, postId, routeType) {
    APP_STATE.currentPageId = postId;
    APP_STATE.currentRouteType = routeType;

    // 重新构建侧边栏（文章页显示 TOC，首页显示列表）
    const isArticle = (routeType === 'page' || routeType === 'docs');
    renderSidebar(isArticle);
    renderContent();

    DOM.mainContent.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (APP_STATE.isInIframe) {
        sendToParent({ type: 'navigate', path: path });
        sendToParent({ type: 'setTitle', title: getPageTitle() });
    }
    document.title = getPageTitle();

    closeSidebar();
    if (DOM.searchInput) DOM.searchInput.value = '';
}

// ==================== 事件绑定 ====================
function bindEvents() {
    DOM.navList.addEventListener('click', function(e) {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;
        e.preventDefault();
        const path = navItem.dataset.path;
        const postId = navItem.dataset.postId || null;
        const type = navItem.dataset.type || 'home';
        navigateTo(path, postId, type);
    });

    if (DOM.hamburgerBtn) DOM.hamburgerBtn.addEventListener('click', toggleSidebar);
    if (DOM.sidebarOverlay) DOM.sidebarOverlay.addEventListener('click', closeSidebar);

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce(handleSearch, 250));
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeSidebar();
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (DOM.searchInput) DOM.searchInput.focus();
        }
    });

    window.addEventListener('message', function(event) {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (data?.type === 'popstate') {
            APP_STATE.currentPageId = data.pageParam;
            APP_STATE.currentRouteType = data.routeType || 'home';
            const isArticle = (data.routeType === 'page' || data.routeType === 'docs');
            renderSidebar(isArticle);
            renderContent();
            document.title = getPageTitle();
            DOM.mainContent.scrollTop = 0;
            closeSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeSidebar();
    });
}

// 侧边栏切换
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

// 搜索
function handleSearch() {
    const query = DOM.searchInput.value.trim().toLowerCase();
    const allNavItems = DOM.navList.querySelectorAll('.nav-item:not(.home-link):not(.toc-item)');
    if (!query) {
        allNavItems.forEach(item => item.style.display = '');
        return;
    }
    allNavItems.forEach(item => {
        const title = (item.textContent || '').toLowerCase();
        item.style.display = title.includes(query) ? '' : 'none';
    });
}

// 回到顶部
function setupBackToTop() {
    DOM.mainContent.addEventListener('scroll', () => {
        DOM.backToTop.classList.toggle('visible', DOM.mainContent.scrollTop > 400);
    });
    DOM.backToTop.addEventListener('click', () => {
        DOM.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==================== 工具函数 ====================
function sendToParent(msg) {
    if (window.parent !== window) window.parent.postMessage(msg, window.location.origin);
}
function formatDate(dateStr) {
    try { return new Date(dateStr).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' }); }
    catch { return dateStr; }
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function debounce(fn, delay) {
    let timer;
    return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}
function renderMarkdown(md) {
    if (!md) return '<p>（无内容）</p>';
    try {
        if (typeof marked !== 'undefined') {
            marked.setOptions?.({ breaks: true, gfm: true, headerIds: true });
            return marked.parse(md);
        }
        return '<pre>' + escapeHtml(md) + '</pre>';
    } catch { return '<pre>' + escapeHtml(md) + '</pre>'; }
}

// 启动
document.addEventListener('DOMContentLoaded', initApp);