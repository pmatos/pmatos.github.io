# p.ocmatos.com - Personal Blog

A personal blog and website built with [Eleventy](https://www.11ty.dev/) and [Tailwind CSS](https://tailwindcss.com/), featuring music notation support via LilyPond, PWA capabilities, and automatic social media image generation.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) and npm
- **LilyPond** - For music notation rendering
  ```bash
  # Ubuntu/Debian
  sudo apt install lilypond
  
  # macOS
  brew install lilypond
  ```
- **Chromium** or **Google Chrome** - For social image generation

## Local Development

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/pmatos/p.ocmatos.com.git
   cd p.ocmatos.com
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Development Server

For development with hot-reload:
```bash
npm run dev
```
This runs both the Eleventy development server and Tailwind CSS watcher in parallel. The site will be available at `http://localhost:8080`.

Alternatively, you can run just the Eleventy server:
```bash
npm run start
```

### Building for Production

To create a production build:
```bash
npm run go!
```

This command will:
1. Clean the output directory
2. Generate PWA icons from `logo.png`
3. Build and minify CSS with Tailwind
4. Build the site with Eleventy
5. Generate social media images

For a basic build without icons and social images:
```bash
npm run build
```

## Project Structure

```
p.ocmatos.com/
├── src/
│   ├── _11ty/
│   │   ├── _data/          # Site metadata and configuration
│   │   ├── _generate/      # Templates for generated files
│   │   ├── _includes/      # Reusable components
│   │   ├── _layouts/       # Page layouts
│   │   ├── _social/        # Social image generation
│   │   ├── _static/        # Static assets (icons, images)
│   │   └── _tailwindCSS/   # Tailwind source files
│   ├── blog/               # Blog posts (Markdown)
│   ├── about-me.md         # About page
│   ├── blog.md             # Blog listing page
│   └── index.md            # Homepage
├── filters/                # Custom Eleventy filters
├── public/                 # Build output (git-ignored)
├── .eleventy.js           # Eleventy configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── netlify.toml           # Netlify deployment settings
└── package.json           # Project dependencies and scripts
```

## Deployment to GitHub Pages

### Method 1: GitHub Actions (Recommended)

1. Create a GitHub Actions workflow file at `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
     workflow_dispatch:
   
   permissions:
     contents: read
     pages: write
     id-token: write
   
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - name: Checkout
           uses: actions/checkout@v4
           
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'
             
         - name: Install LilyPond
           run: sudo apt-get update && sudo apt-get install -y lilypond
           
         - name: Install dependencies
           run: npm ci
           
         - name: Build site
           run: npm run go!
           env:
             URL: https://[your-username].github.io/[repository-name]
           
         - name: Upload artifact
           uses: actions/upload-pages-artifact@v3
           with:
             path: ./public
   
     deploy:
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       runs-on: ubuntu-latest
       needs: build
       steps:
         - name: Deploy to GitHub Pages
           id: deployment
           uses: actions/deploy-pages@v4
   ```

2. In your repository settings:
   - Go to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**

3. Push your changes to the `main` branch to trigger deployment

### Method 2: Manual Deployment

1. Build the site locally:
   ```bash
   npm run go!
   ```

2. Install gh-pages (if not already installed):
   ```bash
   npm install --save-dev gh-pages
   ```

3. Add a deploy script to `package.json`:
   ```json
   {
     "scripts": {
       "deploy": "gh-pages -d public"
     }
   }
   ```

4. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

5. Configure GitHub Pages in repository settings:
   - Go to **Settings** → **Pages**
   - Under **Source**, select **Deploy from a branch**
   - Choose the `gh-pages` branch

### Method 3: Netlify Deployment

The site is configured for Netlify deployment with the included `netlify.toml` file.

1. Connect your GitHub repository to Netlify
2. Netlify will automatically detect the build settings from `netlify.toml`
3. The site will auto-deploy on pushes to the main branch

## Writing Blog Posts

Create new blog posts in the `src/blog/` directory with the naming convention:
```
YYYY-MM-DD-post-title.md
```

Example frontmatter:
```markdown
---
title: "Your Post Title"
description: "Brief description of your post"
date: 2024-01-15
tags:
  - programming
  - javascript
---

Your content here...
```

### Using LilyPond for Music Notation

To include music notation in your posts, use the `lyInsert` shortcode:

```markdown
{% lyInsert %}
\version "2.24.0"
\relative c' {
  c4 d e f
  g4 f e d
  c1
}
{% endlyInsert %}
```

## Available Commands

| Command | Description |
|---------|------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run start` | Start Eleventy development server |
| `npm run build` | Build the site |
| `npm run go!` | Full production build |
| `npm run clean` | Remove the public directory |
| `npm run css:website` | Build website CSS |
| `npm run css:social-img` | Build social image CSS |
| `npm run social-images` | Generate social media images |
| `npm run icon` | Generate PWA icons from logo.png |

## Environment Variables

- `URL` - The production URL of your site (used for generating absolute URLs in feeds and sitemaps)
- `AWS_LAMBDA_FUNCTION_NAME` - Required for social image generation in Netlify (set to `trickpuppeteer`)

## Troubleshooting

### LilyPond not found
If you get errors about LilyPond not being found:
1. Ensure LilyPond is installed: `lilypond --version`
2. Make sure it's in your PATH
3. On macOS, you may need to add it manually: `export PATH="/Applications/LilyPond.app/Contents/Resources/bin:$PATH"`

### Social images not generating
1. Ensure Chromium or Chrome is installed
2. For headless environments, install required dependencies:
   ```bash
   sudo apt-get install -y \
     libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 \
     libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 \
     libasound2 libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 \
     libgtk-3-0 libgdk-pixbuf2.0-0
   ```

### Build fails on GitHub Actions
1. Ensure all required dependencies are installed in the workflow
2. Check that the `URL` environment variable is set correctly
3. Verify that LilyPond installation step is included if you use music notation

## License

MIT License - see LICENSE file for details

## Author

Paulo Matos - [p@ocmatos.com](mailto:p@ocmatos.com)