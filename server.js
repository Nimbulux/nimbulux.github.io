const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0]; // 去除 query
  let filePath = path.join(ROOT, urlPath);
  if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  // 检查文件是否存在
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // 文件不存在 → 返回 404.html 内容（状态码 404）
      const notFoundPath = path.join(ROOT, '404.html');
      fs.readFile(notFoundPath, (err, data) => {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(data || 'Not Found');
      });
    } else {
      // 文件存在 → 正常返回
      const ext = path.extname(filePath);
      const mimeType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mimeType });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ 本地测试服务器运行在 http://localhost:${PORT}`);
  console.log('   现在可以访问 /home、/page/xxx 等路由了');
});