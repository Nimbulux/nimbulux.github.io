# 代码高亮测试

```python
#!/usr/bin/env python3
"""
自动构建文章页面：
- 扫描 posts/ 目录，找到所有包含 page.md 和 info.json 的文章/项目目录
- 将 page.md 转为 HTML，用 build/head.html + <article> + build/end.html 包裹
- 复制文章目录下的其他文件到 pages/ 对应位置
- 生成全局文章列表 pages/list.json
- 为 posts/docs/ 下的每个项目生成独立的 pages/docs/项目X/list.json
- 若项目目录本身包含 page.md 和 info.json，作为项目首页，在全局列表中标记 type: "project"
"""
import json
import os
import shutil
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import markdown


# 路径配置（相对于仓库根目录）
POSTS_DIR = Path("posts")
OUTPUT_DIR = Path("pages")          # 所有页面输出到此
HEAD_PATH = Path("build/head.html")
END_PATH = Path("build/end.html")
DOCS_LIST_DIR = OUTPUT_DIR / "docs" # 项目列表的根目录，即 pages/docs

# 读取模板
head_html = HEAD_PATH.read_text(encoding="utf-8")
end_html = END_PATH.read_text(encoding="utf-8")

# Markdown 转换器
md = markdown.Markdown()

# 收集所有文章信息
all_articles = []                 # 元素: (article_dict, last_modified)
# 按项目分组的文章，key = 项目名，仅包含具体文章（不含项目首页）
project_articles = defaultdict(list)   # value: [(article_dict, last_modified), ...]


def calculate_reading_time(md_text: str) -> int:
    """简单按字符数估算阅读时长（分钟），最低 1 分钟"""
    chars = sum(1 for c in md_text if c.isalnum() or ord(c) > 127)
    return max(1, round(chars / 500))


def process_article(article_dir: Path):
    """处理单个文章/项目首页目录"""
    info_file = article_dir / "info.json"
    page_file = article_dir / "page.md"

    # 读取元数据
    with info_file.open("r", encoding="utf-8") as f:
        info = json.load(f)

    # 确定最后修改时间
    last_modified = info.get("updated") or info["date"]

    # 计算阅读时间（如果未提供）
    if "reading_time" not in info:
        md_content = page_file.read_text(encoding="utf-8")
        info["reading_time"] = calculate_reading_time(md_content)
    else:
        md_content = page_file.read_text(encoding="utf-8")

    # Markdown → HTML
    body_html = md.convert(md_content)
    full_html = f"{head_html}<article>{body_html}</article>{end_html}"

    # 计算相对于 posts/ 的路径
    relative_path = article_dir.relative_to(POSTS_DIR)  # 例如 "posts/技术/文章名" 或 "docs/项目X/大类/文章" 或 "docs/项目X"
    dest_dir = OUTPUT_DIR / relative_path
    dest_dir.mkdir(parents=True, exist_ok=True)

    # 写入 index.html
    (dest_dir / "index.html").write_text(full_html, encoding="utf-8")

    # 复制其他文件
    for item in article_dir.iterdir():
        if item.name in ("page.md", "info.json"):
            continue
        if item.is_file():
            shutil.copy2(item, dest_dir / item.name)
        elif item.is_dir():
            target = dest_dir / item.name
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)

    # 构建文章条目，添加网页路径
    article_entry = {
        **info,
        "path": f"/pages/{relative_path.as_posix()}/"
    }

    # 判断是否为项目首页（即 docs/项目X 本身，只有两级）
    parts = relative_path.parts
    is_project_home = len(parts) == 2 and parts[0] == "docs"

    if is_project_home:
        # 项目首页，标记类型
        article_entry["type"] = "project"
        # 只加入全局列表，不加入项目文章分组
        all_articles.append((article_entry, last_modified))
    else:
        # 普通文章，加入全局列表
        all_articles.append((article_entry, last_modified))
        # 如果属于 docs 下的某个项目，加入对应的项目分组
        if len(parts) >= 3 and parts[0] == "docs":
            project_name = parts[1]   # docs/项目X
            project_articles[project_name].append((article_entry, last_modified))


def main():
    # 清空旧的输出目录（pages 完全由脚本生成）
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 递归扫描 posts 目录
    for root, dirs, files in os.walk(POSTS_DIR):
        root_path = Path(root)
        if "page.md" in files and "info.json" in files:
            process_article(root_path)
            dirs.clear()   # 文章目录下不再深入

    # 按最后修改时间降序排序
    sort_key = lambda item: datetime.fromisoformat(item[1].replace("Z", "+00:00"))
    all_articles.sort(key=sort_key, reverse=True)
    for proj in project_articles:
        project_articles[proj].sort(key=sort_key, reverse=True)

    # 生成全局列表
    global_list = [entry for entry, _ in all_articles]
    (OUTPUT_DIR / "list.json").write_text(
        json.dumps(global_list, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    # 生成各项目文章列表（不含项目首页）
    DOCS_LIST_DIR.mkdir(parents=True, exist_ok=True)   # 其实就是 pages/docs
    for proj_name, articles in project_articles.items():
        proj_list = [entry for entry, _ in articles]
        list_dir = DOCS_LIST_DIR / proj_name
        list_dir.mkdir(parents=True, exist_ok=True)
        (list_dir / "list.json").write_text(
            json.dumps(proj_list, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    print(f"构建完成！总文章/页面数：{len(global_list)}")
    for proj_name, articles in project_articles.items():
        print(f"  - 项目 '{proj_name}'：{len(articles)} 篇文章")


if __name__ == "__main__":
    main()
```

