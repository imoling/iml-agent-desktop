---
name: weather-query-with-clothing-advice
display_name: 天气查询与穿衣建议
description: 查询指定城市的天气信息，并根据天气条件提供穿衣建议
default_in_chat: true
version: 1.0.0
parameters:
  type: object
  properties:
    city:
      type: string
      description: 要查询天气的城市名称（如：北京、上海、广州）
    days:
      type: number
      description: 查询未来几天的天气（1-7天），默认为1天
  required:
    - city
user-invocable: true
---

# 天气查询与穿衣建议
查询指定城市的天气信息，并根据天气条件提供穿衣建议
