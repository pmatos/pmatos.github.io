---
title: "ESBMC Plugin Update: Python Support, a New Home, and Where This Is Going"
description: ""
tags: ["esbmc", "claude", "formal-verification", "genai"]
date: 2026-02-23
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

A couple of weeks ago I [wrote about](https://p.ocmatos.com/blog/formal-verification-in-your-terminal-esbmc-meets-claude-code.html) the ESBMC plugin for Claude Code — a way to bring bounded model checking into your terminal through an AI coding assistant. The response was encouraging, and things have moved quickly since then. This is a short update on what changed, and a first sketch of where I think this is heading.

## What's New

### Python Support

Professor Cordeiro, ESBMC's lead, picked up the plugin and improved Python verification support. ESBMC has had a Python frontend for a while, but the plugin wasn't tuned for it. Now it is — you can point it at Python code with type annotations and get the same kind of exhaustive property checking that C users have had. Professor Cordeiro [announced this on LinkedIn](https://www.linkedin.com/feed/update/urn:li:activity:7431460883609989120/) along with a demo of verifying Python code for common issues.

This matters because Python is where a lot of AI-generated code lands. If your LLM writes a function with type annotations, you can now formally verify properties about it without switching tools or contexts.

### The Agent Marketplace

The plugin has moved to its own repository: [esbmc/agent-marketplace](https://github.com/esbmc/agent-marketplace). This is the new home for ESBMC's Claude Code integration, and I maintain it. The separation from the main ESBMC repo is deliberate — the plugin evolves on a different cadence than the verifier itself, and having a dedicated repo makes it easier to iterate on the agent-facing interface without coupling to ESBMC's release cycle.

Installation now uses the new repository names:

```
$ claude
> /plugin marketplace add esbmc/agent-marketplace
> /plugin install esbmc-plugin@esbmc-marketplace
```

## The Idea I Keep Coming Back To

I want to share something that's been shaping how I think about this plugin, even if I'm not ready to lay out the full argument yet.

Most of the time, verification is something you do *after* writing code. You finish a function, maybe write some tests, and if you're particularly disciplined, you might run a static analyzer or a model checker before merging. Verification is a gate at the end of a pipeline.

But what if it wasn't? What if verification happened *while* you write code, the same way `cargo check` gives you type errors as you go in Rust? Not as a final gate, but as a co-temporal activity — verification and implementation advancing together, each informing the other.

This is what excites me about having ESBMC inside a coding agent. The agent doesn't need to "finish" the code and then "run verification" as a separate step. It can write a function, immediately verify a property, discover a counterexample, and revise — all in one fluid loop. The verification isn't a post-hoc audit; it's part of the writing process. Think of it as the difference between a spell checker you run on a finished document and one that underlines words as you type.

The ESBMC plugin is a first step toward this. Today it's mostly used reactively — you write code, then ask Claude to verify it. But the skill system means Claude can reach for ESBMC proactively during code generation, and the pieces are falling into place for a tighter loop.

I have more to say about what this looks like concretely — strategy cascading, counterexample-driven refinement, how you'd encode verification profiles for different domains — but I'll save that for a dedicated post. For now, I wanted to plant the flag: verification should be co-temporal with coding, not a separate phase, and AI coding agents are the mechanism that makes this practical.

## Try It

If you have ESBMC installed and use Claude Code, give the plugin a spin. It now works with both C and Python, and the `/verify` and `/audit` commands are the fastest way to get started. File issues on the [agent-marketplace repo](https://github.com/esbmc/agent-marketplace) — I want to hear what works and what doesn't.
