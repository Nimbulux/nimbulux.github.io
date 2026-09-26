#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import configparser
import html
import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

# addition
import markdown2

BUILD_DIR = Path(__file__).resolve().parent


# ============================================================
#  markdown2 配置
# ============================================================
MARKDOWN_EXTRAS = [
    'fenced-code-blocks',   # ```lang 代码块
    'tables',               # 表格
    'strike',               # ~~删除线~~
    'cuddled-lists',        # 紧贴段落的列表
    'header-ids',           # 标题自动加 id
    'task_list',            # - [x] 任务列表
    'break-on-newline',     # 单换行 → <br>，与原行为一致
]


def render_markdown(text):
    """把 Markdown 渲染成 HTML 4.01 兼容片段。"""
    out = markdown2.markdown(text, extras=MARKDOWN_EXTRAS)
    return out.replace(' />', '>')


def strip_leading_title(html_text, title):
    """如果正文开头的第一个 <h1> 与页面标题重复，就删掉它。"""
    if not title:
        return html_text
    m = re.match(r'\s*<h1\b[^>]*>(.*?)</h1>\s*', html_text, re.S)
    if not m:
        return html_text
    inner = re.sub(r'<[^>]+>', '', m.group(1))
    inner = html.unescape(inner).strip()
    if inner == title.strip():
        return html_text[m.end():]
    return html_text


# ============================================================
#  config.ini
# ============================================================
def load_config():
    cp = configparser.RawConfigParser()
    cp.read(str(BUILD_DIR / 'config.ini'), encoding='utf-8')
    site  = dict(cp['site'])  if 'site'  in cp else {}
    paths = dict(cp['paths']) if 'paths' in cp else {}
    build = dict(cp['build']) if 'build' in cp else {}
    return site, paths, build


# ============================================================
#  小工具
# ============================================================
def esc(s):
    return html.escape('' if s is None else str(s), quote=True)


def to_time(v):
    if not v:
        return float('-inf')
    s = str(v).strip()
    if not s:
        return float('-inf')
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
    except ValueError:
        pass
    for fmt in ('%Y/%m/%d', '%Y.%m.%d', '%Y-%m-%d %H:%M:%S', '%Y年%m月%d日'):
        try:
            return datetime.strptime(s, fmt).timestamp()
        except ValueError:
            continue
    return float('-inf')


def render_template(tpl, variables):
    return re.sub(
        r'\{\{([A-Z_]+)\}\}',
        lambda m: str(variables.get(m.group(1), '')),
        tpl,
    )


# ============================================================
#  head 片段
# ============================================================
def build_meta_block(o):
    e = esc
    return '\n'.join([
        '<meta name="description" content="%s">' % e(o['description']),
        '<meta property="og:site_name" content="%s">' % e(o['site_name']),
        '<meta property="og:type" content="website">',
        '<meta property="og:locale" content="%s">' % e(o['locale']),
        '<meta property="og:title" content="%s">' % e(o['title']),
        '<meta property="og:description" content="%s">' % e(o['description']),
        '<meta property="og:url" content="%s">' % e(o['canonical']),
        '<meta property="og:image" content="%s">' % e(o['favicon']),
        '<meta name="twitter:card" content="summary">',
        '<meta name="twitter:title" content="%s">' % e(o['title']),
        '<meta name="twitter:description" content="%s">' % e(o['description']),
        '<meta name="twitter:image" content="%s">' % e(o['favicon']),
        '<link rel="canonical" href="%s">' % e(o['canonical']),
    ])


def build_head_links(site):
    favicon = (site.get('favicon') or '').strip()
    if not favicon:
        return ''
    return '<link rel="icon" type="image/jpeg" href="%s">' % esc(favicon)


# ============================================================
#  面包屑（独占导航）
# ============================================================
def build_breadcrumb(rel_dir, ctx):
    """整条面包屑都由这里输出，模板不再自己拼首页链接。

    根目录 → <span>首页</span>
    子目录 → <a>首页</a> &gt; ... &gt; <span>当前</span>
    """
    home_url   = ctx['home_url']
    home_label = esc(ctx['site'].get('home_label') or '首页')

    if not rel_dir:
        return '<span>%s</span>' % home_label

    parts = ['<a href="%s">%s</a>' % (home_url, home_label)]
    segs = rel_dir.split('/')
    acc = ''
    for idx, name in enumerate(segs):
        acc = (acc + '/' + name) if acc else name
        if idx == len(segs) - 1:
            parts.append('<span>%s</span>' % esc(name))
        else:
            parts.append('<a href="%s%s/">%s</a>' % (home_url, esc(acc), esc(name)))

    return ' &gt; '.join(parts)


