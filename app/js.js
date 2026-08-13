function loadPageFrame() {
  const urlParams = new URLSearchParams(window.location.search);
  const myUrl = urlParams.get('url') + "?basic";

  console.debug("外壳组装请求路径",myUrl)

  extractArticlesToIframe(myUrl,pageFrame)
}

/**
 * 提取目标页面中所有 <article> 内容，并渲染到指定 iframe 中
 * @param {string} url - 目标页面 URL（必须与当前页面同源）
 * @param {string|HTMLIFrameElement} [targetIframeSelector] - 目标 iframe 的选择器或元素，省略则自动创建
 */
function extractArticlesToIframe(url, targetIframeSelector) {
  // 1. 获取或创建目标 iframe
  let targetIframe;
  if (typeof targetIframeSelector === 'string') {
    targetIframe = document.querySelector(targetIframeSelector);
  } else if (targetIframeSelector instanceof HTMLIFrameElement) {
    targetIframe = targetIframeSelector;
  }

  if (!targetIframe) {
    targetIframe = document.createElement('iframe');
    targetIframe.style.width = '100%';
    targetIframe.style.height = '500px';
    targetIframe.style.border = '1px solid #ccc';
    document.body.appendChild(targetIframe);
  }

  // 2. 创建隐藏 iframe 用于加载源页面
  const hiddenIframe = document.createElement('iframe');
  hiddenIframe.style.display = 'none';
  hiddenIframe.src = url;
  document.body.appendChild(hiddenIframe);

  // 3. 清理函数
  function cleanup() {
    if (hiddenIframe.parentNode) {
      hiddenIframe.parentNode.removeChild(hiddenIframe);
    }
  }

  // 4. 显示错误信息
  function showError(reason) {
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>加载错误</title>
  <style>
    body { font-family: sans-serif; padding: 20px; color: #333; }
    h1 { color: #c00; }
    .reason {
      background: #fdd;
      padding: 10px;
      border: 1px solid #f99;
      border-radius: 4px;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <h1>加载错误</h1>
  <div class="reason">${reason}</div>
</body>
</html>`;
    targetIframe.srcdoc = errorHtml;
    cleanup();
  }

  // 5. 显示提取的内容
  function showContent(html) {
    const contentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>提取内容</title>
  <style>
    body { font-family: sans-serif; padding: 20px; color: #333; }
    article { margin-bottom: 20px; padding: 10px; border-bottom: 1px solid #ddd; }
    hr { border: none; border-top: 2px dashed #ccc; margin: 20px 0; }
  </style>
</head>
<body>${html}</body>
</html>`;
    targetIframe.srcdoc = contentHtml;
    cleanup();
  }

  // 6. 监听隐藏 iframe 的加载完成事件
  hiddenIframe.addEventListener('load', function () {
    try {
      const doc = hiddenIframe.contentDocument || hiddenIframe.contentWindow.document;
      const articles = doc.querySelectorAll('article');

      if (articles.length === 0) {
        showContent('<p>未找到 &lt;article&gt; 标签。</p>');
        return;
      }

      let html = '';
      articles.forEach((article, index) => {
        if (index > 0) html += '<hr>'; // 多个 article 之间添加分隔线
        html += article.outerHTML;
      });

      showContent(html);
    } catch (e) {
      showError('无法访问目标页面内容：' + e.message + '（可能是跨域限制）');
    }
  });

  // 7. 监听隐藏 iframe 的加载错误事件（网络错误、资源不存在等）
  hiddenIframe.addEventListener('error', function () {
    showError('无法加载目标页面：网络错误或资源不存在。');
  });
}

loadPageFrame()