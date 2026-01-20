---
name: system-operator
display_name: System Operator (系统管理员)
description: Perform system-level operations like organizing files and controlling applications.
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    action:
      type: string
      description: The action to perform. One of 'analyze_files', 'organize_files', 'control_app', 'get_system_info'.
    target_path:
      type: string
      description: (For analyze/organize) The directory. Defaults to Desktop.
    strategy:
      type: string
      description: "(For organize_files) Strategy: 'smart_cleanup' (Recommended), 'by_extension', 'by_date'."
    app_name:
      type: string
      description: (For control_app) Name of the application to control.
    app_action:
      type: string
      description: "(For control_app) Action: 'open', 'close', 'restart'."
    dry_run:
      type: boolean
      description: If true, returns a plan without moving files.
  required:
    - action
    - target_path
    - strategy
    - app_name
    - app_action
    - dry_run
---

# System Operator (系统管理员)
Perform system-level operations like organizing files and controlling applications.