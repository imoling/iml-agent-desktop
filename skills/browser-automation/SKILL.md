---
name: browser-automation
display_name: 浏览器操作
description: "Control a web browser to navigate pages, click elements, type text, and take screenshots."
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    action:
      type: string
      description: "要执行的操作。选项：'navigate', 'login', 'click', 'type', 'scroll', 'extract', 'screenshot', 'press_key', 'analyze_screenshot'"
    url:
      type: string
      description: "要导航到的 URL（用于 'navigate', 'login' 操作）。"
    username:
      type: string
      description: "用户名或邮箱（用于 'login' 操作）。"
    password:
      type: string
      description: "密码（用于 'login' 操作）。"
    selector:
      type: string
      description: "要交互的元素的 CSS 选择器或 XPath（用于 'click', 'type', 'extract'）。"
    text:
      type: string
      description: "要输入的文本（用于 'type' 操作）。"
    key:
      type: string
      description: "要按下的键（用于 'press_key' 操作，例如 'Enter', 'Backspace'）。"
    instruction:
      type: string
      description: "截图分析的指令（用于 'analyze_screenshot'）。"
    amount:
      type: number
      description: "滚动的像素数（用于 'scroll' 操作）。"
    x:
      type: number
      description: "点击坐标 X (可选，用于 'click')"
    y:
      type: number
      description: "点击坐标 Y (可选，用于 'click')"
  required:
    - action
---

# 浏览器操作
Control a web browser to navigate pages, click elements, type text, and take screenshots.