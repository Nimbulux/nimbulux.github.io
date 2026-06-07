// ==================== 应用状态 ====================
const APP_STATE = {
    postsData: null, // 存储 posts.json 的全部数据
    currentPageId: null, // 当前文章 ID（如 "hello-world" 或 "docs/getting-started"）
    currentRouteType: 'home', // 'home' | 'page' | 'docs'
    isInIframe: false, // 是否在 iframe 中运行
    basePath: '', // 部署基础路径
    isLoading: false,
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
    // 缓存 DOM 元素
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

    // 检测是否在 iframe 中
    APP_STATE.isInIframe = window.parent !== window;

    // 解析当前 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');

    if (pageParam) {
        // 判断是 page 还是 docs
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

    // 加载数据
    loadPostsData()
        .then(() => {
            renderSidebar();
            renderContent();
            bindEvents();
            setupBackToTop();

            // 通知父页面（404.html）已准备就绪
            if (APP_STATE.isInIframe) {
                sendToParent({ type: 'ready' });
                sendToParent({
                    type: 'setTitle',
                    title: getPageTitle(),
                });
            }

            // 设置文档标题
            document.title = getPageTitle();

            console.log('[博客应用] 初始化完成');
            console.log('  当前路由类型:', APP_STATE.currentRouteType);
            console.log('  当前文章ID:', APP_STATE.currentPageId || '(首页)');
            console.log('  是否在iframe中:', APP_STATE.isInIframe);
        })
        .catch((err) => {
            console.error('[博客应用] 加载失败:', err);
            DOM.contentContainer.innerHTML = `
                        <div class="not-found-inner">
                            <div class="icon">⚠️</div>
                            <h3>数据加载失败</h3>
                            <p>无法加载文章数据，请检查 posts.json 文件是否存在。</p>
                            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.5rem;">${err.message}</p>
                        </div>
                    `;
        });
}

// ==================== 加载 posts.json ====================
async function loadPostsData() {
    const response = await fetch('../posts/posts.json');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    APP_STATE.postsData = await response.json();

    // 验证数据结构
    if (!APP_STATE.postsData.posts || !Array.isArray(APP_STATE.postsData.posts)) {
        throw new Error('posts.json 格式错误：缺少 posts 数组');
    }

    // 为每篇文章添加唯一标识（如果使用 id 字段）
    APP_STATE.postsData.posts.forEach((post, index) => {
        if (!post.id) {
            console.warn(`文章 #${index} 缺少 id 字段，使用索引作为 id`);
            post.id = `post-${index}`;
        }
        if (!post.type) {
            post.type = 'page'; // 默认为 page 类型
        }
    });

    return APP_STATE.postsData;
}

// ==================== 获取页面标题 ====================
function getPageTitle() {
    const blogTitle = APP_STATE.postsData?.title || '博客';

    if (APP_STATE.currentRouteType === 'home') {
        return blogTitle;
    }

    const post = findCurrentPost();
    if (post) {
        return `${post.title} - ${blogTitle}`;
    }

    return blogTitle;
}

// ==================== 查找当前文章 ====================
function findCurrentPost() {
    if (!APP_STATE.postsData || !APP_STATE.currentPageId) return null;
    return APP_STATE.postsData.posts.find(
        (p) => p.id === APP_STATE.currentPageId && p.type === APP_STATE.currentRouteType
    );
}

// ==================== 渲染侧边栏 ====================
function renderSidebar() {
    if (!APP_STATE.postsData) return;

    // 设置博客标题和描述
    if (APP_STATE.postsData.title) {
        DOM.blogTitle.textContent = '📝 ' + APP_STATE.postsData.title;
    }
    if (APP_STATE.postsData.description) {
        DOM.blogDesc.textContent = APP_STATE.postsData.description;
    }

    // 分类文章
    const pagePosts = APP_STATE.postsData.posts.filter((p) => p.type === 'page');
    const docsPosts = APP_STATE.postsData.posts.filter((p) => p.type === 'docs');

    // 渲染 page 类型文章
    DOM.pageNavItems.innerHTML = '';
    if (pagePosts.length > 0) {
        document.getElementById('pageSection').style.display = '';
        pagePosts.forEach((post) => {
            const link = createNavItem(post, 'page');
            DOM.pageNavItems.appendChild(link);
        });
    } else {
        document.getElementById('pageSection').style.display = 'none';
    }

    // 渲染 docs 类型文章
    DOM.docsNavItems.innerHTML = '';
    if (docsPosts.length > 0) {
        document.getElementById('docsSection').style.display = '';
        docsPosts.forEach((post) => {
            const link = createNavItem(post, 'docs');
            DOM.docsNavItems.appendChild(link);
        });
    } else {
        document.getElementById('docsSection').style.display = 'none';
    }

    // 高亮当前导航项
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

    // 如果有标签，添加小徽章
    if (post.tags && post.tags.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.textContent = post.tags[0];
        link.appendChild(badge);
    }

    return link;
}

function highlightCurrentNav() {
    // 移除所有活跃状态
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.remove('active');
    });

    // 高亮首页
    if (APP_STATE.currentRouteType === 'home') {
        const homeLink = document.querySelector('.home-link');
        if (homeLink) homeLink.classList.add('active');
        return;
    }

    // 高亮对应文章
    const activeItem = document.querySelector(
        `.nav-item[data-post-id="${CSS.escape(APP_STATE.currentPageId || '')}"]`
    );
    if (activeItem) {
        activeItem.classList.add('active');
        // 滚动到可见位置
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// ==================== 渲染内容区 ====================
function renderContent() {
    if (APP_STATE.currentRouteType === 'home') {
        renderHomePage();
    } else {
        const post = findCurrentPost();
        if (post) {
            renderArticle(post);
        } else {
            renderNotFound();
        }
    }

    // 更新移动端标题
    if (DOM.mobileTitle) {
        if (APP_STATE.currentRouteType === 'home') {
            DOM.mobileTitle.textContent = APP_STATE.postsData?.title || '博客';
        } else {
            const post = findCurrentPost();
            DOM.mobileTitle.textContent = post ? post.title : '未找到';
        }
    }
}

function renderHomePage() {
    if (!APP_STATE.postsData) return;

    const pagePosts = APP_STATE.postsData.posts.filter((p) => p.type === 'page');
    const docsPosts = APP_STATE.postsData.posts.filter((p) => p.type === 'docs');

    let html = `
                <div class="home-welcome">
                    <span class="welcome-emoji">👋</span>
                    <h2>${APP_STATE.postsData.title || '欢迎来到我的博客'}</h2>
                    <p style="color:#64748b;margin-top:0.3rem;">${APP_STATE.postsData.description || '记录学习与思考'}</p>
                </div>
            `;

    if (pagePosts.length > 0) {
        html += `<div class="section-label">📄 最新文章</div>`;
        html += `<div class="post-list">`;
        pagePosts
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .forEach((post) => {
                html += createPostListItem(post, 'page');
            });
        html += `</div>`;
    }

    if (docsPosts.length > 0) {
        html += `<div class="section-label">📚 文档</div>`;
        html += `<div class="post-list">`;
        docsPosts
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .forEach((post) => {
                html += createPostListItem(post, 'docs');
            });
        html += `</div>`;
    }

    if (pagePosts.length === 0 && docsPosts.length === 0) {
        html += `
                    <div style="text-align:center;padding:2rem;color:#94a3b8;">
                        <p>还没有文章，快去创建第一篇吧！</p>
                    </div>
                `;
    }

    DOM.contentContainer.innerHTML = html;

    // 绑定首页文章列表的点击事件
    DOM.contentContainer.querySelectorAll('.post-list-item').forEach((item) => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const path = this.dataset.path;
            const postId = this.dataset.postId;
            const type = this.dataset.type;
            navigateTo(path, postId, type);
        });
    });
}

