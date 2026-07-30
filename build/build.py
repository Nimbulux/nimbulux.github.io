#!/usr/bin/env python3
"""
静态站点生成器（支持混合目录）
- 纯文章目录 -> page.html
- 纯容器目录 -> home.html (或 dir.html) + 返回上层链接
- 混合目录   -> detail.html (上方文章，下方子项列表)
"""

import json
import shutil
from datetime import datetime
from pathlib import Path

import markdown

# ========== 路径配置 ==========
POSTS_DIR = Path("posts")
OUTPUT_DIR = Path("pages")
TEMPLATES_DIR = Path("build")

PAGE_TEMPLATE_PATH = TEMPLATES_DIR / "page.html"
HOME_TEMPLATE_PATH = TEMPLATES_DIR / "home.html"
DETAIL_TEMPLATE_PATH = TEMPLATES_DIR / "detail.html"   # 混合目录模板

INDEX_OUTPUT_PATH = Path("index.html")

# ========== Markdown 转换器 ==========
md = markdown.Markdown(
    extensions=['pymdownx.highlight', 'pymdownx.superfences'],
    extension_configs={
        'pymdownx.highlight': {
            'css_class': 'highlight',
            'linenums': True,
            'linenums_style': 'table',
        }
    }
)

# ========== 工具函数 ==========
def calculate_reading_time(md_text: str) -> int:
    chars = sum(1 for c in md_text if c.isalnum() or ord(c) > 127)
    return max(1, round(chars / 500))


def parse_article_info(article_dir: Path) -> dict:
    """读取 info.json 并补全阅读时间"""
    with (article_dir / "info.json").open("r", encoding="utf-8") as f:
        info = json.load(f)
    if "reading_time" not in info or not info["reading_time"]:
        md_text = (article_dir / "page.md").read_text(encoding="utf-8")
        info["reading_time"] = calculate_reading_time(md_text)
    return info


def build_tree(current_dir: Path, relative_path: Path) -> dict:
    """
    递归构建树节点，返回当前目录对应的节点字典。
    节点类型：
      - "article"   : 纯文章
      - "directory" : 纯目录
      - "mixed"     : 混合目录
    """
    has_page = (current_dir / "page.md").exists() and (current_dir / "info.json").exists()
    children = []

    for entry in sorted(current_dir.iterdir()):
        if entry.is_dir() and not entry.name.startswith('.'):
            child_rel = relative_path / entry.name
            child_node = build_tree(entry, child_rel)
            children.append(child_node)

    if has_page:
        info = parse_article_info(current_dir)
        if children:
            node = {
                "name": current_dir.name if current_dir != POSTS_DIR else "Home",
                "type": "mixed",
                "relative_path": relative_path.as_posix(),
                "info": info,
                "children": children,
            }
        else:
            node = {
                "name": current_dir.name,
                "type": "article",
                "relative_path": relative_path.as_posix(),
                "info": info,
            }
    else:
        node = {
            "name": current_dir.name if current_dir != POSTS_DIR else "Home",
            "type": "directory",
            "relative_path": relative_path.as_posix(),
            "children": children,
        }
    return node


def sort_tree(node: dict):
    """排序：目录在前，文章/mixed 在后（按日期降序）"""
    if node["type"] == "article":
        return
    # 对 children 排序
    node["children"].sort(key=lambda child: (
        0 if child["type"] == "directory" else 1,
        child.get("name", "") if child["type"] == "directory" else (
            -datetime.fromisoformat(
                child.get("info", {}).get("date", "1970-01-01").replace("Z", "+00:00")
            ).timestamp()
        )
    ))
    for child in node["children"]:
        sort_tree(child)


# ========== 页面生成 ==========
def generate_article_html(article_dir: Path) -> str:
    """将 page.md 转换为 HTML，并用 page.html 包裹"""
    md_content = (article_dir / "page.md").read_text(encoding="utf-8")
    body = md.convert(md_content)
    if PAGE_TEMPLATE_PATH.exists():
        template = PAGE_TEMPLATE_PATH.read_text(encoding="utf-8")
        if "$$$===REPLACE===$$$" in template:
            return template.replace("$$$===REPLACE===$$$", body)
        print(f"⚠ 警告：{PAGE_TEMPLATE_PATH} 缺少占位符")
    return body


