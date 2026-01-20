---
name: shell-executor
display_name: Shell Script Executor (Shell 脚本执行器)
description: Execute shell commands or scripts on the local system.
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    script:
      type: string
      description: The shell script or command to execute.
    cwd:
      type: string
      description: Current working directory for execution.
  required:
    - script
    - cwd
---

# Shell Script Executor (Shell 脚本执行器)
Execute shell commands or scripts on the local system.