function createPostListItem(post, type) {
    const path = type === 'page' ? `/page/${post.id}` : `/docs/${post.id.replace('docs/', '')}`;
    const dateStr = post.date ? formatDate(post.date) : '';
    const tagStr = post.tags && post.tags.length > 0 ? post.tags[0] : '';

    return `
                <a class="post-list-item" data-path="${path}" data-post-id="${post.id}" data-type="${type}" href="${path}">
                    <span class="post-title">${escapeHtml(post.title)}</span>
                    ${tagStr ? `<span class="post-tag">${escapeHtml(tagStr)}</span>` : ''}
                    ${dateStr ? `<span class="post-date">${dateStr}</span>` : ''}
                </a>
            `;
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
                </div>
            `;

    DOM.contentContainer.innerHTML = html;

    // 为文章内的链接添加处理（外部链接新窗口打开）
    DOM.contentContainer.querySelectorAll('.article-body a').forEach((link) => {
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
                    <p>抱歉，您查找的文章「<strong>${escapeHtml(APP_STATE.currentPageId || '')}</strong>」不存在。</p>
                    <p style="margin-top:1rem;">
                        <a href="/home" class="btn-home-inline" data-path="/home" data-type="home">← 返回首页</a>
                    </p>
                </div>
            `;

    // 绑定返回首页按钮
    const homeBtn = DOM.contentContainer.querySelector('.btn-home-inline');
    if (homeBtn) {
        homeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/home', null, 'home');
        });
    }
}

