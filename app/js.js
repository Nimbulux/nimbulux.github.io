(function() {
  var params = new URLSearchParams(window.location.search);
  var targetUrl = params.get('url');
  if (targetUrl) {
    var iframe = document.getElementById('pageIframe');
    if (iframe) {
      iframe.src = decodeURIComponent(targetUrl);
      // 可选：加载后隐藏非 article 内容（同源下可以操作 iframe 内部 DOM）
      iframe.onload = function() {
        try {
          var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
          // 只显示 <article>，隐藏其余元素（根据你的实际需求调整）
          var allChildren = Array.from(innerDoc.body.children);
          allChildren.forEach(function(el) {
            if (el.tagName !== 'ARTICLE') {
              el.style.display = 'none';
            }
          });
        } catch(e) {}
      };
    }
  }
})();