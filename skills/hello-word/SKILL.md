---
name: hello-word
display_name: 问候 (Hello World)
description: 向某人问好。简单的入门示例。
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    name:
      type: string
      description: The person to greet
  required:
    - name
---

# 问候 (Hello World)
向某人问好。简单的入门示例。