---
name: code-scaffold
display_name: Code Scaffold (代码脚手架)
description: Generate multi-file project structures and boilerplate code from natural language descriptions.
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    description:
      type: string
      description: Detailed description of what to build (e.g., "A React login component with CSS modules").
    target_dir:
      type: string
      description: Optional. Absolute path to the directory where code should be generated. Defaults to a new folder in the current directory.
  required:
    - description
    - target_dir
---

# Code Scaffold (代码脚手架)
Generate multi-file project structures and boilerplate code from natural language descriptions.