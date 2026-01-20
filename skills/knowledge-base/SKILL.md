---
name: knowledge-base
display_name: Knowledge Base (Memory)
description: "Manage and access the agent's long-term memory. Use this to remember important information or retrieving it later."
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    action:
      type: string
      description: "Action to perform. Options: 'add', 'search'"
    content:
      type: string
      description: "Content to add to memory (Required for 'add' action)."
    query:
      type: string
      description: "Query string to search for (Required for 'search' action)."
    limit:
      type: number
      description: "Number of results to return (Optional for 'search', default 3)."
  required:
    - action
---

# Knowledge Base (Memory)
Manage and access the agent's long-term memory. Use this to remember important information or retrieving it later.