// ==================== Markdown 渲染 ====================
function renderMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') return '<p>（无内容）</p>';
    try {
        if (typeof marked !== 'undefined') {
            // 配置 marked
            if (typeof marked.setOptions === 'function') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                });
            }
            return marked.parse(markdown);
        } else {
            // 如果没有 marked，返回转义后的纯文本
            return '<pre>' + escapeHtml(markdown) + '</pre>';
        }
    } catch (err) {
        console.error('Markdown 渲染失败:', err);
        return '<pre>' + escapeHtml(markdown) + '</pre>';
    }
}

// ==================== 导航处理 ====================
function navigateTo(path, postId, routeType) {
    // 更新状态
    APP_STATE.currentPageId = postId;
    APP_STATE.currentRouteType = routeType;

    // 重新渲染
    renderContent();
    highlightCurrentNav();

    // 滚动到顶部
    DOM.mainContent.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 如果在 iframe 中，通知父页面更新 URL
    if (APP_STATE.isInIframe) {
        sendToParent({
            type: 'navigate',
            path: path,
        });
    }

    // 更新标题
    document.title = getPageTitle();
    if (APP_STATE.isInIframe) {
        sendToParent({
            type: 'setTitle',
            title: getPageTitle(),
        });
    }

    // 移动端关闭侧栏
    closeSidebar();

    // 搜索框清空
    if (DOM.searchInput) {
        DOM.searchInput.value = '';
        resetSearchFilter();
    }
}

