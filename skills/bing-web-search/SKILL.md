---
name: bing-web-search
display_name: Bing 必应网页搜索
description: "搜索互联网并返回相关信息。Search the web for information."
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    query:
      type: string
      description: "搜索关键词 (e.g. 'Latest AI news', 'Stock price of AAPL')"
  required:
    - query
---

# Bing 必应网页搜索
搜索互联网并返回相关信息。Search the web for information.