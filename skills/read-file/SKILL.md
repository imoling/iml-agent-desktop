---
name: read-file
display_name: 读取文件 (Read File)
description: 读取特定文件的内容。
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    path:
      type: string
      description: The absolute path to the file to read.
  required:
    - path
---

# 读取文件 (Read File)
读取特定文件的内容。