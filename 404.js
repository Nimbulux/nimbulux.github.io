document.getElementById("pathShow").textContent = location.pathname;

const switcher = document.getElementById('themeSwitcher');
const toggleBtn = document.getElementById('themeToggleBtn');
const menu = document.getElementById('themeMenu');
const options = document.querySelectorAll('.theme-option');
const html = document.documentElement;

// ---------- 展开 / 折叠逻辑 ----------
function closeMenu() {
    switcher.classList.remove('theme-switcher--open');
}

function toggleMenu() {
    switcher.classList.toggle('theme-switcher--open');
}

toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
});

// 点击页面其他地方关闭菜单
document.addEventListener('click', (e) => {
    if (!switcher.contains(e.target)) {
    closeMenu();
    }
});

// 按 ESC 关闭
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
});

// ---------- 应用主题逻辑 ----------
function applyTheme(mode) {
    if (mode === 'auto') {
    html.removeAttribute('data-theme');
    } else {
    html.setAttribute('data-theme', mode);
    }
    localStorage.setItem('theme-preference', mode);
    updateActiveOption(mode);
}

function updateActiveOption(mode) {
    options.forEach(opt => {
    opt.classList.remove('active');
    if (opt.dataset.theme === mode) {
        opt.classList.add('active');
    }
    });
}

// 选项点击事件
options.forEach(opt => {
    opt.addEventListener('click', () => {
    const mode = opt.dataset.theme;
    applyTheme(mode);
    closeMenu();   // 选择后自动收起菜单
    });
});