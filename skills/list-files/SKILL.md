---
name: list-files
display_name: 列出文件 (List Files)
description: "列出特定路径下的文件和目录。用于探索文件系统结构。"
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    path:
      type: string
      description: "The absolute path to the directory to list. If omitted, lists the current working directory."
  required:
    - path
---

# 列出文件 (List Files)
列出特定路径下的文件和目录。用于探索文件系统结构。