function loadPageFrame() {
  const urlParams = new URLSearchParams(window.location.search);
  const myUrl = urlParams.get('url');

  loadArticleIntoIframe(myUrl,pageFrame)
}

function loadArticleIntoIframe(url, iframeId) {
  var iframe = document.getElementById(iframeId);
  if (!iframe) {
    console.error('iframe not found');
    return;
  }

  // 同步请求（阻塞，可以等待）
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);  // false 表示同步
  try {
    xhr.send(null);
    if (xhr.status !== 200) {
      iframe.srcdoc = '<p>加载失败，状态码：' + xhr.status + '</p>';
      return;
    }
  } catch (e) {
    iframe.srcdoc = '<p>网络错误或跨域限制</p>';
    return;
  }

  var htmlText = xhr.responseText;

  // 解析 HTML
  var parser = new DOMParser();
  var doc = parser.parseFromString(htmlText, 'text/html');
  var article = doc.querySelector('article');

  if (!article) {
    iframe.srcdoc = '<p>未找到 <article> 元素</p>';
    return;
  }

  // 构建完整文档
  var fullDoc = '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head>\n' +
    '<base href="' + url + '">\n' +
    '<meta charset="utf-8">\n' +
    '<style>\n' +
    'body { margin: 2rem auto; max-width: 800px; font-family: system-ui, sans-serif; line-height: 1.6; }\n' +
    'img { max-width: 100%; height: auto; }\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    article.outerHTML + '\n' +
    '</body>\n' +
    '</html>';

  iframe.srcdoc = fullDoc;
}