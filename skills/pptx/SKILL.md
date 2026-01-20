---
name: pptx
display_name: 幻灯片制作
description: "Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks"
default_in_chat: true
version: 1.0.0
parameters:
  type: object
  properties:
    action:
      type: string
      enum: [analyze, create]
      description: Action to perform. 'analyze' extracts text/stats from PPTX. 'create' makes PPTX from HTML.
    file_path:
      type: string
      description: Path to input file (PPTX for analyze, HTML for create)
    output_path:
      type: string
      description: Path to save output (JSON for analyze, PPTX for create)
  required:
    - action
    - file_path
---

# 幻灯片制作 (PPTX)
Presentation creation, editing, and analysis.

## Creating Presentations
To create a presentation, you must generate an **HTML file** that represents the slides.
The agent will convert this HTML into a `.pptx` file.

### Rules for HTML Generation:
1.  **Multiple Slides**: distinct slides MUST be wrapped in `<div class="p-slide">...</div>`.
    *   If no `.p-slide` class is found, the entire body is treated as a single slide.
2.  **Layout**:
    *   Target **16:9 Aspect Ratio** (e.g., 960px x 540px).
    *   Use **absolute positioning** or **flexbox** within the `.p-slide` container.
3.  **Images**:
    *   Use standard `<img>` tags.
    *   You CAN use external URLs (e.g., from Bing Search) or local paths.
    *   **Pro Tip**: For "rich" content, perform a `bing-image-search` first, then use the resulting URLs in your HTML.
4.  **Styling**:
    *   Use inline styles or a `<style>` block.
    *   Backgrounds: Use `background-color` or `background-image` on the `.p-slide` div.
    *   **Note**: persistent CSS gradients are not supported natively by the converter; use solid colors or images.

### Recommended Interactive Template:
Please use the following HTML structure. It provides a "Presentation Mode" for the user to view the slides directly in the browser with animations and keyboard navigation.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Presentation</title>
    <style>
        body { margin: 0; padding: 20px; font-family: sans-serif; background: #f0f0f0; transition: background 0.3s; }
        
        /* Slide Container - Default (Scroll/Convert Mode) */
        .p-slide {
            width: 960px; height: 540px;
            position: relative; overflow: hidden;
            background: white;
            margin: 0 auto 20px auto;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        /* Content Styling Helpers */
        .title { font-size: 40px; font-weight: bold; position: absolute; top: 40px; left: 40px; }
        .subtitle { font-size: 24px; color: #666; position: absolute; top: 100px; left: 40px; }
        .content { font-size: 18px; line-height: 1.6; position: absolute; top: 150px; left: 40px; width: 880px; }
        
        /* --- Presentation Mode Styles --- */
        body.presentation-mode { padding: 0; background: black; overflow: hidden; }
        
        body.presentation-mode .p-slide {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(1);
            margin: 0;
            box-shadow: none;
            opacity: 0; pointer-events: none;
            transition: opacity 0.5s ease-in-out;
        }
        
        /* Responsive Scaling for Presentation Mode */
        @media (max-width: 960px), (max-height: 540px) {
            body.presentation-mode .p-slide {
                transform: translate(-50%, -50%) scale(min(calc(100vw/960), calc(100vh/540)));
            }
        }

        body.presentation-mode .p-slide.active { opacity: 1; pointer-events: auto; z-index: 10; }

        /* Floating Controls */
        #controls { position: fixed; bottom: 20px; right: 20px; z-index: 1000; gap: 10px; display: flex; }
        button { padding: 10px 20px; background: #333; color: white; border: none; border-radius: 5px; cursor: pointer; opacity: 0.8; }
        button:hover { opacity: 1; }
        body.presentation-mode #btn-present { display: none; }
    </style>
</head>
<body>

    <!-- Slide 1 -->
    <div class="p-slide active">
        <h1 class="title">My Presentation</h1>
        <div class="subtitle">Subtitle here</div>
        <img src="https://via.placeholder.com/400" style="position:absolute; bottom:50px; right:50px; width:300px;">
    </div>

    <!-- Slide 2 -->
    <div class="p-slide">
        <h1 class="title">Agenda</h1>
        <ul class="content">
            <li>Point 1...</li>
            <li>Point 2...</li>
        </ul>
    </div>

    <div id="controls">
        <button id="btn-present" onclick="togglePresentation()">▶ Play Presentation</button>
    </div>

    <script>
        let isPresenting = false;
        let currentSlide = 0;
        const slides = document.querySelectorAll('.p-slide');

        function togglePresentation() {
            isPresenting = !isPresenting;
            document.body.classList.toggle('presentation-mode', isPresenting);
            if (isPresenting) {
                document.documentElement.requestFullscreen().catch(e => console.log(e));
                showSlide(0);
            } else {
                document.exitFullscreen().catch(e => console.log(e));
                // Remove active class to show all in flow? No, keep logic simple
                // Actually in convert mode we want all visible. 
                // The CSS for default mode ignores .active and shows all regular flow.
            }
        }

        function showSlide(index) {
            if (index < 0) index = 0;
            if (index >= slides.length) index = slides.length - 1;
            currentSlide = index;
            slides.forEach((s, i) => s.classList.toggle('active', i === index));
        }

        document.addEventListener('keydown', (e) => {
            if (!isPresenting) return;
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') showSlide(currentSlide + 1);
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') showSlide(currentSlide - 1);
            else if (e.key === 'Escape') togglePresentation();
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && isPresenting) togglePresentation();
        });
    </script>
</body>
</html>
```