> 这一层是**外层公用资源**：仓库根的基本页面（比如 `index.html`）和 `app/` 里的页面都能直接用。
> 路径在 `app/js/config.js` 的 `assets.shared` 配置，默认 `../assets`（相对 `app/` 根）。

| 文件 | 用途 | 尺寸 |
| --- | --- | --- |
| `favicon.svg` | 标签页图标，自带亮/暗两套配色（跟随系统） | 任意，建议方形 |
| `logo.svg` | 顶栏站点名左边的图标，用 `currentColor` 描边 | 24×24 视图框 |

## 换成自己的图

直接把同名文件替换掉即可，不用改代码。注意事项：

- `favicon.svg` 里用 `<style>` + `@media (prefers-color-scheme: dark)` 区分亮暗；不需要跟随就删掉这段，只留纯色版本
- 页面里的 `<link rel="icon">` 只是没有脚本时的兜底，`nav.js` 会按 `config.assets.favicons` 重新指一遍
- 站点内部才用的图（正文插图、头像、封面）放 `app/assets/`，别放这里

## 路径怎么写

| 谁引用 | 写法 |
| --- | --- |
| 仓库根的基本页面（`index.html` 等） | `assets/favicon.svg` |
| `app/` 里的页面（脚本里用 `C.assets.shared`） | `../assets/favicon.svg` |
| `app/pages/<页面>/` 里的页面（配置会自动补前缀） | `../../../assets/favicon.svg` |
