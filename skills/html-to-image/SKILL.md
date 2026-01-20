---
name: html-to-image
display_name: HTML转图片
description: "将本地HTML文件转换为PNG图片。用于将生成的海报、网页等转换为可预览的图片格式。"
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    htmlPath:
      type: string
      description: "要转换的HTML文件的绝对路径"
    outputPath:
      type: string
      description: "输出PNG图片的路径（可选，默认与HTML同名同目录）"
    width:
      type: number
      description: "视口宽度，默认800像素"
    height:
      type: number
      description: "视口高度，默认1200像素"
  required:
    - htmlPath
---

# HTML转图片
将本地HTML文件转换为PNG图片。用于将生成的海报、网页等转换为可预览的图片格式。