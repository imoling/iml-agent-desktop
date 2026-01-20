---
name: generate-pdf
display_name: PDF Generator
description: "Convert a webpage URL or HTML content into a PDF document. Can attach to active browser session."
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    url:
      type: string
      description: "URL of the webpage to convert to PDF. If omitted, and 'content' is omitted, tries to print the currently active tab of the browser session."
    content:
      type: string
      description: "Raw HTML content to render as PDF. (Optional)"
    filename:
      type: string
      description: "Desired output filename (e.g. 'report.pdf'). Defaults to timestamped name."
    landscape:
      type: boolean
      description: "Whether to print in landscape mode. Default false."
  required: []
---

# PDF Generator
Convert a webpage URL or HTML content into a PDF document. Can attach to active browser session.