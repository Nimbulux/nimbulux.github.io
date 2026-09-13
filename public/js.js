function isModernBrowser() {
  // 检测 CSS 能力（使用 CSS.supports）
  const supportsFlex = CSS.supports('display', 'flex');
  const supportsGrid = CSS.supports('display', 'grid');
  const supportsVars = CSS.supports('--test', '0');

  // 检测 ES6 语法支持（不能直接用箭头函数测试，可用 new Function）
  let supportsArrow = false;
  try {
    new Function('() => {}');
    supportsArrow = true;
  } catch (e) {}

  let supportsConst = false;
  try {
    eval('"use strict"; const x = 1;');
    supportsConst = true;
  } catch (e) {}

  // 检测关键 API
  const supportsPromise = typeof Promise === 'function';
  const supportsFetch = typeof fetch === 'function';

  return (
    supportsFlex &&
    supportsGrid &&
    supportsVars &&
    supportsArrow &&
    supportsConst &&
    supportsPromise &&
    supportsFetch
  );
}

function upNewPage() {
  const url = new URL(window.location.href);
  return !url.searchParams.has('basic');
}

if (upNewPage()) {
  if (isModernBrowser()) {
    const src = `/app/docs/article?path={window.location.pathname.replace("/pages/","/")}`;
    window.location.replace(src.toString());
  }
} else {
  document.querySelectorAll('a[href]').forEach(link => {
  const href = link.getAttribute('href');
  if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) return;

  const url = new URL(href, window.location.origin);
  if (!url.searchParams.has('xxx')) {
    url.search = url.search ? url.search + '&xxx' : '?xxx';
  }
  link.setAttribute('href', url.pathname + url.search + url.hash);
});
}