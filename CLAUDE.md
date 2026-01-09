# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Development
- `npm run dev` - Start development server with watch mode (runs both CSS and 11ty watch)
- `npm run start` - Start Eleventy development server
- `npm run build` - Build the site using Eleventy
- `npm run go!` - Full production build (clean + icons + CSS + build)  
- `npm run build:ci` - CI build (clean + CSS + build, no icon generation)

### Individual Build Steps
- `npm run clean` - Remove the public directory
- `npm run css:website` - Build and minify main CSS from Tailwind
- `npm run eleventy` - Run 11ty build
- `npm run icon` - Generate PWA icons and splash screens from logo.png

### Dependencies
- **LilyPond** - Required for music notation rendering (install via `sudo apt install lilypond`)
- **Chromium** - Required for icon generation (only needed for `npm run go!`, not CI builds)

## Architecture Overview

This is a personal blog/website built with **Eleventy (11ty)** and **Tailwind CSS**, deployed to GitHub Pages via Netlify.

### Key Architecture Components

**Static Site Generator**: Eleventy with Nunjucks templating
- Input: `src/` directory with Markdown content and templates
- Output: `public/` directory with static HTML/CSS/JS
- Configuration: `.eleventy.js` with plugins and custom filters

**Content Structure**:
- `src/blog/` - Blog posts in Markdown with frontmatter
- `src/_11ty/_layouts/` - Page layouts (article, blog, page)
- `src/_11ty/_includes/` - Reusable components (nav, footer, head)
- `src/_11ty/_generate/` - Generated files (sitemap, RSS, manifest)

**Styling**: Tailwind CSS with custom configuration
- Source: `src/_11ty/_tailwindCSS/raw-website.css`
- Config: `tailwind.config.js` with custom colors, fonts, and screens
- Output: `public/css/style.css` (minified)

**Special Features**:
- **Music Notation**: Custom shortcode `{% lyInsert %}` that renders LilyPond notation as SVG
- **Social Images**: Auto-generated social media preview images for all pages
- **PWA Support**: Manifest, service worker, and app icons
- **SEO**: Sitemap, RSS feeds, and social meta tags

### Key Files and Directories

**Configuration**:
- `.eleventy.js` - Main Eleventy configuration with plugins and transforms
- `tailwind.config.js` - Tailwind CSS configuration
- `netlify.toml` - Netlify deployment configuration
- `src/_11ty/_data/meta.js` - Site metadata and configuration

**Content**:
- `src/index.md` - Homepage
- `src/blog/` - Blog posts (date-prefixed Markdown files)
- `src/about-me.md` - About page
- `src/racket-money.md` - Special project page

**Templates**:
- `src/_11ty/_layouts/article.njk` - Blog post layout
- `src/_11ty/_layouts/blog.njk` - Blog listing layout
- `src/_11ty/_layouts/page.njk` - General page layout

**Custom Logic**:
- `filters/lyInsert.js` - LilyPond integration filter
- `src/_11ty/_social/` - Social image generation templates

### Build Process

1. **Clean** - Remove previous build artifacts
2. **Icons** - Generate PWA icons from `logo.png`
3. **CSS** - Compile Tailwind CSS (website and social image variants)
4. **Eleventy** - Process Markdown content and templates
5. **Social Images** - Generate social media preview images
6. **Deploy** - Upload to GitHub Pages via Netlify

### Deployment

- **Development**: Netlify with auto-deploy from main branch
- **Production**: GitHub Actions workflow builds and deploys to GitHub Pages
- **Special Requirements**: LilyPond must be installed in build environment for music notation

## Development Notes

### LilyPond Integration
The `{% lyInsert %}` shortcode in `.eleventy.js` uses `filters/lyInsert.js` to process music notation. This filter:
- Creates temporary files with LilyPond syntax
- Executes `lilypond` command with SVG output and cropping
- Returns the SVG content directly to be embedded in pages
- Requires `lilypond` to be available in PATH

### Tailwind Configuration
The `tailwind.config.js` uses extensive custom theme configuration:
- Custom screens breakpoints starting from 450px
- Full color palette retained from default Tailwind
- Custom font stacks with Roboto Serif for serif content
- Typography plugin enabled for prose content

### Static Assets Organization
Static files are organized under `src/_11ty/_static/`:
- `app/sw.js` - Service worker for PWA functionality
- `favicon/` - Generated PWA icons and splash screens (created by pwa-asset-generator)
- `img/` - Blog post images organized by date and topic

### Content Processing
- Markdown-it with footnote support for enhanced content
- HTML minification in production builds
- RSS feed generation at `/feed/`
- Automatic sitemap generation
- Social media meta tag generation

## Write Dashboard

A local FastAPI-based dashboard for drafting and publishing blog posts with AI assistance.

### Running the Dashboard
```bash
cd dashboard
uv run uvicorn app:app --reload
```
Access at http://localhost:8000

### Architecture

**Stack**: FastAPI + Jinja2 templates + SQLite + EasyMDE editor

**Directory Structure**:
```
dashboard/
├── app.py                    # FastAPI app setup
├── db.py                     # SQLite operations (drafts table)
├── config.py                 # Configuration
├── routers/
│   ├── ai.py                # AI analysis endpoint
│   ├── drafts.py            # Draft CRUD + publishing
│   └── links.py             # Link management
├── services/
│   ├── claude_client.py     # Claude API integration
│   └── blog_publisher.py    # Publishing workflow
├── templates/
│   ├── editor.html          # Main editor UI
│   ├── drafts.html          # Draft listing
│   └── base.html            # Base template
└── static/
    ├── js/editor.js         # Client-side editor logic
    └── css/style.css        # Dashboard styling
```

### Key Features

**Markdown Editor**: EasyMDE-based editor with:
- Auto-save (2-second debounce)
- Image upload/URL insertion
- Video upload/YouTube embed support
- Drag-and-drop media upload

**AI Analysis**: Paragraph-by-paragraph writing feedback using Claude
- Split content by `\n\n` into paragraphs
- Each paragraph analyzed with context from previous paragraphs
- Returns: summary, flow analysis, overall rating, suggestions
- Suggestion types: addition, removal, rewrite (with auto-apply for rewrites)
- Click on analysis comments to highlight corresponding paragraph in editor

**Publishing Flow**:
1. Create markdown file in `src/blog/` with proper frontmatter
2. Run site build
3. Commit and push to git

### Database Schema (SQLite)

```sql
drafts:
- id, title, description, tags
- content (markdown)
- audience_notes (for AI context)
- ai_analysis (JSON array of analysis results)
- status, created_at, updated_at, published_at, published_path
```

### AI Analysis Data Structure

Each analysis item contains:
- `paragraph_index`: Position in document (0-based)
- `paragraph_text`: Original text being analyzed
- `overall_rating`: "good" | "needs_work" | "significant_issues"
- `summary`: What the paragraph accomplishes
- `flow_with_context`: How it connects to previous content
- `suggestions`: Array of {type, description, example}

### Editor JavaScript API

Key functions in `dashboard/static/js/editor.js`:
- `highlightParagraph(index)`: Scroll to and highlight a paragraph with fading effect
- `applySuggestion(paragraphIndex, suggestionIndex)`: Apply a rewrite suggestion
- `insertAtCursor(text)`: Insert text at cursor position in editor