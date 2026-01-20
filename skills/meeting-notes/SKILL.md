---
name: meeting-notes
display_name: 会议纪要
description: "处理会议录音或文字记录，生成摘要和行动项。"
default_in_chat: true
version: 1.0.0
parameters:
  type: object
  properties:
    input:
      type: string
      description: "The absolute path to the meeting transcript file (txt/md) or the raw text content."
  required:
    - input
---

# 会议纪要
处理会议录音或文字记录，生成摘要和行动项。