---
title: Claude Code Usage in Waybar
description: A small script to monitor Claude Code API usage directly from your status bar.
tags: ["#claude", "#waybar", "#linux"]
date: 2026-02-11
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

If you're a heavy Claude Code user, you've probably been caught off guard by hitting your session or weekly usage cap mid-flow. I wrote a small script that shows your current Claude Code API usage right in [Waybar](https://github.com/Alexays/Waybar), so you can always see where you stand at a glance.

Here's what it looks like:

![Waybar with Claude Code usage module](/img/2026/02/waybar-claude-usage.png)

The module on the left shows session and weekly utilization percentages. It color-codes based on session utilization — neutral brown under 50%, orange at 50-79%, and red at 80%+. Hovering shows the reset times.

## The Script

The full script is available as a [gist](https://gist.github.com/pmatos/70f18d396f8e21804f8a437184de1292). It reads your Claude Code OAuth credentials, hits the Anthropic usage API, and outputs JSON that Waybar can consume directly.

It requires `jq` and `curl` — both likely already on your system.

## Waybar Configuration

Add a custom module to your Waybar config:

```json
"custom/claude": {
    "exec": "~/.config/waybar/claude-usage.sh",
    "return-type": "json",
    "interval": 120,
    "format": "🤖 {}",
    "tooltip": true
}
```

Then include `"custom/claude"` in whichever module section you prefer (I have it in `modules-right`).

For styling, add something like this to your `style.css`:

```css
#custom-claude {
    background-color: #d4a574;
    color: #000000;
    font-weight: bold;
}

#custom-claude.claude-mid {
    background-color: #f39c12;
    color: #000000;
}

#custom-claude.claude-high {
    background-color: #e74c3c;
    color: #ffffff;
}

#custom-claude.claude-error {
    background-color: #7f8c8d;
    color: #ffffff;
}
```

The CSS classes are set by the script based on the session utilization percentage, so the module changes color as you approach your session limit.

That's it — a simple way to keep an eye on your Claude Code budget without leaving your workflow.
