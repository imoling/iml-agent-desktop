---
name: pptx
display_name: 幻灯片制作
description: |
  CRITICAL: This skill converts HTML to PPTX. You MUST generate HTML with MULTIPLE slides using <div class="p-slide"> for EACH slide.
  DO NOT generate single-page scrolling HTML - that will result in a blank or single-slide PPTX.
  
  MANDATORY STEP BEFORE GENERATING HTML:
  1. Read the template file: /Users/imoling/projects/iml-agent-desktop/skills/pptx/examples/template-3-slides.html
  2. Use read-file skill to view this template
  3. Follow the EXACT structure shown in the template
  4. Each <div class="p-slide"> becomes ONE PowerPoint slide
  
  Use this skill when you need to:
  1. Create multi-slide presentations (.pptx files)
  2. Convert structured content into PowerPoint format
  3. Generate visual reports with multiple pages
  
  WORKFLOW:
  Step 1: Read template file with read-file skill
  Step 2: Use write-file skill to create HTML following template structure
  Step 3: Call this skill with action='create' to convert HTML to PPTX
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

## ⚠️ CRITICAL REQUIREMENTS FOR HTML GENERATION

**YOU MUST FOLLOW THESE RULES OR THE PPTX WILL BE BLANK/BROKEN:**

1. **NEVER generate single-page scrolling HTML** - This is the most common mistake!
2. **ALWAYS use `<div class="p-slide">` for EACH slide** - One div = one PowerPoint slide
3. **Each slide MUST be exactly 960px × 540px** (16:9 aspect ratio)
4. **Use absolute positioning or flexbox WITHIN each .p-slide div**

### ❌ WRONG (Single-Page Scrolling):
```html
<body>
  <div class="container">
    <h1>Title</h1>
    <div class="section">Content 1</div>
    <div class="section">Content 2</div>
    <div class="section">Content 3</div>
  </div>
</body>
```

### ✅ CORRECT (Multi-Slide Structure):
```html
<body>
  <!-- Slide 1 -->
  <div class="p-slide">
    <h1 style="position: absolute; top: 200px; left: 300px;">Title Slide</h1>
  </div>
  
  <!-- Slide 2 -->
  <div class="p-slide">
    <h2 style="position: absolute; top: 50px; left: 50px;">Content 1</h2>
    <p style="position: absolute; top: 150px; left: 50px;">Details...</p>
  </div>
  
  <!-- Slide 3 -->
  <div class="p-slide">
    <h2 style="position: absolute; top: 50px; left: 50px;">Content 2</h2>
  </div>
</body>
```

## 🚨 CRITICAL SIZE AND CONTENT CONSTRAINTS

**THESE ARE NON-NEGOTIABLE RULES:**

### 1. Slide Dimensions
- **MUST be EXACTLY 960px × 540px** (16:9 aspect ratio)
- ❌ DO NOT use 1024x768, 1920x1080, or any other size
- ❌ DO NOT use percentage-based widths/heights

### 2. Padding and Margins
- **MAXIMUM padding: 40px** on `.p-slide`
- Use `box-sizing: border-box` to include padding in dimensions
- Leave at least 40px margin from all edges for content

### 3. Content Limits Per Slide
- **Title**: Maximum 48px font size
- **Body text**: Maximum 24px font size
- **Maximum content blocks**: 4-6 items per slide
- **Grid layouts**: Maximum 2×2 (4 cards) or 3×1 (3 cards)
- ❌ DO NOT cram too much content - it WILL overflow

### 4. Font Sizes (Recommended)
- **H1 (Cover)**: 48-60px
- **H2 (Section Title)**: 32-40px
- **H3 (Card Title)**: 20-24px
- **Body Text**: 16-20px
- **Footer**: 12-14px

### 5. Safe Content Area
- **Effective content area**: 880px × 460px (after 40px padding)
- Keep all important content within this area
- Use `overflow: hidden` on `.p-slide` to prevent spillover

### 6. Testing Your HTML
Before calling the pptx skill, verify:
```bash
# Check slide count
grep -c 'class="p-slide"' your-file.html

# Check dimensions
grep 'width: 960px' your-file.html
grep 'height: 540px' your-file.html
```

## 🔧 CRITICAL CONVERSION REQUIREMENTS

**The html2pptx converter has specific requirements. Follow these EXACTLY:**

### 1. Layout Strategy
- ❌ **DO NOT use CSS Grid or Flexbox for main layout**
- ✅ **USE absolute positioning for ALL content elements**
- ✅ **USE `position: absolute` with explicit `top`, `left`, `width`, `height`**

### 2. Content Boxes (DIVs)
- ✅ **ALL content DIVs MUST have explicit `background` color**
- ✅ **Even white backgrounds must be specified: `background: white`**
- ❌ **Transparent or `rgba(0,0,0,0)` backgrounds will be IGNORED**
- ✅ **Add visible borders if background is subtle: `border-left: 5px solid #color`**
- ❌ **CSS gradients (linear-gradient, radial-gradient) are NOT supported**
- ✅ **Use solid colors only: `background: #4facfe` instead of `background: linear-gradient(...)`**

### 3. Text Elements
- ✅ **Use direct P, H1, H2, H3 tags** (not nested deep in DIVs)
- ✅ **Give text elements absolute positioning**
- ✅ **Use inline styles, not CSS classes**
- ❌ **Avoid complex nesting** (max 2 levels deep)

### 4. Example Structure (CORRECT):
```html
<div class="p-slide">
  <!-- Title with absolute position -->
  <h2 style="position: absolute; top: 40px; left: 40px; font-size: 36px;">
    Section Title
  </h2>
  
  <!-- Card with explicit background -->
  <div style="position: absolute; top: 120px; left: 40px; width: 400px; height: 150px; background: #f8f9fa; padding: 20px;">
    <h3 style="font-size: 20px; margin: 0;">Card Title</h3>
    <p style="font-size: 16px; margin: 10px 0 0 0;">Card content</p>
  </div>
</div>
```

### 5. Example Structure (WRONG):
```html
<div class="p-slide">
  <!-- Grid layout - will be IGNORED -->
  <div class="content-grid" style="display: grid; grid-template-columns: repeat(2, 1fr);">
    <!-- Transparent background - will be IGNORED -->
    <div class="card">
      <h3>Title</h3>
      <p>Content</p>
    </div>
  </div>
</div>
```

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