// ==================== 事件绑定 ====================
function bindEvents() {
    // 侧栏导航链接点击
    DOM.navList.addEventListener('click', function(e) {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        e.preventDefault();

        const path = navItem.dataset.path;
        const postId = navItem.dataset.postId || null;
        const type = navItem.dataset.type || 'home';

        navigateTo(path, postId, type);
    });

    // 移动端汉堡菜单
    if (DOM.hamburgerBtn) {
        DOM.hamburgerBtn.addEventListener('click', toggleSidebar);
    }

    // 遮罩层点击关闭侧栏
    if (DOM.sidebarOverlay) {
        DOM.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // 搜索框输入
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce(handleSearch, 250));
    }

    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
        // ESC 关闭侧栏
        if (e.key === 'Escape') {
            closeSidebar();
        }
        // Ctrl/Cmd + K 聚焦搜索
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (DOM.searchInput) DOM.searchInput.focus();
        }
    });

    // 监听来自父页面（404.html）的消息（处理浏览器前进/后退）
    window.addEventListener('message', function(event) {
        if (event.origin !== window.location.origin) return;

        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'popstate') {
            // 父页面通知路由变化
            APP_STATE.currentPageId = data.pageParam;
            APP_STATE.currentRouteType = data.routeType || 'home';

            if (data.routeType === 'home') {
                APP_STATE.currentPageId = null;
                APP_STATE.currentRouteType = 'home';
            }

            renderContent();
            highlightCurrentNav();
            document.title = getPageTitle();

            // 滚动到顶部
            DOM.mainContent.scrollTop = 0;

            // 关闭移动端侧栏
            closeSidebar();
        }
    });

    // 窗口大小变化时，大屏自动关闭遮罩
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
}

// ==================== 侧栏切换（移动端） ====================
function toggleSidebar() {
    const isOpen = DOM.sidebar.classList.contains('open');
    if (isOpen) {
        closeSidebar();
    } else {
        openSidebar();
    }
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

// ==================== 搜索功能 ====================
function handleSearch() {
    const query = DOM.searchInput.value.trim().toLowerCase();

    if (!query) {
        resetSearchFilter();
        return;
    }

    // 过滤侧栏导航项
    const allNavItems = DOM.navList.querySelectorAll('.nav-item:not(.home-link)');
    allNavItems.forEach((item) => {
        const title = (item.textContent || '').toLowerCase();
        const postId = (item.dataset.postId || '').toLowerCase();
        if (title.includes(query) || postId.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // 高亮匹配的 section 标题
    updateSectionVisibility();
}

function resetSearchFilter() {
    const allNavItems = DOM.navList.querySelectorAll('.nav-item');
    allNavItems.forEach((item) => {
        item.style.display = '';
    });
    updateSectionVisibility();
}

function updateSectionVisibility() {
    const pageSection = document.getElementById('pageSection');
    const docsSection = document.getElementById('docsSection');

    if (pageSection) {
        const visibleItems = pageSection.querySelectorAll('.nav-item[style*="display:"]');
        const allHidden = pageSection.querySelectorAll('.nav-item').length === visibleItems.length &&
            visibleItems.length > 0;
        // 检查是否全部隐藏
        const totalItems = pageSection.querySelectorAll('.nav-item').length;
        const hiddenCount = pageSection.querySelectorAll('.nav-item[style="display: none;"]').length;
        pageSection.style.display = hiddenCount >= totalItems ? 'none' : '';
    }

    if (docsSection) {
        const totalItems = docsSection.querySelectorAll('.nav-item').length;
        const hiddenCount = docsSection.querySelectorAll('.nav-item[style="display: none;"]').length;
        docsSection.style.display = hiddenCount >= totalItems ? 'none' : '';
    }
}

// ==================== 回到顶部按钮 ====================
function setupBackToTop() {
    if (!DOM.backToTop) return;

    // 监听主内容区滚动
    DOM.mainContent.addEventListener('scroll', function() {
        if (DOM.mainContent.scrollTop > 400) {
            DOM.backToTop.classList.add('visible');
        } else {
            DOM.backToTop.classList.remove('visible');
        }
    });

    // 也监听窗口滚动
    window.addEventListener('scroll', function() {
        if (window.scrollY > 400) {
            DOM.backToTop.classList.add('visible');
        } else {
            DOM.backToTop.classList.remove('visible');
        }
    });

    DOM.backToTop.addEventListener('click', function() {
        DOM.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==================== 工具函数 ====================
function sendToParent(message) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, window.location.origin);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// CSS.escape 的 polyfill（用于安全的选择器）
if (!CSS.escape) {
    CSS.escape = function(value) {
        return String(value).replace(/([^\w-])/g, '\\$1');
    };
}

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', initApp);