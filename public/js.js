function wrapPage() {
  var targetUrl = encodeURIComponent(window.location.href);
  var fullShellUrl = '/app/?url=' + targetUrl;

  var shellFrame = document.createElement('iframe');
  shellFrame.style.display = 'none';
  shellFrame.src = fullShellUrl;
  document.body.appendChild(shellFrame);

  shellFrame.onload = function () {
    try {
      var shellDoc = shellFrame.contentDocument || shellFrame.contentWindow.document;
      // 序列化完整的 HTML（含 DOCTYPE）
      var shellHTML = '<!DOCTYPE html>' + shellDoc.documentElement.outerHTML;
      document.open();
      document.write(shellHTML);
      document.close();
    } catch (e) {
      console.error('外壳替换失败 :\n', e);
    }
  };

  shellFrame.onerror = function () {
    console.error('外壳页面加载失败');
  };
}

if (window.parent === window) {
    wrapPage();
}