---
name: bing-image-search
display_name: Bing 必应图片搜索
description: "搜索图片并生成瀑布流画廊。Search for images and generate a visual gallery."
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    query:
      type: string
      description: "图片关键词 (e.g. 'Cute cats', 'Sci-fi UI design')"
    count:
      type: number
      description: "图片数量 (Default: 20)"
  required:
    - query
---

# Bing 必应图片搜索
搜索图片并生成瀑布流画廊。Search for images and generate a visual gallery.