---
name: data-analyst
display_name: 数据分析
description: Analyze data files (CSV, JSON, Excel) to provide summaries, statistics, and insights using AI.
default_in_chat: true
version: 1.0.0
parameters:
  type: object
  properties:
    file_path:
      type: string
      description: The absolute path to the data file (CSV, JSON, .xlsx, .xls).
    query:
      type: string
      description: Specific question or analysis request about the data.
  required:
    - file_path
    - query
---

# 数据分析
Analyze data files (CSV, JSON, Excel) to provide summaries, statistics, and insights using AI.