---
name: 'travel-planner'
display_name: '智能旅游攻略助手'
description: '根据您的需求定制全方位旅游攻略，整合天气、价格、评价信息，生成图文并茂的旅行计划网页。'
icon: 'Plane'
parameters:
  type: object
  properties:
    destination:
      type: string
      description: 目的地城市
    origin:
      type: string
      description: 出发城市
    duration:
      type: string
      description: 行程天数/时长
    budget:
      type: string
      description: 预算范围（如：2万）
    travelers:
      type: string
      description: 出行人员结构（如：2大1小，有老人）
    time:
      type: string
      description: 出发时间（用于查天气）
  required:
    - destination
    - duration
---

# Travel Planner

This skill generates a comprehensive travel itinerary web page based on your needs. It uses the desktop agent's AI capabilities to research (simulated) and plan your trip, outputting a rich HTML file.

## Usage

Provide the destination, duration, and any other constraints. The agent will generate a `travel_plan.html` and open it in your browser.
