function wrapPage() {
  if (!isModernBrowser()) return;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';

  document.body.appendChild(iframe);

  iframe.src = `/app/?url=${window.location.pathname}`

  console.debug("基本页面确认升级，请求路径",iframe.src)

  iframe.onload = function () {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      // 获取完整 HTML 字符串
      const newHTML = doc.documentElement.outerHTML;

      document.open();
      document.write(newHTML);
      document.close();
    } catch (e) {
      console.warn('无法读取 iframe 内容', e);
    }
  };
}

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

function inFrame() {
  const urlParams = new URLSearchParams(window.location.search);
  const noLoad = urlParams.has("basic")
  if (!noLoad) {
    wrapPage();
  }
}

//inFrame()