# 配置文件

用来自动化构建文章的相关文件

## info.json

| 字段名 | 类型 | 必填 | 描述 |
| :----: | :--: | :--: | :--: |
| `title` | string | ✅ | 文章标题 |
| `excerpt` | string | ✅ | 文章摘要 |
| `date` | string (ISO 8601) | ✅ | 发布日期，例如 `2026-07-11T12:00:00Z` |
| `updated` | string (ISO 8601) | ❌ | 最后修改时间，若缺失则与 `date` 相同 |
| `tags` | array of strings | ❌ | 标签数组，如 `["JavaScript", "博客"]` |
| `reading_time` | integer | ❌ | 预计阅读时长（分钟）未填写自动计算 |

**示例:**

```json

{
  "title": "Hello World",
  "excerpt": "这是我的第一篇博客，简单介绍结构。",
  "date": "2026-07-11T12:00:00Z",
  "updated": "2026-07-11T14:30:00Z",
  "tags": ["入门", "博客"],
  "reading_time": 3
}

```
