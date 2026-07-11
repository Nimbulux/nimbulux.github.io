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
OUTPUT_DIR = Path("app/posts")
HEAD_PATH = Path("build/head.html")
END_PATH = Path("build/end.html")
DOCS_LIST_DIR = Path("app/docs")

# 读取模板
head_html = HEAD_PATH.read_text(encoding="utf-8")
end_html = END_PATH.read_text(encoding="utf-8")

# Markdown 转换器
md = markdown.Markdown()

# 收集所有文章信息
all_articles = []                 # 元素: (article_dict, last_modified)
# 按项目分组的文章，key = 项目名（例如 "项目X"）
project_articles = defaultdict(list)   # value: [(article_dict, last_modified), ...]


def calculate_reading_time(md_text: str) -> int:
    """简单按字符数估算阅读时长（分钟），最低 1 分钟"""
    chars = sum(1 for c in md_text if c.isalnum() or ord(c) > 127)
    return max(1, round(chars / 500))


def process_article(article_dir: Path):
    """处理单个文章目录"""
    info_file = article_dir / "info.json"
    page_file = article_dir / "page.md"

    # 读取元数据
    with info_file.open("r", encoding="utf-8") as f:
        info = json.load(f)

    # 确定最后修改时间
    last_modified = info.get("updated") or info["date"]

    # 计算阅读时间（如果未提供）
    if "reading_time" not in info or not info["reading_time"]:
        md_content = page_file.read_text(encoding="utf-8")
        info["reading_time"] = calculate_reading_time(md_content)
    else:
        md_content = page_file.read_text(encoding="utf-8")

    # Markdown → HTML
    body_html = md.convert(md_content)
    full_html = f"{head_html}<article>{body_html}</article>{end_html}"

    # 计算相对于 posts/ 的路径
    relative_path = article_dir.relative_to(POSTS_DIR)  # 如 "posts/技术/文章名" 或 "docs/项目X/教程/文章名"
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

    # 构建文章条目
    article_entry = {
        **info,
        "path": f"/app/posts/{relative_path.as_posix()}/"
    }

    all_articles.append((article_entry, last_modified))

    # 检查是否属于 docs 下的某个项目
    # relative_path 的第一级可能是 "posts" 或 "docs"
    parts = relative_path.parts
    if len(parts) >= 2 and parts[0] == "docs":
        project_name = parts[1]   # docs/项目X
        project_articles[project_name].append((article_entry, last_modified))


def main():
    # 清空旧输出
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 清空旧的 docs 列表目录（可选，防止残留旧项目）
    if DOCS_LIST_DIR.exists():
        shutil.rmtree(DOCS_LIST_DIR)
    DOCS_LIST_DIR.mkdir(parents=True, exist_ok=True)

    # 递归扫描 posts 目录
    for root, dirs, files in os.walk(POSTS_DIR):
        root_path = Path(root)
        if "page.md" in files and "info.json" in files:
            process_article(root_path)
            dirs.clear()   # 文章目录下不再深入

    # 按时间降序排序
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

    # 生成各项目列表
    for proj_name, articles in project_articles.items():
        proj_list = [entry for entry, _ in articles]
        list_dir = DOCS_LIST_DIR / proj_name
        list_dir.mkdir(parents=True, exist_ok=True)
        (list_dir / "list.json").write_text(
            json.dumps(proj_list, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    print(f"构建完成！总文章数：{len(global_list)}")
    for proj_name, articles in project_articles.items():
        print(f"  - 项目 '{proj_name}'：{len(articles)} 篇文章")


if __name__ == "__main__":
    main()