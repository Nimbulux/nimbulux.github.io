#!/usr/bin/env python3

import json
import os
import shutil
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import markdown

# 路径配置（相对于仓库根目录）
POSTS_DIR = Path("posts")
OUTPUT_DIR = Path("pages")
PAGE_TEMPLATE_PATH = Path("build/page.html")   # 文章包裹模板
HOME_TEMPLATE_PATH = Path("build/home.html")   # 首页模板
INDEX_OUTPUT_PATH = Path("index.html")         # 生成的首页
DOCS_LIST_DIR = OUTPUT_DIR / "docs"

# Markdown 转换器
md = markdown.Markdown(
    extensions=['pymdownx.highlight', 'pymdownx.superfences'],
    extension_configs={
        'pymdownx.highlight': {
            'css_class': 'highlight',
            'linenums': True,           # 启用行号
            'linenums_style': 'table',  # 或 'pymdownx-inline'
        }
    }
)

# 收集所有文章信息
all_articles = []                 # 元素: (article_dict, last_modified)
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

    # 读取文章 Markdown 正文
    md_content = page_file.read_text(encoding="utf-8")

    # 计算阅读时间（如果未提供）
    if "reading_time" not in info or not info["reading_time"]:
        info["reading_time"] = calculate_reading_time(md_content)

    # Markdown → HTML
    body_html = md.convert(md_content)

    # 使用 page.html 模板包裹正文
    if PAGE_TEMPLATE_PATH.exists():
        template = PAGE_TEMPLATE_PATH.read_text(encoding="utf-8")
        if "$$$===REPLACE===$$$" in template:
            full_html = template.replace("$$$===REPLACE===$$$", body_html)
        else:
            print(f"警告：{PAGE_TEMPLATE_PATH} 中未找到占位符，正文将不会被包裹")
            full_html = body_html
    else:
        print(f"警告：未找到文章模板 {PAGE_TEMPLATE_PATH}，使用未包裹的正文")
        full_html = body_html

    # 计算相对于 posts/ 的路径
    relative_path = article_dir.relative_to(POSTS_DIR)
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

    # 判断是否为项目首页
    parts = relative_path.parts
    is_project_home = len(parts) == 2 and parts[0] == "docs"

    if is_project_home:
        article_entry["type"] = "project"
        all_articles.append((article_entry, last_modified))
    else:
        all_articles.append((article_entry, last_modified))
        if len(parts) >= 3 and parts[0] == "docs":
            project_name = parts[1]
            project_articles[project_name].append((article_entry, last_modified))


def main():
    # 清空旧的输出目录
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

    # 生成各项目文章列表
    DOCS_LIST_DIR.mkdir(parents=True, exist_ok=True)
    for proj_name, articles in project_articles.items():
        proj_list = [entry for entry, _ in articles]
        list_dir = DOCS_LIST_DIR / proj_name
        list_dir.mkdir(parents=True, exist_ok=True)
        (list_dir / "list.json").write_text(
            json.dumps(proj_list, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    # ---------- 生成首页 ----------
    if HOME_TEMPLATE_PATH.exists():
        home_template = HOME_TEMPLATE_PATH.read_text(encoding="utf-8")
        # 将文章列表打包为 <a> 链接
        links_html = "<ul>\n"
        for entry in global_list:
            links_html += f'  <li><a href="{entry["path"]}">{entry["title"]}</a></li>\n'
        links_html += "</ul>"

        if "$$$===REPLACE===$$$" in home_template:
            home_page = home_template.replace("$$$===REPLACE===$$$", links_html)
        else:
            print("警告：home.html 中未找到占位符，将直接使用原模板输出")
            home_page = home_template

        INDEX_OUTPUT_PATH.write_text(home_page, encoding="utf-8")
        print("首页已生成 -> index.html")
    else:
        print(f"警告：未找到首页模板 {HOME_TEMPLATE_PATH}，跳过首页生成")

    print(f"构建完成！总文章/页面数：{len(global_list)}")
    for proj_name, articles in project_articles.items():
        print(f"  - 项目 '{proj_name}'：{len(articles)} 篇文章")


if __name__ == "__main__":
    main()