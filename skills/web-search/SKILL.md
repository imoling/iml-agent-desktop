---
name: web-search
display_name: 联网搜索 (Web Search)
description: 搜索网页以获取有关任何主题的实时信息。当您需要外部知识时使用此功能。
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    query:
      type: string
      description: The search query. Be specific.
  required:
    - query
---

# 联网搜索 (Web Search)
搜索网页以获取有关任何主题的实时信息。当您需要外部知识时使用此功能。