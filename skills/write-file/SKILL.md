---
name: write-file
display_name: 写入文件 (Write File)
description: 将内容写入特定文件。如果文件不存在则创建，如果存在则覆盖。
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    path:
      type: string
      description: The absolute path to the file to write.
    content:
      type: string
      description: The text content to write to the file.
  required:
    - path
    - content
---

# 写入文件 (Write File)
将内容写入特定文件。如果文件不存在则创建，如果存在则覆盖。