def build_children_list_html(node: dict) -> str:
    """
    为目录页构建子项列表 HTML 片段。
    非根目录时会自动添加“返回上层目录”链接。
    """
    parts = []
    rel = node["relative_path"]
    # 返回上层链接（根目录除外）
    if rel != "":
        parent_rel = Path(rel).parent
        if parent_rel == Path(".") or parent_rel.as_posix() == "":
            parent_url = "/"
        else:
            parent_url = f"/pages/{parent_rel.as_posix()}/"
        parts.append(f'<p><a href="{parent_url}">[B] 返回上层目录</a></p>')

    if node.get("children"):
        items = "<ul>\n"
        for child in node["children"]:
            url = f"/pages/{child['relative_path']}/"
            if child["type"] == "directory":
                label = child["name"]
            else:
                label = child.get("info", {}).get("title", child["name"])
            items += f'  <li><a href="{url}">{label}</a></li>\n'
        items += "</ul>"
        parts.append(items)
    else:
        parts.append("<p>此目录下暂无内容。</p>")
    return "\n".join(parts)


def render_directory_page(node: dict, output_html_path: Path, output_list_path: Path):
    """
    渲染纯目录页面（使用 home/dir 模板）
    """
    content = build_children_list_html(node)

    template_path = HOME_TEMPLATE_PATH
    if template_path.exists():
        template = template_path.read_text(encoding="utf-8")
        if "$$$===REPLACE===$$$" in template:
            html = template.replace("$$$===REPLACE===$$$", content)
        else:
            print(f"⚠ 警告：{template_path} 缺少占位符")
            html = content
    else:
        html = f"<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>{content}</body></html>"

    output_html_path.parent.mkdir(parents=True, exist_ok=True)
    output_html_path.write_text(html, encoding="utf-8")

    # 写入 list.json（嵌套子节点数据）
    output_list_path.write_text(
        json.dumps(node.get("children", []), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def render_mixed_page(node: dict, output_html_path: Path, output_list_path: Path):
    """
    渲染混合目录页面（使用 detail.html）
    """
    article_dir = POSTS_DIR / node["relative_path"]
    article_body = md.convert((article_dir / "page.md").read_text(encoding="utf-8"))
    list_html = build_children_list_html(node)

    if DETAIL_TEMPLATE_PATH.exists():
        template = DETAIL_TEMPLATE_PATH.read_text(encoding="utf-8")
        html = template.replace("$$$===REPLACE_PAGE===$$$", article_body)
        html = html.replace("$$$===REPLACE_PATH===$$$", list_html)
    else:
        # 简易回退
        html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{node['info']['title']}</title></head><body>{article_body}<hr>{list_html}</body></html>"
        print(f"⚠ 警告：{DETAIL_TEMPLATE_PATH} 不存在，使用简易回退")

    output_html_path.parent.mkdir(parents=True, exist_ok=True)
    output_html_path.write_text(html, encoding="utf-8")

    # list.json 仍然包含子项信息
    output_list_path.write_text(
        json.dumps(node.get("children", []), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def render_article_page(node: dict, output_dir: Path):
    """渲染纯文章页面，复制附件"""
    src_dir = POSTS_DIR / node["relative_path"]
    html = generate_article_html(src_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "index.html").write_text(html, encoding="utf-8")

    # 复制附件（排除 page.md 和 info.json）
    for item in src_dir.iterdir():
        if item.name in ("page.md", "info.json"):
            continue
        if item.is_file():
            shutil.copy2(item, output_dir / item.name)
        elif item.is_dir():
            target = output_dir / item.name
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)


def generate_site(node: dict):
    """递归生成整个站点"""
    rel = node["relative_path"]
    if rel == "":
        # 根目录：index.html 和 pages/list.json
        out_html = INDEX_OUTPUT_PATH
        out_list = OUTPUT_DIR / "list.json"
    else:
        out_dir = OUTPUT_DIR / rel
        out_html = out_dir / "index.html"
        out_list = out_dir / "list.json"

    if node["type"] == "directory":
        render_directory_page(node, out_html, out_list)
        for child in node.get("children", []):
            generate_site(child)
    elif node["type"] == "mixed":
        render_mixed_page(node, out_html, out_list)
        for child in node.get("children", []):
            generate_site(child)
    else:  # article
        out_dir = OUTPUT_DIR / rel
        render_article_page(node, out_dir)
        # 纯文章节点无需递归（无子节点）


# ========== 主流程 ==========
def main():
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not POSTS_DIR.exists():
        print("❌ 错误：posts 目录不存在！")
        return

    # 构建目录树
    root_node = build_tree(POSTS_DIR, Path(""))
    sort_tree(root_node)

    # 生成全部页面
    generate_site(root_node)

    # 统计
    def count_articles(n):
        if n["type"] == "article":
            return 1
        elif n["type"] == "mixed":
            return 1 + sum(count_articles(c) for c in n.get("children", []))
        elif n["type"] == "directory":
            return sum(count_articles(c) for c in n.get("children", []))
        return 0

    total = count_articles(root_node)
    print(f"✅ 构建完成！总文章数：{total}")
    print(f"  首页     → {INDEX_OUTPUT_PATH}")
    print(f"  全局列表 → {OUTPUT_DIR / 'list.json'}")


if __name__ == "__main__":
    main()