```css
/* ===== 代码高亮颜色变量（亮色） ===== */
:root {
    --highlight-bg: #f6f8fa;
    --highlight-text: #24292e;
    --highlight-comment: #6a737d;
    --highlight-keyword: #d73a49;
    --highlight-string: #032f62;
    --highlight-number: #005cc5;
    --highlight-operator: #d73a49;
    --highlight-name: #6f42c1;
    --highlight-deleted: #b31d28;
    --highlight-inserted: #22863a;
    --highlight-heading: #6f42c1;
}

@media (prefers-color-scheme: dark) {
    :root {
        --highlight-bg: #1e1e1e;
        --highlight-text: #d4d4d4;
        --highlight-comment: #6a9955;
        --highlight-keyword: #569cd6;
        --highlight-string: #ce9178;
        --highlight-number: #b5cea8;
        --highlight-operator: #d4d4d4;
        --highlight-name: #dcdcaa;
        --highlight-deleted: #f44747;
        --highlight-inserted: #6a9955;
        --highlight-heading: #dcdcaa;
    }
}

/* 高亮代码块容器 */
article .highlight {
    background: var(--highlight-bg);
    border-radius: 6px;
    overflow-x: auto;
    margin: 1em 0;
    /* 确保不继承透明背景 */
}
article .highlight pre {
    background: var(--highlight-bg) !important;  /* 覆盖普通透明背景 */
    padding: 15px;
    margin: 0;
    border-radius: 6px;
}
article .highlight code {
    background: none;
    padding: 0;
    color: var(--highlight-text);
}

/* Pygments / pymdownx 通用类名样式 */
.highlight .c   { color: var(--highlight-comment); font-style: italic; }  /* 注释 */
.highlight .k   { color: var(--highlight-keyword); font-weight: bold; }   /* 关键字 */
.highlight .kc  { color: var(--highlight-keyword); }
.highlight .kd  { color: var(--highlight-keyword); }
.highlight .kn  { color: var(--highlight-keyword); }
.highlight .kp  { color: var(--highlight-keyword); }
.highlight .kr  { color: var(--highlight-keyword); }
.highlight .kt  { color: var(--highlight-keyword); }
.highlight .s   { color: var(--highlight-string); }                      /* 字符串 */
.highlight .s2  { color: var(--highlight-string); }
.highlight .se  { color: var(--highlight-string); }
.highlight .sh  { color: var(--highlight-string); }
.highlight .si  { color: var(--highlight-string); }
.highlight .sx  { color: var(--highlight-string); }
.highlight .sr  { color: var(--highlight-string); }
.highlight .s1  { color: var(--highlight-string); }
.highlight .ss  { color: var(--highlight-string); }
.highlight .m   { color: var(--highlight-number); }                      /* 数字 */
.highlight .mi  { color: var(--highlight-number); }
.highlight .mf  { color: var(--highlight-number); }
.highlight .mh  { color: var(--highlight-number); }
.highlight .o   { color: var(--highlight-operator); }                    /* 操作符 */
.highlight .ow  { color: var(--highlight-operator); }
.highlight .n   { color: var(--highlight-name); }                        /* 名称 */
.highlight .na  { color: var(--highlight-name); }
.highlight .nb  { color: var(--highlight-name); }
.highlight .nc  { color: var(--highlight-name); font-weight: bold; }
.highlight .no  { color: var(--highlight-name); }
.highlight .nd  { color: var(--highlight-name); }
.highlight .ni  { color: var(--highlight-name); }
.highlight .ne  { color: var(--highlight-name); }
.highlight .nf  { color: var(--highlight-name); }
.highlight .nl  { color: var(--highlight-name); }
.highlight .nn  { color: var(--highlight-name); }
.highlight .nt  { color: var(--highlight-name); }
.highlight .nv  { color: var(--highlight-name); }
.highlight .vc  { color: var(--highlight-name); }
.highlight .vg  { color: var(--highlight-name); }
.highlight .vi  { color: var(--highlight-name); }
.highlight .il  { color: var(--highlight-number); }
.highlight .gd  { color: var(--highlight-deleted); }                     /* 删除 */
.highlight .gi  { color: var(--highlight-inserted); }                    /* 插入 */
.highlight .gh  { color: var(--highlight-heading); font-weight: bold; }
.highlight .gu  { color: var(--highlight-comment); }
```
