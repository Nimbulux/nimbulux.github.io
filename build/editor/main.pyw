#!/usr/bin/env python3
"""
文章编辑系统 - 后端
使用 Tkinter 选择目录，支持配置记忆，目录按 build.py 规则排序
"""

import json
import shutil
import datetime
from pathlib import Path
import webview
import tkinter as tk
from tkinter import filedialog

BASE_DIR = Path(__file__).parent.resolve()
CONFIG_PATH = BASE_DIR / "editor_config.json"


def load_config():
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(config: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


class Api:
    def __init__(self):
        self.posts_dir = None
        self.dark_mode = False
        self.expanded_paths = []
        cfg = load_config()
        if "posts_dir" in cfg:
            p = Path(cfg["posts_dir"])
            if p.exists():
                self.posts_dir = p
        if "dark_mode" in cfg:
            self.dark_mode = bool(cfg["dark_mode"])
        if "expanded_paths" in cfg:
            self.expanded_paths = cfg["expanded_paths"]

    def get_config(self):
        return {
            "posts_dir": str(self.posts_dir) if self.posts_dir else "",
            "dark_mode": self.dark_mode,
            "expanded_paths": self.expanded_paths
        }

    def select_directory(self):
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        initial = str(self.posts_dir) if self.posts_dir and self.posts_dir.exists() else str(BASE_DIR)
        dir_path = filedialog.askdirectory(
            title="请选择文章根目录",
            initialdir=initial
        )
        root.destroy()
        if dir_path:
            self.posts_dir = Path(dir_path)
            self.expanded_paths = []
            save_config({"posts_dir": str(self.posts_dir), "dark_mode": self.dark_mode, "expanded_paths": []})
            return str(self.posts_dir)
        return None

    def set_dark_mode(self, mode: bool):
        self.dark_mode = mode
        save_config({"posts_dir": str(self.posts_dir) if self.posts_dir else "", "dark_mode": mode, "expanded_paths": self.expanded_paths})

    def save_expanded_paths(self, paths):
        self.expanded_paths = paths
        save_config({"posts_dir": str(self.posts_dir) if self.posts_dir else "", "dark_mode": self.dark_mode, "expanded_paths": paths})

    def _check_dir(self):
        if not self.posts_dir:
            raise RuntimeError("尚未选择文章目录")

    def get_tree(self):
        self._check_dir()

        def build_tree(path: Path, relative: Path):
            has_page = (path / "page.md").exists() and (path / "info.json").exists()
            children = []
            try:
                for entry in sorted(path.iterdir()):
                    if entry.is_dir() and not entry.name.startswith('.'):
                        child = build_tree(entry, relative / entry.name)
                        children.append(child)
            except PermissionError:
                pass

            # ★ 排序 children：目录在前（按名称），文章/mixed 在后（按日期降序）
            children.sort(key=lambda child: (
                0 if child["type"] == "directory" else 1,
                child["name"] if child["type"] == "directory" else (
                    -self._parse_date(child.get("info", {}).get("date", "1970-01-01T00:00:00Z"))
                )
            ))

            node = {
                "name": path.name,
                "path": str(relative).replace("\\", "/"),
                "hasPage": has_page,
                "type": "directory",
                "children": children
            }

            if has_page and children:
                node["type"] = "mixed"
            elif has_page:
                node["type"] = "article"

            if has_page:
                try:
                    with open(path / "info.json", "r", encoding="utf-8") as f:
                        info = json.load(f)
                    node["info"] = {
                        "title": info.get("title", path.name),
                        "date": info.get("date", ""),
                        "updated": info.get("updated", ""),
                        "excerpt": info.get("excerpt", ""),
                        "tags": info.get("tags", []),
                        "reading_time": info.get("reading_time", None)
                    }
                except Exception:
                    node["info"] = {"title": path.name}
            return node

        assert isinstance(self.posts_dir, Path)
        if not self.posts_dir.exists():
            self.posts_dir.mkdir(parents=True)

        root = build_tree(self.posts_dir, Path(""))
        root["name"] = self.posts_dir.name
        root["path"] = ""
        return root

    @staticmethod
    def _parse_date(date_str):
        """将 ISO 日期字符串转换为时间戳，用于排序；若无效返回 0"""
        try:
            return datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0

    def read_file(self, relative_path, filename="page.md"):
        self._check_dir()
        file_path = self.posts_dir / relative_path / filename
        if file_path.exists():
            return file_path.read_text(encoding="utf-8")
        return ""

    def write_file(self, relative_path, content, filename="page.md"):
        self._check_dir()
        file_path = self.posts_dir / relative_path / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")

    def read_info(self, relative_path):
        self._check_dir()
        file_path = self.posts_dir / relative_path / "info.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def write_info(self, relative_path, info):
        self._check_dir()
        file_path = self.posts_dir / relative_path / "info.json"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        original = {}
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                original = json.load(f)
        merged = original.copy()
        if "title" in info:
            merged["title"] = info["title"] if info["title"] else original.get("title", "Untitled")
        if "date" in info:
            merged["date"] = info["date"] if info["date"] else original.get("date", "")
        if "updated" in info:
            if info["updated"]:
                merged["updated"] = info["updated"]
            else:
                merged.pop("updated", None)
        if "excerpt" in info:
            if info["excerpt"]:
                merged["excerpt"] = info["excerpt"]
            else:
                merged.pop("excerpt", None)
        if "tags" in info:
            if isinstance(info["tags"], list) and len(info["tags"]) > 0:
                merged["tags"] = info["tags"]
            else:
                merged.pop("tags", None)
        if "reading_time" in info:
            val = info["reading_time"]
            if val is not None and val != "":
                merged["reading_time"] = int(val)
            else:
                merged.pop("reading_time", None)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)

    def create_folder(self, parent_path, name):
        self._check_dir()
        target = self.posts_dir / parent_path / name
        if not target.exists():
            target.mkdir(parents=True)
            return True
        return False

    def create_article(self, parent_path, name):
        self._check_dir()
        target = self.posts_dir / parent_path / name
        if not target.exists():
            target.mkdir(parents=True)
            (target / "page.md").write_text("# 新文章", encoding="utf-8")
            default_info = {
                "title": name.replace("-", " ").title(),
                "date": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "excerpt": "",
                "tags": []
            }
            with open(target / "info.json", "w", encoding="utf-8") as f:
                json.dump(default_info, f, indent=2, ensure_ascii=False)
            return True
        return False

    def delete_item(self, relative_path, delete_type):
        self._check_dir()
        target = self.posts_dir / relative_path
        if not target.exists():
            return False
        if delete_type == 'article':
            (target / "page.md").unlink(missing_ok=True)
            (target / "info.json").unlink(missing_ok=True)
            return True
        elif delete_type == 'directory':
            shutil.rmtree(target)
            return True
        return False

    def move_item(self, src_path, dest_parent_path):
        self._check_dir()
        src = self.posts_dir / src_path
        if not src.exists():
            return False
        dest_dir = self.posts_dir / dest_parent_path
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / src.name
        if dest.exists():
            return False
        shutil.move(str(src), str(dest))
        return True

    def calculate_reading_time(self, text):
        chars = sum(1 for c in text if c.isalnum() or ord(c) > 127)
        return max(1, round(chars / 500))


if __name__ == '__main__':
    api = Api()
    html_path = BASE_DIR / "app" / "index.html"
    window = webview.create_window(
        "文章编辑系统",
        str(html_path),
        js_api=api,
        min_size=(900, 600),
    )
    webview.start()