# ============================================================
#  递归构建
# ============================================================
def build_folder(rel_dir, ctx):
    posts_root = ctx['posts_root']
    abs_dir    = posts_root / rel_dir if rel_dir else posts_root

    if not abs_dir.is_dir():
        return None

    # 收集子目录
    sub_dirs = []
    for name in sorted(os.listdir(abs_dir)):
        if name.startswith('.') or name == 'node_modules':
            continue
        if (abs_dir / name).is_dir():
            sub_dirs.append(name)

    page_path = abs_dir / 'page.md'
    info_path = abs_dir / 'info.json'
    has_page  = page_path.is_file()
    has_info  = info_path.is_file()

    # 读 info.json
    info = {}
    if has_info:
        try:
            raw = json.loads(info_path.read_text(encoding='utf-8'))
            if isinstance(raw, list):
                info = raw[0] if raw else {}
            elif isinstance(raw, dict):
                info = raw
        except Exception:
            print('  info.json 解析失败: %s' % (rel_dir or '(root)'))

    if not has_page and not sub_dirs and rel_dir:
        return None

    # 递归
    child_nodes = []
    for name in sub_dirs:
        child_rel = (rel_dir + '/' + name) if rel_dir else name
        node = build_folder(child_rel, ctx)
        if node:
            child_nodes.append(node)

    # 排序：date 降序 → title 升序
    child_nodes.sort(key=lambda c: (-to_time(c['date']), str(c['title'])))

    site = ctx['site']

    # ---- 关键：两种 description ----
    # node 用（给列表展示）：仅取 info.json，不做任何回退，没有就空
    description_raw = info.get('description') or ''
    # meta 用（页面自身 SEO）：可以回退站点描述
    page_description = description_raw or site.get('description') or ''

    dir_name = Path(rel_dir).name if rel_dir else (site.get('name') or '首页')
    title    = info.get('title')  or dir_name
    date     = info.get('date')   or ''
    author   = info.get('author') or ''

    if rel_dir:
        page_title = '%s - %s' % (title, site.get('name') or '')
    else:
        page_title = (site.get('name') or '') + \
                     ((' · ' + site.get('description')) if site.get('description') else '')

    canonical = ctx['base_url'] + ctx['home_url'] + (rel_dir + '/' if rel_dir else '')

    # 正文
    content_html = ''
    if has_page:
        content_html = render_markdown(page_path.read_text(encoding='utf-8'))
        content_html = strip_leading_title(content_html, title)

    # 子级列表：无 desc 就不显示
    child_lis = []
    for c in child_nodes:
        url = ctx['home_url'] + c['rel_dir'] + '/'
        d = (' <span class="date">%s</span>' % esc(c['date'])) if c['date'] else ''
        s = ('<br><span class="desc">%s</span>' % esc(c['description'])) if c['description'] else ''
        child_lis.append('<li><a href="%s">%s</a>%s%s</li>'
                         % (esc(url), esc(c['title']), d, s))
    children_html = '\n'.join(child_lis)

    # 类型
    if has_page and child_nodes:
        node_type = 'mixed'
    elif has_page:
        node_type = 'article'
    else:
        node_type = 'folder'

    # meta 行
    meta_parts = []
    if date:   meta_parts.append('<span class="date">%s</span>'   % esc(date))
    if author: meta_parts.append('<span class="author">%s</span>' % esc(author))
    doc_meta = ' · '.join(meta_parts)

    variables = {
        'LANG':       esc(site.get('lang') or 'zh-CN'),
        'TITLE':      esc(page_title),
        'META':       build_meta_block({
                          'site_name':   site.get('name') or '',
                          'locale':      site.get('locale') or '',
                          'title':       page_title,
                          'description': page_description,
                          'canonical':   canonical,
                          'favicon':     site.get('favicon') or '',
                      }),
        'HEAD_LINKS': build_head_links(site),
        'HOME_URL':   ctx['home_url'],
        'HOME_LABEL': esc(site.get('home_label') or '首页'),
        'BREADCRUMB': build_breadcrumb(rel_dir, ctx),
        'DOC_TITLE':  esc(title),
        'DOC_META':   doc_meta,
        'CONTENT':    content_html,
        'CHILDREN':   children_html,
    }

    output = render_template(ctx['templates'][node_type], variables)

    out_dir = (ctx['pages_root'] / rel_dir) if rel_dir else ctx['pages_root']
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'index.html').write_text(output, encoding='utf-8')

    print('  √ %s  [%s]' % (rel_dir or '/', node_type))

    # 返回给上级用于列表渲染：description 只用 description_raw
    return {
        'rel_dir':     rel_dir,
        'title':       title,
        'date':        date,
        'description': description_raw,
        'type':        node_type,
    }


# ============================================================
#  入口
# ============================================================
def main():
    config_path = BUILD_DIR / 'config.ini'
    if not config_path.is_file():
        print('缺少 config.ini: %s' % config_path, file=sys.stderr)
        sys.exit(1)

    site, paths_cfg, build_cfg = load_config()

    posts_root = (BUILD_DIR / paths_cfg.get('posts', '../posts')).resolve()
    pages_root = (BUILD_DIR / paths_cfg.get('pages', '../pages')).resolve()

    root_path = (site.get('root_path') or '').strip().rstrip('/')
    home_url  = (root_path + '/') if root_path else '/'
    base_url  = (site.get('base_url') or '').strip().rstrip('/')

    templates = {}
    for name in ('article', 'folder', 'mixed'):
        tpl_path = BUILD_DIR / (name + '.html')
        if not tpl_path.is_file():
            print('缺少模板: %s' % tpl_path, file=sys.stderr)
            sys.exit(1)
        templates[name] = tpl_path.read_text(encoding='utf-8')

    if (build_cfg.get('clean', 'true').lower() != 'false') and pages_root.exists():
        shutil.rmtree(pages_root)
    pages_root.mkdir(parents=True, exist_ok=True)

    ctx = {
        'posts_root': posts_root,
        'pages_root': pages_root,
        'site':       site,
        'home_url':   home_url,
        'base_url':   base_url,
        'templates':  templates,
    }

    print('开始构建')
    build_folder('', ctx)
    print('冰冰冰!')


if __name__ == '__main__':
    main()